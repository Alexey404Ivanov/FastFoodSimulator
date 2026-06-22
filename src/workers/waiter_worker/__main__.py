import asyncio
import logging
from os import getenv

import aio_pika
from aio_pika import ExchangeType

from src.infrastructure.redis.provider import RedisProvider
from src.workers.waiter_worker.handler import WaiterHandler


async def main() -> None:
    await RedisProvider.init(getenv("REDIS_URL", "redis://localhost:6379/0"))
    connection = await aio_pika.connect_robust(
        getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/"),
    )
    try:
        channel = await connection.channel()

        queue = await channel.declare_queue("waiter.queue", durable=True, auto_delete=True)
        exchange = await channel.declare_exchange(
            name="simulation.events.exchange",
            type=ExchangeType.TOPIC,
            durable=True,
        )
        handler = WaiterHandler(exchange)

        await queue.bind(exchange, "order.done")
        await queue.bind(exchange, "simulation.*")
        await queue.consume(handler.handle_message)

        await asyncio.Future()

    finally:
        await RedisProvider.close()
        await connection.close()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    asyncio.run(main())
