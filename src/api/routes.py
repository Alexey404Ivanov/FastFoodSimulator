import asyncio
import json

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates
from typing import Annotated
from fastapi import Depends

from src.api.dependencies import publisher, get_user_service
from src.events.simulation import SimulationContinuedEvent, SimulationPausedEvent, SimulationStartedEvent, SimulationUpdatedEvent
from src.infrastructure.redis.provider import RedisProvider
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository

from src.schemas.user_schemas import UserAddSchema

from src.services.users_service import UsersService

templates = Jinja2Templates(directory="src/templates")

router = APIRouter()

# user_service = Annotated[
#     UsersService,
#     Depends(get_user_service)
# ]

@router.post("/users")
async def create_user(
    user: UserAddSchema,
    user_service: Annotated[UsersService, Depends(get_user_service)]
):
    response = await user_service.add_user(user)
    return response

@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html")

@router.get("/simulation/1488")
async def get_page(request: Request):
    return templates.TemplateResponse(request=request, name="simulation_1488.html")

@router.get("/simulation/state")
async def get_state():
    repo = SimulationStateRepository()
    return await repo.get_state()

@router.get("/api/simulation/settings")
async def get_sim_settings():
    repo = SimulationStateRepository()
    return await repo.get_workers_intervals()

@router.post("/api/simulation/settings")
async def update_sim_settings(body: SimulationUpdatedEvent):
    await publisher.publish(event_name="simulation.updated", event=body)
    # repo = SimulationStateRepository()
    # await repo.update_workers_intervals(body.workers)

@router.post("/api/simulation/start")
async def start_simulation(body: SimulationStartedEvent):
    await publisher.publish(event_name="simulation.started", event=body)
    return {"status": "started"}

@router.post("/api/simulation/continue")
async def continue_simulation():
    await publisher.publish(event_name="simulation.continued", event=SimulationContinuedEvent())
    return {"status": "continued"}


@router.post("/api/simulation/pause")
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