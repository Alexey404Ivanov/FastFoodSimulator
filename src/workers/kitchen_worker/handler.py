import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from src.contracts.simulation import (
    OrderCreatedEvent,
    OrderDoneEvent,
    SimulationContinuedEvent,
    SimulationPausedEvent,
    SimulationStartedEvent,
    SimulationUpdatedEvent,
)
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository


class KitchenRuntime:
    def __init__(self, event: SimulationStartedEvent, exchange: AbstractRobustExchange):
        self.simulation_id = event.simulation_id
        self.exchange = exchange
        self.repo = SimulationStateRepository(event.simulation_id)
        self.queue: asyncio.Queue[int] = asyncio.Queue()
        self.task: asyncio.Task | None = None
        self.current_order_id: int | None = None
        self.interval_seconds = event.kitchen_interval_seconds
        self.remaining_time = float(self.interval_seconds)
        self.running = True

    def ensure_running(self) -> None:
        if self.running and (self.task is None or self.task.done()):
            self.task = asyncio.create_task(self.work_loop(), name=f"kitchen-{self.simulation_id}")

    async def enqueue(self, order_id: int) -> None:
        await self.repo.push_to_worker_queue("kitchen", order_id)
        await self.queue.put(order_id)
        self.ensure_running()

    async def pause(self) -> None:
        self.running = False
        if self.task is None or self.task.done():
            return
        self.task.cancel()
        try:
            await self.task
        except asyncio.CancelledError:
            pass

    def resume(self) -> None:
        self.running = True
        self.ensure_running()

    async def work_loop(self) -> None:
        while self.running:
            if self.current_order_id is None:
                self.current_order_id = await self.queue.get()
                await self.repo.set_worker_starting_job("kitchen")

            started_at = monotonic()
            try:
                await asyncio.sleep(self.remaining_time)
            except asyncio.CancelledError:
                self.remaining_time = max(0, self.remaining_time - (monotonic() - started_at))
                raise

            event = OrderDoneEvent(
                simulation_id=self.simulation_id,
                order_id=self.current_order_id,
            )
            await self.exchange.publish(
                aio_pika.Message(
                    body=event.model_dump_json().encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="order.done",
            )
            await self.repo.set_worker_finished_job("kitchen")
            self.current_order_id = None
            self.remaining_time = float(self.interval_seconds)


class KitchenWorker:
    def __init__(self, exchange: AbstractRobustExchange):
        self.exchange = exchange
        self.logger = logging.getLogger("KitchenWorker")
        self.simulations: dict[int, KitchenRuntime] = {}

    async def handle_message(self, message: AbstractIncomingMessage) -> None:
        async with message.process():
            routing_key = message.routing_key
            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(message.body)
                previous = self.simulations.get(event.simulation_id)
                if previous is not None:
                    await previous.pause()
                self.simulations[event.simulation_id] = KitchenRuntime(event, self.exchange)
                return

            if routing_key == "simulation.paused":
                event = SimulationPausedEvent.model_validate_json(message.body)
                runtime = self.simulations.get(event.simulation_id)
                if runtime is not None:
                    await runtime.pause()
                return

            if routing_key == "simulation.continued":
                event = SimulationContinuedEvent.model_validate_json(message.body)
                runtime = self.simulations.get(event.simulation_id)
                if runtime is not None:
                    runtime.resume()
                return

            if routing_key == "order.created":
                event = OrderCreatedEvent.model_validate_json(message.body)
                runtime = self.simulations.get(event.simulation_id)
                if runtime is not None:
                    await runtime.enqueue(event.order_id)
                return

            if routing_key == "simulation.updated":
                event = SimulationUpdatedEvent.model_validate_json(message.body)
                runtime = self.simulations.get(event.simulation_id)
                if runtime is None:
                    return
                update = next((item for item in event.workers if item.name == "kitchen"), None)
                if update is not None:
                    runtime.interval_seconds = update.interval
