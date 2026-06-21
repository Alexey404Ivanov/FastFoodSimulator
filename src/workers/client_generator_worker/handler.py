import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from repositories.redis.simulation_state_repository import SimulationStateRepository
from src.events.simulation import ClientArrivedEvent, SimulationPausedEvent, SimulationStartedEvent, SimulationUpdatedEvent

class ClientGeneratorHandler:
    def __init__(self, exchange: AbstractRobustExchange):
        self.redis_repo = SimulationStateRepository()
        self.exchange: AbstractRobustExchange = exchange
        self.logger = logging.getLogger("ClientGeneratorHandler")
        self.generator_task: asyncio.Task | None = None
        self.current_client_id = 1
        self.client_interval_seconds = None
        self.remaining_time = None

    async def handle_message(self, message: AbstractIncomingMessage):
        async with message.process():
            routing_key = message.routing_key
            self.logger.info(f"Message \"{routing_key}\" arrived")

            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(
                    message.body.decode()
                )
                self.client_interval_seconds = event.client_interval_seconds
                await self.redis_repo.set_worker_interval(worker_name="client", interval=event.client_interval_seconds)
                self.remaining_time = self.client_interval_seconds
                await self.start_or_resume_generation()

            elif routing_key == "simulation.paused":
                event = SimulationPausedEvent.model_validate_json(message.body.decode())
                await self.pause_generation()

            elif routing_key == "simulation.continued":
                await self.start_or_resume_generation()

            elif routing_key == "simulation.updated":
                event = SimulationUpdatedEvent.model_validate_json(message.body.decode())
                worker_names = (worker_data.name for worker_data in event.workers)
                if "client" not in worker_names:
                    return
                self.client_interval_seconds = next(
                    worker_data.interval for worker_data in event.workers if worker_data.name == "client"
                )
                self.logger.info(f"Interval updated: {self.client_interval_seconds}")
                await self.redis_repo.set_worker_interval(worker_name="client", interval=self.client_interval_seconds)

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
                self.remaining_time = self.client_interval_seconds

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
