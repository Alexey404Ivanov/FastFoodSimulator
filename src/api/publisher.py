import aio_pika
from aio_pika import ExchangeType
from aio_pika.abc import AbstractRobustExchange

from src.contracts.simulation import *


class ApiPublisher:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.exchange: AbstractRobustExchange | None = None

    async def connect(self):
        self.connection = await aio_pika.connect_robust("amqp://admin:admin@localhost:5672")
        self.channel = await self.connection.channel()
        self.exchange = await self.channel.declare_exchange(
            name="simulation.events.exchange",
            type=ExchangeType.TOPIC,
            durable=True
        )

    async def publish(self, event_name: str, event: SimulationPausedEvent | SimulationStartedEvent | SimulationContinuedEvent):
        await self.exchange.publish(
            aio_pika.Message(
                event.model_dump_json().encode(),
            ),
            routing_key=event_name
        )

    async def close(self):
        if self.connection:
            await self.connection.close()

