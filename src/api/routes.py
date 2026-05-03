import asyncio
import json
import time

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates

from src.api.dependencies import publisher
from src.contracts.simulation import SimulationContinuedEvent, SimulationPausedEvent, SimulationStartedEvent
from src.infrastructure.redis.provider import RedisProvider
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository

templates = Jinja2Templates(directory="src/templates")

router = APIRouter()

@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html")

@router.get("/simulation/1488")
async def get_page(request: Request):
    return templates.TemplateResponse(request=request, name="simulation_1488.html")

@router.get("/api/simulation/state")
async def get_state():
    repo = SimulationStateRepository()
    return await repo.get_state()

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

    state_key = f"simulation:{simulation_id}:state"
    channel = f"simulation:{simulation_id}:events"

    # ----------------------
    # 1. Отправляем INIT
    # ----------------------
    state_data = await redis.get(state_key)

    state = json.loads(state_data) if state_data else {}

    await websocket.send_json({
        "type": "init",
        "data": state,
        "server_now": int(time.time() * 1000),  # для таймера
    })

    # ----------------------
    # 2. Подписка на события
    # ----------------------
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True)

            if message:
                data = json.loads(message["data"])
                await websocket.send_json(data)

            # чуть-чуть даём event loop дышать
            await asyncio.sleep(0.01)

    except asyncio.CancelledError:
        print("WS task cancelled")
        raise

    except WebSocketDisconnect:
        print(f"Client disconnected: {simulation_id}")

    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()