import asyncio
import logging
from time import monotonic

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustExchange

from src.contracts.simulation import (
    ClientArrivedEvent,
    SimulationContinuedEvent,
    SimulationPausedEvent,
    SimulationStartedEvent,
    SimulationUpdatedEvent,
)


class ClientGeneratorRuntime:
    def __init__(self, event: SimulationStartedEvent, exchange: AbstractRobustExchange):
        self.simulation_id = event.simulation_id
        self.exchange = exchange
        self.interval_seconds = event.client_interval_seconds
        self.remaining_time = float(self.interval_seconds)
        self.current_client_id = 1
        self.running = True
        self.task: asyncio.Task | None = None

    def ensure_running(self) -> None:
        if self.running and (self.task is None or self.task.done()):
            self.task = asyncio.create_task(
                self.generate(),
                name=f"client-generator-{self.simulation_id}",
            )

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

    async def generate(self) -> None:
        while self.running:
            started_at = monotonic()
            try:
                await asyncio.sleep(self.remaining_time)
            except asyncio.CancelledError:
                self.remaining_time = max(0, self.remaining_time - (monotonic() - started_at))
                raise

            event = ClientArrivedEvent(
                simulation_id=self.simulation_id,
                client_id=self.current_client_id,
            )
            await self.exchange.publish(
                aio_pika.Message(
                    body=event.model_dump_json().encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="client.arrived",
            )
            self.current_client_id += 1
            self.remaining_time = float(self.interval_seconds)


class ClientGeneratorHandler:
    def __init__(self, exchange: AbstractRobustExchange):
        self.exchange = exchange
        self.logger = logging.getLogger("ClientGeneratorHandler")
        self.simulations: dict[int, ClientGeneratorRuntime] = {}

    async def handle_message(self, message: AbstractIncomingMessage) -> None:
        async with message.process():
            routing_key = message.routing_key
            if routing_key == "simulation.started":
                event = SimulationStartedEvent.model_validate_json(message.body)
                previous = self.simulations.get(event.simulation_id)
                if previous is not None:
                    await previous.pause()
                runtime = ClientGeneratorRuntime(event, self.exchange)
                self.simulations[event.simulation_id] = runtime
                runtime.ensure_running()
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

            if routing_key == "simulation.updated":
                event = SimulationUpdatedEvent.model_validate_json(message.body)
                runtime = self.simulations.get(event.simulation_id)
                if runtime is None:
                    return
                update = next((item for item in event.workers if item.name == "client"), None)
                if update is not None:
                    runtime.interval_seconds = update.interval
