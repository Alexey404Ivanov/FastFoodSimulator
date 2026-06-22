import asyncio
import json
from datetime import UTC, datetime

from src.contracts.simulation import WorkerIntervalUpdateSchema
from src.infrastructure.redis.provider import RedisProvider


class SimulationStateRepository:
    STATUSES = {"running", "paused"}
    QUEUE_NAMES = {"cashier", "kitchen", "waiter"}
    WORKER_NAMES = {"client", "cashier", "kitchen", "waiter"}

    def __init__(self, simulation_id: int):
        self.simulation_id = simulation_id
        self.redis = RedisProvider.get_client()
        self.base_key = f"simulation:{simulation_id}"
        self.events_channel = f"{self.base_key}:events"

    async def exists(self) -> bool:
        return bool(await self.redis.exists(self.base_key))

    async def set_worker_interval(self, worker_name: str, interval: int) -> None:
        if worker_name not in self.WORKER_NAMES:
            raise ValueError(f"Unknown worker: {worker_name}")
        await self.redis.set(f"{self.base_key}:{worker_name}_interval", interval)

    async def get_workers_intervals(self) -> dict[str, str | None]:
        workers = ("client", "cashier", "kitchen", "waiter")
        values = await asyncio.gather(
            *(self.redis.get(f"{self.base_key}:{worker}_interval") for worker in workers),
        )
        return {
            f"{worker}_interval": value
            for worker, value in zip(workers, values, strict=True)
        }

    async def update_workers_interval(self, request: list[WorkerIntervalUpdateSchema]) -> None:
        for worker_data in request:
            await self.set_worker_interval(worker_data.name, worker_data.interval)
            await self._publish_event(
                "worker_interval_updated",
                {
                    "worker_name": worker_data.name,
                    "new_interval_value": worker_data.interval,
                },
            )

    async def get_state(self) -> dict:
        status, worked_time, started_at = await asyncio.gather(
            self.redis.hget(self.base_key, "status"),
            self.redis.hget(self.base_key, "worked_time"),
            self.redis.hget(self.base_key, "started_at"),
        )

        state = {
            "simulation_id": self.simulation_id,
            "status": status or "paused",
            "worked_time": worked_time,
            "started_at": started_at,
        }

        for worker in ("cashier", "kitchen", "waiter"):
            doing, queue, started, interval = await asyncio.gather(
                self.redis.hget(f"{self.base_key}:{worker}", "doing"),
                self.redis.lrange(f"{self.base_key}:{worker}:queue", 0, -1),
                self.redis.get(f"{self.base_key}:{worker}_started_work_at"),
                self.redis.get(f"{self.base_key}:{worker}_interval"),
            )
            state[f"{worker}_started_work_at"] = started or None
            state[f"{worker}_interval"] = interval
            state[worker] = {"doing": doing or None, "queue": queue}

        return state

    async def set_status(self, status: str) -> None:
        if status not in self.STATUSES:
            raise ValueError(f"Unknown simulation status: {status}")

        current_status = await self.redis.hget(self.base_key, "status")
        if current_status == status:
            return

        if status == "running":
            await self.redis.hset(self.base_key, "started_at", datetime.now(UTC).isoformat())
        elif current_status == "running":
            started_at_raw, worked_time_raw = await asyncio.gather(
                self.redis.hget(self.base_key, "started_at"),
                self.redis.hget(self.base_key, "worked_time"),
            )
            worked_time = float(worked_time_raw or 0)
            if started_at_raw:
                worked_time += max(
                    0,
                    (datetime.now(UTC) - datetime.fromisoformat(started_at_raw)).total_seconds(),
                )
            await self.redis.hset(self.base_key, "worked_time", str(worked_time))

        await self.redis.hset(self.base_key, "status", status)
        started_at, worked_time = await asyncio.gather(
            self.redis.hget(self.base_key, "started_at"),
            self.redis.hget(self.base_key, "worked_time"),
        )
        await self._publish_event(
            "simulation_status_updated",
            {
                "status": status,
                "started_at": started_at,
                "worked_time": worked_time,
            },
        )

    async def push_to_worker_queue(self, worker_name: str, entity_id: int) -> None:
        self._validate_queue_name(worker_name)
        await self.redis.rpush(f"{self.base_key}:{worker_name}:queue", entity_id)
        await self._publish_event(
            "worker_queue_pushed",
            {"worker_name": worker_name, "entity_id": str(entity_id)},
        )

    async def set_worker_finished_job(self, worker_name: str) -> None:
        self._validate_queue_name(worker_name)
        await asyncio.gather(
            self.redis.hset(f"{self.base_key}:{worker_name}", "doing", ""),
            self.redis.set(f"{self.base_key}:{worker_name}_started_work_at", ""),
        )
        await self._publish_event("worker_finished_job", {"worker_name": worker_name})

    async def set_worker_starting_job(self, worker_name: str) -> str | None:
        self._validate_queue_name(worker_name)
        popped_from_queue = await self.redis.lpop(f"{self.base_key}:{worker_name}:queue")
        if popped_from_queue is None:
            return None

        started_at = datetime.now(UTC).isoformat()
        await asyncio.gather(
            self.redis.hset(f"{self.base_key}:{worker_name}", "doing", popped_from_queue),
            self.redis.set(f"{self.base_key}:{worker_name}_started_work_at", started_at),
        )
        await self._publish_event(
            "worker_started_job",
            {"worker_name": worker_name, "started_work_at": started_at},
        )
        return popped_from_queue

    def _validate_queue_name(self, worker_name: str) -> None:
        if worker_name not in self.QUEUE_NAMES:
            raise ValueError(f"Unknown queue: {worker_name}")

    async def _publish_event(self, event_type: str, data: dict) -> None:
        await self.redis.publish(
            self.events_channel,
            json.dumps({"type": event_type, "data": data}),
        )
