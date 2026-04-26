from src.infrastructure.redis.provider import RedisProvider


class SimulationStateRepository:
    STATUSES = {"running", "paused"}
    QUEUE_NAMES = {"cashier", "kitchen", "waiter", "client"}
    WORKERS_NAMES = {"cashier", "kitchen", "waiter"}

    def __init__(self):
        self.redis = RedisProvider.get_client()

    async def get_state(self, simulation_id: int):
        sim_key = f"simulation:{simulation_id}"
        queue_key = f"simulation:{simulation_id}:cashier_queue"

        simulation = await self.redis.hgetall(sim_key)
        queue = await self.redis.lrange(queue_key, 0, -1)

        simulation["cashier_queue"] = queue

        return simulation

    async def set_status(self, status: str):
        if status not in self.STATUSES:
            return ###

        await self.redis.hset(f"simulation:{1488}", "status", status)

    async def push_to_queue(self, worker_name: str, entity_id: int):
        if worker_name not in self.QUEUE_NAMES:
            return ###

        await self.redis.rpush(f"simulation:{1488}:{worker_name}_queue", entity_id)

    async def pop_from_queue(self, worker_name: str):
        if worker_name not in self.QUEUE_NAMES:
            return ###

        await self.redis.lpop(f"simulation:{1488}:{worker_name}_queue")

    async def set_worker_waiting(self, worker_name: str):
        await self.redis.hset(f"simulation:{1488}",f"{worker_name}_doing", "")

    async def set_processing_entity(self, worker_name: str, entity_id: int):
        await self.redis.hset(f"simulation:{1488}",f"{worker_name}_doing", str(entity_id))
