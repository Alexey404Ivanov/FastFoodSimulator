import asyncio
import logging

import aio_pika
from aio_pika import ExchangeType

from src.workers.kitchen_worker.handler import KitchenWorker


async def main():
    connection = await aio_pika.connect_robust(
        "amqp://admin:admin@localhost:5672/"
    )
    try:
        channel = await connection.channel()

        queue = await channel.declare_queue("kitchen.queue", durable=False, auto_delete=True)
        exchange = await channel.declare_exchange(
            name="simulation.events.exchange",
            type=ExchangeType.TOPIC,
            durable=True
        )
        handler = KitchenWorker(exchange)

        await queue.bind(exchange, "order.created")
        await queue.bind(exchange, "simulation.*")
        await queue.consume(handler.handle_message)

        await asyncio.Future()

    finally:
        await connection.close()

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    asyncio.run(main())