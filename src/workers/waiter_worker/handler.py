import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from src.contracts.simulation import (
    SimulationPausedEvent,
    SimulationStartedEvent,
    OrderDoneEvent
)
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository


class WaiterHandler:
    def __init__(self, exchange: AbstractRobustExchange):
        self.redis_repo = SimulationStateRepository()
        self.exchange: AbstractRobustExchange = exchange
        self.logger = logging.getLogger("WaiterHandler")
        self.orders_to_deliver_queue = asyncio.Queue()
        self.work_task: asyncio.Task | None = None
        self.current_order_id = None
        self.waiter_interval_seconds = None
        self.remaining_time = None

    async def handle_message(self, message: AbstractIncomingMessage):
        async with message.process():
            routing_key = message.routing_key
            self.logger.info(f"Message \"{routing_key}\" arrived")

            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(
                    message.body.decode()
                )
                await self.redis_repo.set_status("running")

                self.waiter_interval_seconds = event.waiter_interval_seconds
                await self.redis_repo.set_waiter_interval(self.waiter_interval_seconds)

                self.remaining_time = self.waiter_interval_seconds

            elif routing_key == "simulation.paused":
                event = SimulationPausedEvent.model_validate_json(message.body.decode())
                await self.redis_repo.set_status("paused")
                await self.pause_work()

            elif routing_key == "simulation.continued":
                await self.redis_repo.set_status("running")
                await self.start_or_resume_work()

            elif routing_key == "order.done":
                event = OrderDoneEvent.model_validate_json(message.body.decode())

                await self.orders_to_deliver_queue.put(event.order_id)
                await self.redis_repo.push_to_worker_queue(worker_name="waiter", entity_id=event.order_id)

                self.logger.info(f"Client #{event.order_id} put to queue")

                if self.work_task is None or self.work_task.done():
                    self.work_task = asyncio.create_task(self.work_loop())

    async def start_or_resume_work(self):
        self.logger.info("Start or resume work")
        self.work_task = asyncio.create_task(
            self.work_loop()
        )

    async def pause_work(self):
        if self.work_task is None:
            self.logger.info(f"Pause non-working waiter")
            return
        self.work_task.cancel()
        try:
            await self.work_task
        except asyncio.CancelledError:
            self.logger.info(f"Pause work with remaining time - {self.remaining_time} s")


    async def work_loop(self):
        while True:
            if self.current_order_id is None:
                self.current_order_id = await self.orders_to_deliver_queue.get()
                await self.redis_repo.set_worker_starting_job(worker_name="waiter")

            started_at = monotonic()

            try:
                await asyncio.sleep(self.remaining_time)
                self.logger.info(f"Order #{self.current_order_id} delivered")
                # await self._publish(self.current_order_id)
                await self.redis_repo.set_worker_finished_job(worker_name="waiter")
                self.current_order_id = None
                self.remaining_time = self.waiter_interval_seconds

            except asyncio.CancelledError:
                elapsed = monotonic() - started_at
                self.remaining_time = max(0, self.remaining_time - elapsed)
                raise

    # async def _publish(self, order_id: int):
    #     event = OrderCreatedEvent(order_id=order_id)
    #     await self.exchange.publish(
    #         aio_pika.Message(
    #             body=event.model_dump_json().encode()
    #         ),
    #         routing_key="order.created"
    #     )
