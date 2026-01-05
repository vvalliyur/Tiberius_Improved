from pydantic import BaseModel


class UpsertAgentRequest(BaseModel):
    agent_id: int | None = None
    agent_name: str
    deal_percent: float
    comm_channel: str | None = None
    notes: str | None = None
    payment_methods: str | None = None

class UpsertPlayerRequest(BaseModel):
    player_id: int | None = None
    player_name: str
    agent_id: int | None = None
    credit_limit: float | None = None
    notes: str | None = None
    comm_channel: str | None = None
    payment_methods: str | None = None

