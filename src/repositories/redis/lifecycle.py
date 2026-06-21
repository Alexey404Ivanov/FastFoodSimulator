from repositories.redis.provider import RedisProvider


class SimulationStateLifecycle:
    @classmethod
    async def initialize(cls, simulation_id: int):
        redis = RedisProvider.get_client()
        pipe = redis.pipeline()
        base_key = f"simulation:{simulation_id}"

        pipe.hset(base_key, "status", "paused")
        pipe.hset(base_key, "worked_time", "0")

        pipe.hset(f"{base_key}:cashier", "doing", "")
        pipe.hset(f"{base_key}:kitchen", "doing", "")
        pipe.hset(f"{base_key}:waiter", "doing", "")

        pipe.set(f"{base_key}:cashier_started_work_at", "")
        pipe.set(f"{base_key}:kitchen_started_work_at", "")
        pipe.set(f"{base_key}:waiter_started_work_at", "")

        pipe.set(f"{base_key}:cashier_interval", "")
        pipe.set(f"{base_key}:kitchen_interval", "")
        pipe.set(f"{base_key}:waiter_interval", "")

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
            f"{base_key}:cashier_started_work_at",
            f"{base_key}:kitchen_started_work_at",
            f"{base_key}:waiter_started_work_at",
            f"{base_key}:client_interval",
            f"{base_key}:cashier_interval",
            f"{base_key}:kitchen_interval",
            f"{base_key}:waiter_interval",
        ]
        for key in keys_to_delete:
            pipe.delete(key)

        await pipe.execute()
