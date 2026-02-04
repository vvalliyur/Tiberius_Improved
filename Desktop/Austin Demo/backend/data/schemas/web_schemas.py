from pydantic import BaseModel


class UpsertAgentRequest(BaseModel):
    agent_id: int | None = None
    agent_name: str
    deal_percent: float | None = None  # Optional, defaults to 0.0 on backend
    comm_channel: str | None = None
    notes: str | None = None
    payment_methods: str | None = None

class UpsertPlayerRequest(BaseModel):
    player_id: int | None = None
    player_name: str
    agent_id: int | None = None
    credit_limit: float | None = None
    weekly_credit_adjustment: float = 0.0
    notes: str | None = None
    comm_channel: str | None = None
    payment_methods: str | None = None
    is_blocked: bool = False

class UpsertRealNameRequest(BaseModel):
    id: int | None = None
    player_id: str
    agent_id: int
    real_name: str

class UpsertDealRuleRequest(BaseModel):
    id: int | None = None
    agent_id: int
    threshold: float
    deal_percent: float

