from datetime import UTC, datetime

from src.contracts.simulation import SimulationStartRequest
from src.infrastructure.redis.provider import RedisProvider


class SimulationStateLifecycle:
    ID_SEQUENCE_KEY = "simulations:id_sequence"
    IDS_KEY = "simulations:ids"

    @classmethod
    async def create(cls, settings: SimulationStartRequest) -> int:
        redis = RedisProvider.get_client()
        simulation_id = int(await redis.incr(cls.ID_SEQUENCE_KEY))
        await cls.initialize(simulation_id, settings=settings, running=True)
        return simulation_id

    @classmethod
    async def initialize(
        cls,
        simulation_id: int,
        settings: SimulationStartRequest | None = None,
        *,
        running: bool = False,
    ) -> None:
        redis = RedisProvider.get_client()
        pipe = redis.pipeline()
        base_key = f"simulation:{simulation_id}"
        now = datetime.now(UTC).isoformat()

        pipe.hset(base_key, "status", "running" if running else "paused")
        pipe.hset(base_key, "worked_time", "0")
        pipe.hset(base_key, "created_at", now)
        if running:
            pipe.hset(base_key, "started_at", now)
        pipe.sadd(cls.IDS_KEY, simulation_id)

        for worker in ("cashier", "kitchen", "waiter"):
            pipe.hset(f"{base_key}:{worker}", "doing", "")
            pipe.set(f"{base_key}:{worker}_started_work_at", "")

        intervals = settings.model_dump() if settings is not None else {}
        for worker in ("client", "cashier", "kitchen", "waiter"):
            pipe.set(
                f"{base_key}:{worker}_interval",
                intervals.get(f"{worker}_interval_seconds", ""),
            )

        await pipe.execute()

    @classmethod
    async def cleanup(cls, simulation_id: int) -> None:
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
        pipe.srem(cls.IDS_KEY, simulation_id)

        await pipe.execute()
