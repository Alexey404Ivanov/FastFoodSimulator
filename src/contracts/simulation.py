from pydantic import BaseModel


class SimulationStartedEvent(BaseModel):
    client_interval_seconds: int
    cashier_interval_seconds: int
    kitchen_interval_seconds: int
    waiter_interval_seconds: int

class SimulationPausedEvent(BaseModel):
    reason: str = "manual_pause"

class SimulationContinuedEvent(BaseModel):
    reason: str = "manual_continue"

class ClientArrivedEvent(BaseModel):
    client_id: int

class OrderCreatedEvent(BaseModel):
    order_id: int