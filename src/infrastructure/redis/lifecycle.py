import json

from src.infrastructure.redis.provider import RedisProvider


class SimulationStateLifecycle:
    @classmethod
    async def initialize(cls, simulation_id: int):
        redis = RedisProvider.get_client()
        pipe = redis.pipeline()
        base_key = f"simulation:{simulation_id}"
        # Общее состояние
        pipe.hset(base_key, "status", "paused")

        # Кассир
        pipe.hset(f"{base_key}:cashier", "doing", "")
        # Очередь не нужно инициализировать явно — она появится при первом RPUSH

        # Кухня
        pipe.hset(f"{base_key}:kitchen", "doing", "")

        # Официант
        pipe.hset(f"{base_key}:waiter", "doing", "")

        # Выполняем все к
        await pipe.execute()


    @classmethod
    async def cleanup(cls, simulation_id: int):
        redis = RedisProvider.get_client()
        base_key = f"simulation:{simulation_id}"
        pipe = redis.pipeline()
        keys_to_delete = [
            base_key,
            f"{base_key}:cashier",
            f"{base_key}:cashier:queue",
            f"{base_key}:kitchen",
            f"{base_key}:kitchen:queue",
            f"{base_key}:waiter",
            f"{base_key}:waiter:queue",
        ]
        for key in keys_to_delete:
            pipe.delete(key)

        await pipe.execute()
