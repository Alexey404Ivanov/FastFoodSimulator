import json
from datetime import UTC, datetime, timedelta
from src.contracts.simulation import WorkerIntervalUpdateSchema
from src.infrastructure.redis.provider import RedisProvider


class SimulationStateRepository:
    STATUSES = {"running", "paused"}
    QUEUE_NAMES = {"cashier", "kitchen", "waiter"}
    WORKERS_NAMES = {"cashier", "kitchen", "waiter"}

    def __init__(self):
        self.redis = RedisProvider.get_client()

    async def set_worker_interval(self, worker_name: str, interval: int):
        await self.redis.set(f"simulation:{0}:{worker_name}_interval", interval)


    async def get_workers_intervals(self):
        workers_intervals = {}

        for worker in ["client", "cashier", "kitchen", "waiter"]:
            worker_interval = await self.redis.get(f"simulation:{0}:{worker}_interval")
            workers_intervals[f"{worker}_interval"] = worker_interval

        return workers_intervals

    async def update_workers_interval(self, request: list[WorkerIntervalUpdateSchema]):
        for worker_data in request:
            await self.set_worker_interval(worker_data.name, worker_data.interval)
            await self.redis.publish(
                f"simulation:{0}:events",
                json.dumps(
                    {
                        "type": "worker_interval_updated",
                        "data": {
                            "worker_name": worker_data.name,
                            "new_interval_value": worker_data.interval
                        },
                    }
                ),
            )

    async def get_state(self):
        base_key = f"simulation:{0}"

        status_task = self.redis.hget(base_key, "status")
        worked_time_task = self.redis.hget(base_key, "worked_time")
        started_at_task = self.redis.hget(base_key, "started_at")

        # waiter_started_work_time = self.redis.get(f"{base_key}:waiter_started_work_at")
        # waiter_interval = self.redis.get(f"{base_key}:waiter_interval")

        workers_tasks = {}
        for worker in ["cashier", "kitchen", "waiter"]:
            started_work_time_task = self.redis.get(f"{base_key}:{worker}:started_work_at")
            interval_task = self.redis.get(f"{base_key}:{worker}_interval")
            doing_task = self.redis.hget(f"{base_key}:{worker}", "doing")
            queue_task = self.redis.lrange(f"{base_key}:{worker}:queue", 0, -1)
            workers_tasks[worker] = (doing_task, queue_task, started_work_time_task, interval_task)

        status = await status_task
        worked_time = await worked_time_task
        started_at = await started_at_task

        # waiter_time = await waiter_started_work_time
        # waiter_interval = await waiter_interval

        state = {
            "status": status or "paused",
            # "waiter_started_work_time": waiter_time,
            # "waiter_interval": waiter_interval,
            "worked_time": worked_time,
            "started_at": started_at,
        }

        for worker, (doing_task, queue_task, started_work_time_task, interval_task) in workers_tasks.items():
            doing = await doing_task
            queue = await queue_task
            started = await started_work_time_task
            interval = await interval_task
            state[f"{worker}_started_work_at"] = started
            state[f"{worker}_interval"] = interval
            state[worker] = {"doing": doing or None, "queue": queue}

        return state

    async def set_status(self, status: str):
        if status not in self.STATUSES:
            return

        if status == "running":
            started_at = datetime.now(UTC)
            await self.redis.hset(f"simulation:{0}", "started_at", started_at.isoformat())
        else:
            started_at = await self.redis.hget(f"simulation:{0}", "started_at")
            worked_time = await self.redis.hget(f"simulation:{0}", "worked_time")

            started_at = datetime.fromisoformat(started_at)

            worked_time = timedelta(seconds=float(worked_time))

            worked_time += datetime.now(UTC) - started_at
            await self.redis.hset(f"simulation:{0}", "worked_time", str(worked_time.total_seconds()))

        await self.redis.hset(f"simulation:{0}", "status", status)
        started_at_time = await self.redis.hget(f"simulation:{0}", "started_at")
        time = await self.redis.hget(f"simulation:{0}", "worked_time")
        await self.redis.publish(
            f"simulation:{0}:events",
            json.dumps({
                "type": "simulation_status_updated",
                "data": {
                    "status": status,
                    "started_at": str(started_at_time),
                    "worked_time": time
                }
            }),
        )

    async def push_to_worker_queue(self, worker_name: str, entity_id: int):
        if worker_name not in self.QUEUE_NAMES:
            return

        await self.redis.rpush(f"simulation:{0}:{worker_name}:queue", entity_id)

        await self.redis.publish(
            f"simulation:{0}:events",
            json.dumps({
                "type": "worker_queue_pushed",
                "data": {
                    "worker_name": worker_name,
                    "entity_id": str(entity_id)
                }
            }),
        )

    async def set_worker_finished_job(self, worker_name: str):
        if worker_name not in self.QUEUE_NAMES:
            return

        await self.redis.hset(f"simulation:{0}:{worker_name}", "doing", "")

        await self.redis.publish(
            f"simulation:{0}:events",
            json.dumps({
                "type": "worker_finished_job",
                "data": {
                    "worker_name": worker_name,
                },
            }),
        )

    async def set_worker_starting_job(self, worker_name: str):
        if worker_name not in self.QUEUE_NAMES:
            return

        popped_from_queue = await self.redis.lpop(f"simulation:{0}:{worker_name}:queue")

        await self.redis.hset(f"simulation:{0}:{worker_name}", "doing", popped_from_queue)
        started_at = datetime.now(UTC)
        await self.redis.set(f"simulation:{0}:{worker_name}_started_work_at", started_at.isoformat())
        await self.redis.publish(
            f"simulation:{0}:events",
            json.dumps(
                {
                    "type": "worker_started_job",
                    "data": {
                        "worker_name": worker_name,
                        "started_work_at": started_at.isoformat()
                    },
                },
            ),
        )



