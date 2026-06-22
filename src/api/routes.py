import asyncio
import json

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.templating import Jinja2Templates

from src.api.dependencies import publisher
from src.contracts.simulation import (
    SimulationContinuedEvent,
    SimulationPausedEvent,
    SimulationStartedEvent,
    SimulationStartRequest,
    SimulationUpdatedEvent,
    SimulationUpdateRequest,
)
from src.infrastructure.redis.lifecycle import SimulationStateLifecycle
from src.infrastructure.redis.provider import RedisProvider
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository

templates = Jinja2Templates(directory="src/templates")
router = APIRouter()


async def get_simulation_repository(simulation_id: int) -> SimulationStateRepository:
    repo = SimulationStateRepository(simulation_id)
    if not await repo.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation not found")
    return repo


@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html")


@router.get("/simulation/{simulation_id}")
async def get_page(request: Request, simulation_id: int):
    await get_simulation_repository(simulation_id)
    return templates.TemplateResponse(
        request=request,
        name="simulation_0.html",
        context={"simulation_id": simulation_id},
    )


@router.get("/api/simulation/{simulation_id}/state")
async def get_state(simulation_id: int):
    repo = await get_simulation_repository(simulation_id)
    return await repo.get_state()


@router.get("/api/simulation/{simulation_id}/settings")
async def get_sim_settings(simulation_id: int):
    repo = await get_simulation_repository(simulation_id)
    return await repo.get_workers_intervals()


@router.post("/api/simulation/{simulation_id}/settings")
async def update_sim_settings(simulation_id: int, body: SimulationUpdateRequest):
    repo = await get_simulation_repository(simulation_id)
    event = SimulationUpdatedEvent(simulation_id=simulation_id, **body.model_dump())
    await publisher.publish(event_name="simulation.updated", event=event)
    await repo.update_workers_interval(body.workers)
    return {"status": "updated", "simulation_id": simulation_id}


@router.post("/api/simulation/start")
async def start_simulation(body: SimulationStartRequest):
    simulation_id = await SimulationStateLifecycle.create(body)
    event = SimulationStartedEvent(simulation_id=simulation_id, **body.model_dump())
    try:
        await publisher.publish(event_name="simulation.started", event=event)
    except Exception:
        await SimulationStateLifecycle.cleanup(simulation_id)
        raise
    return {"status": "started", "simulation_id": simulation_id}


@router.post("/api/simulation/{simulation_id}/continue")
async def continue_simulation(simulation_id: int):
    repo = await get_simulation_repository(simulation_id)
    await publisher.publish(
        event_name="simulation.continued",
        event=SimulationContinuedEvent(simulation_id=simulation_id),
    )
    await repo.set_status("running")
    return {"status": "continued", "simulation_id": simulation_id}


@router.post("/api/simulation/{simulation_id}/pause")
async def pause_simulation(simulation_id: int):
    repo = await get_simulation_repository(simulation_id)
    await publisher.publish(
        event_name="simulation.paused",
        event=SimulationPausedEvent(simulation_id=simulation_id),
    )
    await repo.set_status("paused")
    return {"status": "paused", "simulation_id": simulation_id}


@router.websocket("/api/simulation/{simulation_id}/events")
async def simulation_ws(websocket: WebSocket, simulation_id: int):
    repo = SimulationStateRepository(simulation_id)
    if not await repo.exists():
        await websocket.close(code=1008, reason="Simulation not found")
        return

    await websocket.accept()
    redis = RedisProvider.get_client()
    pubsub = redis.pubsub()
    await pubsub.subscribe(repo.events_channel)
    await websocket.send_json({"type": "init", "data": await repo.get_state()})
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_json(json.loads(message["data"]))
    except asyncio.CancelledError:
        raise
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(repo.events_channel)
        await pubsub.aclose()
