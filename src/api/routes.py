from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates

from src.api.dependencies import publisher
from src.contracts.simulation import SimulationContinuedEvent, SimulationPausedEvent, SimulationStartedEvent
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository

templates = Jinja2Templates(directory="src/templates")

router = APIRouter()

@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="home.html")

@router.get("/simulation/1488")
async def get_page(request: Request):
    return templates.TemplateResponse(request=request, name="simulation_1488.html")

@router.get("api/simulation/state")
async def get_state():
    repo = SimulationStateRepository()
    return await repo.get_state(1488)

@router.post("api/simulation/start")
async def start_simulation(body: SimulationStartedEvent):
    await publisher.publish(event_name="simulation.started", event=body)
    return {"status": "started"}

@router.post("api/simulation/continue")
async def continue_simulation():
    await publisher.publish(event_name="simulation.continued", event=SimulationContinuedEvent())
    return {"status": "continued"}


@router.post("api/simulation/pause")
async def pause_simulation():
    await publisher.publish(event_name="simulation.paused", event=SimulationPausedEvent())
    return {"status": "paused"}


@router.websocket("/api/simulations/{simulation_id}/events")
async def simulation_ws(websocket: WebSocket, simulation_id: int):
    await websocket.accept()

    try:
        # 👉 initial state (пока заглушка)
        await websocket.send_json({
            "type": "init",
            "simulation_id": simulation_id,
            "started_at": 1714123456,
            "server_now": 1714123460,
            "status": "running"
        })

        # 👉 держим соединение живым
        while True:
            data = await websocket.receive_text()

            # пока просто эхо (для теста)
            await websocket.send_text(f"echo: {data}")

    except WebSocketDisconnect:
        print(f"Client disconnected from simulation {simulation_id}")