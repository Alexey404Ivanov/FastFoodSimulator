import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.api.dependencies import publisher
from src.events.simulation import (
    SimulationContinuedEvent,
    SimulationPausedEvent,
    SimulationStartedEvent,
    SimulationUpdatedEvent,
)
from src.repositories.redis.provider import RedisProvider
from src.repositories.redis.simulation_state_repository import SimulationStateRepository

router = APIRouter(prefix="/simulation", tags=["simulation"])

@router.get("/state")
async def get_state():
    repo = SimulationStateRepository()
    return await repo.get_state()

@router.get("/settings")
async def get_sim_settings():
    repo = SimulationStateRepository()
    return await repo.get_workers_intervals()

@router.post("/settings")
async def update_sim_settings(body: SimulationUpdatedEvent):
    await publisher.publish(event_name="simulation.updated", event=body)
    # repo = SimulationStateRepository()
    # await repo.update_workers_intervals(body.workers)

@router.post("/start")
async def start_simulation(body: SimulationStartedEvent):
    await publisher.publish(event_name="simulation.started", event=body)
    return {"status": "started"}

@router.post("/continue")
async def continue_simulation():
    await publisher.publish(event_name="simulation.continued", event=SimulationContinuedEvent())
    return {"status": "continued"}


@router.post("/pause")
async def pause_simulation():
    await publisher.publish(event_name="simulation.paused", event=SimulationPausedEvent())
    return {"status": "paused"}


@router.websocket("/api/simulation/1488/events")
async def simulation_ws(websocket: WebSocket, simulation_id: int=1488):
    await websocket.accept()
    redis = await RedisProvider.get_client()

    repo = SimulationStateRepository()
    state = await repo.get_state()

    channel = f"simulation:{simulation_id}:events"

    await websocket.send_json({
        "type": "init",
        "data": state,
    })

    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                payload = json.loads(message["data"])

                await websocket.send_json(payload)

    except asyncio.CancelledError:
        print("WS task cancelled")
        raise

    except WebSocketDisconnect:
        print(f"Client disconnected: {simulation_id}")

    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()