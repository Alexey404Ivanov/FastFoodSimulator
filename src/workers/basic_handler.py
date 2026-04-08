import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from src.contracts.simulation import ClientArrivedEvent, SimulationPausedEvent, SimulationStartedEvent


class BasicHandler():
    def __init__(self, exchange: AbstractRobustExchange):
        self.exchange: AbstractRobustExchange = exchange
        self.logger = logging.getLogger(__name__)
        self.generator_task: asyncio.Task | None = None
        self.work_interval = None
        self.remaining_time = None

    async def handle_message(self, message: AbstractIncomingMessage):
        async with message.process():
            routing_key = message.routing_key
            self.logger.info(f"Message \"{routing_key}\" arrived")

            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(
                    message.body.decode()
                )
                self.work_interval = event.client_interval_seconds
                self.remaining_time = self.work_interval
                await self.start_or_resume_generation()

            elif routing_key == "simulation.paused":
                event = SimulationPausedEvent.model_validate_json(message.body.decode())
                await self.pause_generation()

            elif routing_key == "simulation.continued":
                await self.start_or_resume_generation()

    async def start_or_resume_generation(self):
        self.logger.info("Start or continue generation")
        self.generator_task = asyncio.create_task(
            self.generate()
        )

    async def pause_generation(self):
        # self.logger.info("Pause generation")
        self.generator_task.cancel()
        try:
            await self.generator_task
        except asyncio.CancelledError:
            self.logger.info(f"Pause generation with remaining time - {self.remaining_time} s")


    async def generate(self):
        while True:
            started_at = monotonic()
            try:
                await asyncio.sleep(self.remaining_time)
                self.logger.info(f"Client #{self.current_client_id} arrived")
                await self._publish()
                self.current_client_id += 1
                self.remaining_time = self.work_interval

            except asyncio.CancelledError:
                elapsed = monotonic() - started_at
                self.remaining_time -= elapsed
                raise



    async def _publish(self):
        event = ClientArrivedEvent(client_id=self.current_client_id)
        await self.exchange.publish(
            aio_pika.Message(
                body=event.model_dump_json().encode()
            ),
            routing_key="client.arrived"
        )
