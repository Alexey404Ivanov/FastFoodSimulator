import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from src.contracts.simulation import (
    ClientArrivedEvent,
    OrderCreatedEvent,
    SimulationContinuedEvent,
    SimulationPausedEvent,
    SimulationStartedEvent,
    SimulationUpdatedEvent,
)
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository


class CashierRuntime:
    def __init__(self, event: SimulationStartedEvent, exchange: AbstractRobustExchange):
        self.simulation_id = event.simulation_id
        self.exchange = exchange
        self.repo = SimulationStateRepository(event.simulation_id)
        self.queue: asyncio.Queue[int] = asyncio.Queue()
        self.task: asyncio.Task | None = None
        self.current_order_id: int | None = None
        self.interval_seconds = event.cashier_interval_seconds
        self.remaining_time = float(self.interval_seconds)
        self.running = True

    def ensure_running(self) -> None:
        if self.running and (self.task is None or self.task.done()):
            self.task = asyncio.create_task(self.work_loop(), name=f"cashier-{self.simulation_id}")

    async def enqueue(self, client_id: int) -> None:
        await self.repo.push_to_worker_queue("cashier", client_id)
        await self.queue.put(client_id)
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
                await self.repo.set_worker_starting_job("cashier")

            started_at = monotonic()
            try:
                await asyncio.sleep(self.remaining_time)
            except asyncio.CancelledError:
                self.remaining_time = max(0, self.remaining_time - (monotonic() - started_at))
                raise

            event = OrderCreatedEvent(
                simulation_id=self.simulation_id,
                order_id=self.current_order_id,
            )
            await self.exchange.publish(
                aio_pika.Message(
                    body=event.model_dump_json().encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="order.created",
            )
            await self.repo.set_worker_finished_job("cashier")
            self.current_order_id = None
            self.remaining_time = float(self.interval_seconds)


class CashierHandler:
    def __init__(self, exchange: AbstractRobustExchange):
        self.exchange = exchange
        self.logger = logging.getLogger("CashierHandler")
        self.simulations: dict[int, CashierRuntime] = {}

    async def handle_message(self, message: AbstractIncomingMessage) -> None:
        async with message.process():
            routing_key = message.routing_key
            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(message.body)
                previous = self.simulations.get(event.simulation_id)
                if previous is not None:
                    await previous.pause()
                self.simulations[event.simulation_id] = CashierRuntime(event, self.exchange)
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

            if routing_key == "client.arrived":
                event = ClientArrivedEvent.model_validate_json(message.body)
                runtime = self.simulations.get(event.simulation_id)
                if runtime is not None:
                    await runtime.enqueue(event.client_id)
                return

            if routing_key == "simulation.updated":
                event = SimulationUpdatedEvent.model_validate_json(message.body)
                runtime = self.simulations.get(event.simulation_id)
                if runtime is None:
                    return
                update = next((item for item in event.workers if item.name == "cashier"), None)
                if update is not None:
                    runtime.interval_seconds = update.interval
