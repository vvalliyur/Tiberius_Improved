from pydantic import BaseModel
from datetime import datetime
from pandera import DataFrameModel, Field
from pandera.typing import Series

class BaseTimestamp(BaseModel):
    created_at: datetime
    updated_at: datetime

class GameData(BaseTimestamp):
    rank: int
    game_code: str
    club_code: str
    player_id: str
    player_name: str
    date_started: datetime
    date_ended: datetime
    game_type: str
    big_blind: float
    profit: float
    tips: float
    buy_in: float
    total_tips: float

class Agent(BaseTimestamp):
    agent_id: int
    agent_name: str
    deal_percent: float
    comm_channel: str | None = None
    notes: str | None = None
    payment_methods: str | None = None

class Player(BaseTimestamp):
    player_id: int
    player_name: str
    agent_id: int | None = None
    credit_limit: float | None = None
    notes: str | None = None
    comm_channel: str | None = None
    payment_methods: str | None = None

class AgentReport(BaseModel):
    agent_id: int
    agent_name: str
    total_profit: float
    total_tips: float
    calculated_commission: float  # tips * deal_percent
    game_count: int

class PlayerHistory(BaseModel):
    player_id: int
    player_name: str
    total_profit: float
    total_tips: float
    game_count: int

class User(BaseModel):
    id: str
    email: str | None = None
    user_metadata: dict | None = None

class BaseTimestampS(DataFrameModel):
    created_at: Series[datetime] = Field()
    updated_at: Series[datetime] = Field()

    class Config:
        strict = True
        coerce = True

class GameDataS(BaseTimestampS):
    rank: Series[int] = Field()
    game_code: Series[str] = Field()
    club_code: Series[str] = Field()
    player_id: Series[str] = Field()
    player_name: Series[str] = Field()
    date_started: Series[datetime] = Field() 
    date_ended: Series[datetime] = Field()
    game_type: Series[str] = Field()
    big_blind: Series[float] = Field()
    profit: Series[float] = Field()
    tips: Series[float] = Field()
    buy_in: Series[float] = Field()
    total_tips: Series[float] = Field()
    hands: Series[int] = Field()

    class Config:
        strict = True
        coerce = True

class AgentS(BaseTimestampS):
    agent_id: Series[int] = Field()
    agent_name: Series[str] = Field()
    deal_percent: Series[float] = Field()
    comm_channel: Series[str] = Field(nullable=True)
    notes: Series[str] = Field(nullable=True)
    payment_methods: Series[str] = Field(nullable=True)

    class Config:
        strict = True
        coerce = True

class PlayerS(BaseTimestampS):
    player_id: Series[int] = Field()
    player_name: Series[str] = Field()
    agent_id: Series[int] = Field(nullable=True)
    credit_limit: Series[float] = Field(nullable=True)
    notes: Series[str] = Field(nullable=True)
    comm_channel: Series[str] = Field(nullable=True)
    payment_methods: Series[str] = Field(nullable=True)

    class Config:
        strict = True
        coerce = True

# class AgentReportS(DataFrameModel):
#     """Pandera schema for AgentReport DataFrame."""
#     agent_id: Series[int] = Field()
#     agent_name: Series[str] = Field()
#     total_profit: Series[float] = Field()
#     total_tips: Series[float] = Field()
#     calculated_commission: Series[float] = Field()
#     game_count: Series[int] = Field()

#     class Config:
#         strict = True
#         coerce = True

# class PlayerHistoryS(DataFrameModel):
#     """Pandera schema for PlayerHistory DataFrame."""
#     player_id: Series[int] = Field()
#     player_name: Series[str] = Field()
#     total_profit: Series[float] = Field()
#     total_tips: Series[float] = Field()
#     game_count: Series[int] = Field()

#     class Config:
#         strict = True
#         coerce = True

# class UserS(DataFrameModel):
#     """Pandera schema for User DataFrame."""
#     id: Series[str] = Field()
#     email: Series[str] = Field(nullable=True)
#     user_metadata: Series[object] = Field(nullable=True)  # dict/object type

#     class Config:
#         strict = True
#         coerce = True

GAME_DATA_MAP = {
    "Rank": GameDataS.rank,
    "Player": GameDataS.player_name,
    "ID": GameDataS.player_id,
    "DateStarted": GameDataS.date_started,
    "DateEnded": GameDataS.date_ended,
    "GameType": GameDataS.game_type,
    "BigBlind": GameDataS.big_blind,
    "Profit": GameDataS.profit,
    "Tips": GameDataS.tips,
    "BuyIn": GameDataS.buy_in,
    "TotalTips": GameDataS.total_tips,
    "GameCode": GameDataS.game_code,
    "ClubCode": GameDataS.club_code,
    'Hands': GameDataS.hands
}