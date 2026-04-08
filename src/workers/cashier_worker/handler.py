import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from src.contracts.simulation import (
    ClientArrivedEvent,
    OrderCreatedEvent,
    SimulationPausedEvent,
    SimulationStartedEvent,
)


class CashierHandler:
    def __init__(self, exchange: AbstractRobustExchange):
        self.exchange: AbstractRobustExchange = exchange
        self.logger = logging.getLogger("CashierHandler")
        self.client_queue = asyncio.Queue()
        self.work_task: asyncio.Task | None = None
        self.current_order_id = None
        self.cashier_interval_seconds = None
        self.remaining_time = None

    async def handle_message(self, message: AbstractIncomingMessage):
        async with message.process():
            routing_key = message.routing_key
            self.logger.info(f"Message \"{routing_key}\" arrived")

            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(
                    message.body.decode()
                )
                self.cashier_interval_seconds = event.cashier_interval_seconds
                self.remaining_time = self.cashier_interval_seconds

            elif routing_key == "simulation.paused":
                event = SimulationPausedEvent.model_validate_json(message.body.decode())
                await self.pause_work()

            elif routing_key == "simulation.continued":
                await self.start_or_resume_work()

            elif routing_key == "client.arrived":
                event = ClientArrivedEvent.model_validate_json(message.body.decode())

                await self.client_queue.put(event.client_id)

                if self.work_task is None or self.work_task.done():
                    self.work_task = asyncio.create_task(self.work_loop())

    async def start_or_resume_work(self):
        self.logger.info("Start or resume work")
        self.work_task = asyncio.create_task(
            self.work_loop()
        )

    async def pause_work(self):
        self.work_task.cancel()
        try:
            await self.work_task
        except asyncio.CancelledError:
            self.logger.info(f"Pause work with remaining time - {self.remaining_time} s")


    async def work_loop(self):
        while True:
            order_id = await self.client_queue.get()

            started_at = monotonic()

            try:
                await asyncio.sleep(self.remaining_time)

                self.logger.info(f"Order #{order_id} created")
                await self._publish(order_id)

                self.remaining_time = self.cashier_interval_seconds

            except asyncio.CancelledError:
                elapsed = monotonic() - started_at
                self.remaining_time = max(0, self.remaining_time - elapsed)
                raise

    async def _publish(self, order_id: int):
        event = OrderCreatedEvent(order_id=order_id)
        await self.exchange.publish(
            aio_pika.Message(
                body=event.model_dump_json().encode()
            ),
            routing_key="order.created"
        )
