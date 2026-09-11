from datetime import datetime, timezone
from typing import Literal

from sqlmodel import SQLModel, Field


def utc_now():
    return datetime.now(timezone.utc)


# ==========================================
# GAME
# ==========================================

class Game(SQLModel, table=True):

    id: int | None = Field(
        default=None,
        primary_key=True
    )

    game_name: str = Field(
        index=True
    )

    tag_line: str

    riot_match_id: str | None = Field(
        default=None,
        index=True
    )

    initial_strategy: str = Field(
        index=True
    )

    status: str = Field(
        default="ACTIVE",
        index=True
    )

    started_at: datetime = Field(
        default_factory=utc_now
    )

    completed_at: datetime | None = None

    placement: int | None = None

    top4: bool | None = None

    win: bool | None = None

    patch: str | None = None


# ==========================================
# DECISION EVENT
# ==========================================

class DecisionEvent(SQLModel, table=True):

    id: int | None = Field(
        default=None,
        primary_key=True
    )

    game_id: int = Field(
        foreign_key="game.id",
        index=True
    )

    stage: int

    round: int

    event_type: str = Field(
        index=True
    )

    hp: int | None = None

    gold: int | None = None

    level: int | None = None

    streak_type: str | None = None

    streak_length: int | None = None

    created_at: datetime = Field(
        default_factory=utc_now
    )


# ==========================================
# DECISION
# ==========================================

class Decision(SQLModel, table=True):

    id: int | None = Field(
        default=None,
        primary_key=True
    )

    game_id: int = Field(
        foreign_key="game.id",
        index=True
    )

    event_id: int = Field(
        foreign_key="decisionevent.id",
        index=True
    )

    sequence_order: int

    decision_type: str = Field(
        index=True
    )

    gold_before: int | None = None

    gold_after: int | None = None

    level_before: int | None = None

    level_after: int | None = None

    notes: str | None = None

    created_at: datetime = Field(
        default_factory=utc_now
    )


# ==========================================
# START GAME REQUEST
# ==========================================

class StartGameRequest(SQLModel):

    game_name: str

    tag_line: str

    initial_strategy: Literal[
        "WIN_STREAK",
        "LOSE_STREAK",
        "FLEXIBLE",
        "EXPERIMENT"
    ]


# ==========================================
# EVENT CREATE REQUEST
# ==========================================

class EventCreate(SQLModel):

    stage: int

    round: int

    event_type: str

    hp: int | None = None

    gold: int | None = None

    level: int | None = None

    streak_type: str | None = None

    streak_length: int | None = None


# ==========================================
# DECISION CREATE REQUEST
# ==========================================

class DecisionCreate(SQLModel):

    decision_type: str

    gold_before: int | None = None

    gold_after: int | None = None

    level_before: int | None = None

    level_after: int | None = None

    notes: str | None = None


# ==========================================
# COMPLETE GAME REQUEST
# ==========================================

class CompleteGameRequest(SQLModel):

    placement: int = Field(
        ge=1,
        le=8
    )

    riot_match_id: str | None = None

    patch: str | None = None

    # ==========================================
# RIOT MATCH SNAPSHOT
# ==========================================

class RiotMatchSnapshot(
    SQLModel,
    table=True
):

    id: int | None = Field(
        default=None,
        primary_key=True
    )

    game_id: int = Field(
        foreign_key="game.id",
        index=True
    )

    riot_match_id: str = Field(
        index=True
    )

    game_datetime: int | None = None

    game_version: str | None = None

    level: int | None = None

    last_round: int | None = None

    placement: int | None = None

    units_json: str = "[]"

    traits_json: str = "[]"

    created_at: datetime = Field(
        default_factory=utc_now
    )