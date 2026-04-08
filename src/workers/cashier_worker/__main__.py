import asyncio
import logging

import aio_pika
from aio_pika import ExchangeType

from src.workers.cashier_worker.handler import CashierHandler


async def main():
    connection = await aio_pika.connect_robust(
        "amqp://admin:admin@localhost:5672/"
    )
    try:
        channel = await connection.channel()

        queue = await channel.declare_queue(
            "cashier.control",
            durable=True
        )
        exchange = await channel.declare_exchange(
            name="simulation.events.exchange",
            type=ExchangeType.TOPIC,
            durable=True
        )
        handler = CashierHandler(exchange)

        await queue.bind(exchange, "client.arrived")
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