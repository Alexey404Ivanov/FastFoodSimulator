from typing import Literal

from pydantic import BaseModel


class SimulationStartRequest(BaseModel):
    client_interval_seconds: int
    cashier_interval_seconds: int
    kitchen_interval_seconds: int
    waiter_interval_seconds: int


class SimulationEvent(BaseModel):
    simulation_id: int


class SimulationStartedEvent(SimulationEvent, SimulationStartRequest):
    pass


class SimulationPausedEvent(SimulationEvent):
    reason: str = "manual_pause"


class SimulationContinuedEvent(SimulationEvent):
    reason: str = "manual_continue"


class ClientArrivedEvent(SimulationEvent):
    client_id: int


class OrderCreatedEvent(SimulationEvent):
    order_id: int


class OrderDoneEvent(SimulationEvent):
    order_id: int


class WorkerIntervalUpdateSchema(BaseModel):
    name: Literal["client", "cashier", "kitchen", "waiter"]
    interval: int


class SimulationUpdateRequest(BaseModel):
    workers: list[WorkerIntervalUpdateSchema]


class SimulationUpdatedEvent(SimulationEvent, SimulationUpdateRequest):
    pass
