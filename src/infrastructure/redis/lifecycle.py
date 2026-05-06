import json

from src.infrastructure.redis.provider import RedisProvider


class SimulationStateLifecycle:
    @classmethod
    async def initialize(cls, simulation_id: int):
        redis = RedisProvider.get_client()
        key = f"simulation:{simulation_id}:state"
        state = {
            "status": "paused",
            "cashier": {
                "doing": None,
                "queue": []
            },
            "kitchen": {
                "doing": None,
                "queue": []
            },
            "waiter": {
                "doing": None,
                "queue": []
            }
        }
        await redis.set(key, json.dumps(state))


    @classmethod
    async def cleanup(cls, simulation_id: int):
        redis = RedisProvider.get_client()

        await redis.delete(f"simulation:{simulation_id}:state")