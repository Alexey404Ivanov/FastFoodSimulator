import json

from src.infrastructure.redis.provider import RedisProvider


class SimulationStateRepository:
    STATUSES = {"running", "paused"}
    QUEUE_NAMES = {"cashier", "kitchen", "waiter", "client"}
    WORKERS_NAMES = {"cashier", "kitchen", "waiter"}

    def __init__(self):
        self.redis = RedisProvider.get_client()

    async def get_state(self):
        data = await self.redis.get(f"simulation:{1488}:state")
        return json.loads(data)

    async def _set_state(self, state: dict):
        await self.redis.set(f"simulation:{1488}:state", json.dumps(state))

    async def set_status(self, status: str):
        if status not in self.STATUSES:
            return

        state = await self.get_state()
        state["status"] = status

        await self._set_state(state)

        await self.redis.publish(
            f"simulation:{1488}:events",
            json.dumps({"type": "simulation_status_changed", "data": {"status": status}}),
        )

    async def push_to_queue(self, worker_name: str, entity_id: int):
        if worker_name not in self.QUEUE_NAMES:
            return

        state = await self.get_state()

        state[worker_name]["queue"].append(str(entity_id))

        await self._set_state(state)

        await self.redis.publish(
            f"simulation:{1488}:events",
            json.dumps({"type": f"pushed_to_{worker_name}_queue", "data": {"queue": state[worker_name]["queue"]}}),
        )

    async def pop_from_queue(self, worker_name: str):
        if worker_name not in self.QUEUE_NAMES:
            return

        state = await self.get_state()

        if not state[worker_name]["queue"]:
            return None

        entity_id = state[worker_name]["queue"].pop(0)

        await self._set_state(state)

        await self.redis.publish(
            f"simulation:{1488}:events",
            json.dumps({"type": f"popped_from_{worker_name}_queue", "data": {"queue": state[worker_name]["queue"]}}),
        )

        return entity_id

    async def set_worker_waiting(self, worker_name: str):
        state = await self.get_state()

        state[worker_name]["doing"] = None

        await self._set_state(state)

        await self.redis.publish(
            f"simulation:{1488}:events", json.dumps({"type": f"{worker_name}_waiting", "data": {}})
        )

    async def set_processing_entity(self, worker_name: str, entity_id: int):
        state = await self.get_state()

        state[worker_name]["doing"] = str(entity_id)

        await self._set_state(state)

        await self.redis.publish(
            f"simulation:{1488}:events",
            json.dumps({"type": f"{worker_name}_started_processing", "data": {"entity_id": str(entity_id)}}),
        )
