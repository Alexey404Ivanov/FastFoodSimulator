from src.infrastructure.redis.provider import RedisProvider

class SimulationStateLifecycle:
    @classmethod
    async def initialize(cls, simulation_id: int):
        redis = RedisProvider.get_client()
        pipe = redis.pipeline()
        pipe.hset(
        f"simulation:{simulation_id}",
              mapping={
                  "status" : "",
                  "cashier_doing" : ""
              }
        )
        # pipe.set(f"simulation:{simulation_id}:status", "")
        # pipe.set(f"simulation:{simulation_id}:cashier_doing", "")

        await pipe.execute()

    @classmethod
    async def cleanup(cls, simulation_id: int):
        redis = RedisProvider.get_client()
        pipe = redis.pipeline()

        pipe.delete(f"simulation:{simulation_id}:status")
        pipe.delete(f"simulation:{simulation_id}:cashier_doing")

        await pipe.execute()