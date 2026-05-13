import json

from src.infrastructure.redis.provider import RedisProvider

from datetime import datetime, UTC

class SimulationStateRepository:
    STATUSES = {"running", "paused"}
    QUEUE_NAMES = {"cashier", "kitchen", "waiter"}
    WORKERS_NAMES = {"cashier", "kitchen", "waiter"}

    def __init__(self):
        self.redis = RedisProvider.get_client()

    async def set_waiter_interval(self, waiter_interval: int):
        await self.redis.set(f"simulation:{1488}:waiter_interval", waiter_interval)

    async def get_state(self):
        """Собираем полное состояние за один RTT через pipeline"""
        base_key = f"simulation:{1488}"

        # Запускаем все запросы параллельно
        status_task = self.redis.hget(base_key, "status")

        waiter_started_work_time = self.redis.get(f"{base_key}:waiter_started_work_at")
        waiter_interval = self.redis.get(f"{base_key}:waiter_interval")

        workers_tasks = {}
        for worker in ["cashier", "kitchen", "waiter"]:
            doing_task = self.redis.hget(f"{base_key}:{worker}", "doing")
            queue_task = self.redis.lrange(f"{base_key}:{worker}:queue", 0, -1)
            workers_tasks[worker] = (doing_task, queue_task)

        # Ждём все результаты
        status = await status_task
        waiter_time = await waiter_started_work_time
        waiter_interval = await waiter_interval
        state = {
            "status": status or "paused",
            "waiter_started_work_time": waiter_time,
            "waiter_interval": waiter_interval
        }

        for worker, (doing_task, queue_task) in workers_tasks.items():
            doing = await doing_task
            queue = await queue_task
            state[worker] = {"doing": doing or None, "queue": queue}

        return state

    async def set_status(self, status: str):
        if status not in self.STATUSES:
            return

        await self.redis.hset(f"simulation:{1488}", "status", status)
        await self.redis.publish(
            f"simulation:{1488}:events",
            json.dumps({
                "type": "simulation_status_updated",
                "data": {
                    "status": status
                }
            }),
        )

    async def push_to_worker_queue(self, worker_name: str, entity_id: int):
        if worker_name not in self.QUEUE_NAMES:
            return

        await self.redis.rpush(f"simulation:{1488}:{worker_name}:queue", entity_id)

        await self.redis.publish(
            f"simulation:{1488}:events",
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

        await self.redis.hset(f"simulation:{1488}:{worker_name}", "doing", "")

        await self.redis.publish(
            f"simulation:{1488}:events",
            json.dumps({
                "type": "worker_finished_job",
                "data": {
                    "worker_name": worker_name
                }
            })
        )

    async def set_worker_starting_job(self, worker_name: str):
        if worker_name not in self.QUEUE_NAMES:
            return

        popped_from_queue = await self.redis.lpop(f"simulation:{1488}:{worker_name}:queue")
        if worker_name == "waiter":
            await self.redis.hset(f"simulation:{1488}:{worker_name}", "doing", popped_from_queue)
            started_at = datetime.now(UTC)
            await self.redis.set(f"simulation:{1488}:waiter_started_work_at", started_at.isoformat())
            await self.redis.publish(
                f"simulation:{1488}:events",
                json.dumps({
                    "type": "worker_started_job",
                    "data": {
                        "worker_name": worker_name,
                        "waiter_started_work_at": started_at.isoformat()
                    }
                }),
            )


        else:
            await self.redis.hset(f"simulation:{1488}:{worker_name}", "doing", popped_from_queue)
            await self.redis.publish(
                f"simulation:{1488}:events",
                json.dumps({
                    "type": "worker_started_job",
                    "data": {
                        "worker_name": worker_name
                    }
                }),
            )

