from __future__ import annotations

from os import getenv
from typing import TYPE_CHECKING

import aio_pika
from aio_pika import ExchangeType

if TYPE_CHECKING:
    from aio_pika.abc import AbstractRobustExchange

    from src.contracts.simulation import SimulationEvent


class ApiPublisher:
    def __init__(self) -> None:
        self.connection = None
        self.channel = None
        self.exchange: AbstractRobustExchange | None = None

    async def connect(self) -> None:
        self.connection = await aio_pika.connect_robust(
            getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/"),
        )
        self.channel = await self.connection.channel()
        self.exchange = await self.channel.declare_exchange(
            name="simulation.events.exchange",
            type=ExchangeType.TOPIC,
            durable=True,
        )
        bindings = {
            "client_generator.queue": ("simulation.*",),
            "cashier.queue": ("simulation.*", "client.arrived"),
            "kitchen.queue": ("simulation.*", "order.created"),
            "waiter.queue": ("simulation.*", "order.done"),
        }
        for queue_name, routing_keys in bindings.items():
            queue = await self.channel.declare_queue(queue_name, durable=True)
            for routing_key in routing_keys:
                await queue.bind(self.exchange, routing_key)

    async def publish(
        self,
        event_name: str,
        event: SimulationEvent,
    ) -> None:
        await self.exchange.publish(
            aio_pika.Message(
                event.model_dump_json().encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=event_name,
        )

    async def close(self) -> None:
        if self.connection:
            await self.connection.close()
