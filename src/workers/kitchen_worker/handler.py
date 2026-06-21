import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from src.events.simulation import (
    OrderCreatedEvent,
    OrderDoneEvent,
    SimulationPausedEvent,
    SimulationStartedEvent,
    SimulationUpdatedEvent,
)

from repositories.redis.simulation_state_repository import SimulationStateRepository

class KitchenWorker:
    def __init__(self, exchange: AbstractRobustExchange):
        self.redis_repo = SimulationStateRepository()
        self.exchange: AbstractRobustExchange = exchange
        self.logger = logging.getLogger("KitchenWorker")
        self.order_queue = asyncio.Queue()
        self.work_task: asyncio.Task | None = None
        self.current_order_id = None
        self.kitchen_interval_seconds = None
        self.remaining_time = None

    async def handle_message(self, message: AbstractIncomingMessage):
        async with message.process():
            routing_key = message.routing_key
            self.logger.info(f"Message \"{routing_key}\" arrived")

            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(
                    message.body.decode()
                )
                self.kitchen_interval_seconds = event.kitchen_interval_seconds
                await self.redis_repo.set_worker_interval(worker_name="kitchen", interval=event.kitchen_interval_seconds)
                self.remaining_time = self.kitchen_interval_seconds

            elif routing_key == "simulation.paused":
                event = SimulationPausedEvent.model_validate_json(message.body.decode())
                await self.pause_work()

            elif routing_key == "simulation.continued":
                await self.start_or_resume_work()

            elif routing_key == "order.created":
                event = OrderCreatedEvent.model_validate_json(message.body.decode())

                await self.redis_repo.push_to_worker_queue(worker_name="kitchen", entity_id=event.order_id)
                await self.order_queue.put(event.order_id)

                self.logger.info(f"Order #{event.order_id} put in queue")

                if self.work_task is None or self.work_task.done():
                    self.work_task = asyncio.create_task(self.work_loop())

            elif routing_key == "simulation.updated":
                event = SimulationUpdatedEvent.model_validate_json(message.body.decode())
                worker_names = (worker_data.name for worker_data in event.workers)
                if "kitchen" not in worker_names:
                    return
                self.kitchen_interval_seconds = next(
                    worker_data.interval for worker_data in event.workers if worker_data.name == "kitchen"
                )
                self.logger.info(f"Interval updated: {self.kitchen_interval_seconds}")
                await self.redis_repo.set_worker_interval(worker_name="kitchen", interval=self.kitchen_interval_seconds)


    async def start_or_resume_work(self):
        self.logger.info("Start or resume work")
        self.work_task = asyncio.create_task(
            self.work_loop()
        )

    async def pause_work(self):
        if self.work_task is None:
            self.logger.info(f"Pause non-working kitchen")
            return
        self.work_task.cancel()
        try:
            await self.work_task
        except asyncio.CancelledError:
            self.logger.info(f"Pause work with remaining time - {self.remaining_time} s")


    async def work_loop(self):
        while True:
            if self.current_order_id is None:
                self.current_order_id = await self.order_queue.get()
                await self.redis_repo.set_worker_starting_job(worker_name="kitchen")

            started_at = monotonic()

            try:
                await asyncio.sleep(self.remaining_time)

                self.logger.info(f"Order #{self.current_order_id} done")
                await self._publish(self.current_order_id)
                await self.redis_repo.set_worker_finished_job(worker_name="kitchen")
                self.current_order_id = None
                self.remaining_time = self.kitchen_interval_seconds

            except asyncio.CancelledError:
                elapsed = monotonic() - started_at
                self.remaining_time = max(0, self.remaining_time - elapsed)
                raise

    async def _publish(self, order_id: int):
        event = OrderDoneEvent(order_id=order_id)
        await self.exchange.publish(
            aio_pika.Message(
                body=event.model_dump_json().encode()
            ),
            routing_key="order.done"
        )
