from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from src.api.dependencies import publisher
from src.contracts.simulation import SimulationContinuedEvent, SimulationPausedEvent, SimulationStartedEvent
from src.infrastructure.redis.simulation_state_repository import SimulationStateRepository

templates = Jinja2Templates(directory="src/templates")

router = APIRouter()

@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@router.get("/simulation/state")
async def get_state():
    repo = SimulationStateRepository()
    return await repo.get_state(1488)

@router.post("/simulation/start")
async def start_simulation(body: SimulationStartedEvent):
    await publisher.publish(event_name="simulation.started", event=body)
    return {"status": "started"}

@router.post("/simulation/continue")
async def continue_simulation():
    await publisher.publish(event_name="simulation.continued", event=SimulationContinuedEvent())
    return {"status": "continued"}


@router.post("/simulation/pause")
async def pause_simulation():
    await publisher.publish(event_name="simulation.paused", event=SimulationPausedEvent())
    return {"status": "paused"}