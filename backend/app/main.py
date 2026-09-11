import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc
from sqlmodel import Session, select

from .analytics import (
    get_event_analysis,
    get_player_summary,
    get_sequence_analysis,
)
from .database import (
    create_db_and_tables,
    get_session,
)
from .models import (
    CompleteGameRequest,
    Decision,
    DecisionCreate,
    DecisionEvent,
    EventCreate,
    Game,
    RiotMatchSnapshot,
    StartGameRequest,
)
from .riot_client import get_recent_match_summaries
from .sync_service import sync_game_with_riot


# ---------------------------------------------------------
# ENVIRONMENT
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(ENV_FILE, override=True)


# ---------------------------------------------------------
# APP
# ---------------------------------------------------------

app = FastAPI(
    title="TFT Decision Lab API",
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)

allowed_origins = [
    origin.strip()
    for origin in frontend_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# STARTUP
# ---------------------------------------------------------

@app.on_event("startup")
def on_startup():
    create_db_and_tables()


# ---------------------------------------------------------
# BASIC ROUTES
# ---------------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "TFT Decision Lab API",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
    }


# ---------------------------------------------------------
# RIOT MATCH HISTORY
# ---------------------------------------------------------

@app.get(
    "/api/player/{game_name}/{tag_line}/matches"
)
def get_player_matches(
    game_name: str,
    tag_line: str,
    count: int = Query(
        default=10,
        ge=1,
        le=20,
    ),
):
    """
    Fetch between 1 and 20 recent Riot TFT matches.
    """

    return get_recent_match_summaries(
        game_name,
        tag_line,
        count,
    )


# ---------------------------------------------------------
# START GAME
# ---------------------------------------------------------

@app.post("/api/games/start")
def start_game(
    request: StartGameRequest,
    session: Session = Depends(get_session),
):
    existing_game = session.exec(
        select(Game)
        .where(
            Game.game_name == request.game_name,
            Game.tag_line == request.tag_line,
            Game.status == "ACTIVE",
        )
        .order_by(desc(Game.started_at))
    ).first()

    if existing_game:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    "An active game already exists "
                    "for this player."
                ),
                "game_id": existing_game.id,
            },
        )

    game = Game(
        game_name=request.game_name,
        tag_line=request.tag_line,
        initial_strategy=request.initial_strategy,
        status="ACTIVE",
    )

    session.add(game)
    session.commit()
    session.refresh(game)

    return {
        "game": game,
    }


# ---------------------------------------------------------
# ACTIVE GAME
# ---------------------------------------------------------

@app.get(
    "/api/games/active/{game_name}/{tag_line}"
)
def get_active_game(
    game_name: str,
    tag_line: str,
    session: Session = Depends(get_session),
):
    game = session.exec(
        select(Game)
        .where(
            Game.game_name == game_name,
            Game.tag_line == tag_line,
            Game.status == "ACTIVE",
        )
        .order_by(desc(Game.started_at))
    ).first()

    return {
        "game": game,
    }


# ---------------------------------------------------------
# GAME HISTORY
# ---------------------------------------------------------

@app.get(
    "/api/games/history/{game_name}/{tag_line}"
)
def get_game_history(
    game_name: str,
    tag_line: str,
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    session: Session = Depends(get_session),
):
    games = session.exec(
        select(Game)
        .where(
            Game.game_name == game_name,
            Game.tag_line == tag_line,
        )
        .order_by(desc(Game.started_at))
        .limit(limit)
    ).all()

    return {
        "games": games,
        "count": len(games),
    }


# ---------------------------------------------------------
# GET ONE GAME
# ---------------------------------------------------------

@app.get("/api/games/{game_id}")
def get_game(
    game_id: int,
    session: Session = Depends(get_session),
):
    game = session.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found.",
        )

    return {
        "game": game,
    }


# ---------------------------------------------------------
# CREATE EVENT
# ---------------------------------------------------------

@app.post(
    "/api/games/{game_id}/events"
)
def create_event(
    game_id: int,
    request: EventCreate,
    session: Session = Depends(get_session),
):
    game = session.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found.",
        )

    if game.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=(
                "Events can only be added "
                "to an active game."
            ),
        )

    # Prevent duplicate events within
    # the same game + stage + round.
    existing_event = session.exec(
        select(DecisionEvent).where(
            DecisionEvent.game_id == game_id,
            DecisionEvent.stage == request.stage,
            DecisionEvent.round == request.round,
            DecisionEvent.event_type
            == request.event_type,
        )
    ).first()

    if existing_event:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"{request.event_type} already "
                    f"exists at Stage "
                    f"{request.stage}-"
                    f"{request.round}."
                ),
                "event_id": existing_event.id,
            },
        )

    event = DecisionEvent(
        game_id=game_id,
        stage=request.stage,
        round=request.round,
        event_type=request.event_type,
        hp=request.hp,
        gold=request.gold,
        level=request.level,
        streak_type=request.streak_type,
        streak_length=request.streak_length,
    )

    session.add(event)
    session.commit()
    session.refresh(event)

    return {
        "event": event,
    }


# ---------------------------------------------------------
# CREATE DECISION
# ---------------------------------------------------------

@app.post(
    "/api/events/{event_id}/decisions"
)
def create_decision(
    event_id: int,
    request: DecisionCreate,
    session: Session = Depends(get_session),
):
    event = session.get(
        DecisionEvent,
        event_id,
    )

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found.",
        )

    game = session.get(
        Game,
        event.game_id,
    )

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found.",
        )

    if game.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=(
                "Decisions can only be added "
                "to an active game."
            ),
        )

    # -----------------------------------------------------
    # DUPLICATE DECISION PROTECTION
    #
    # Same decision type may only occur once
    # during the same game + stage + round.
    # -----------------------------------------------------

    existing_decision = session.exec(
        select(Decision)
        .join(
            DecisionEvent,
            Decision.event_id
            == DecisionEvent.id,
        )
        .where(
            DecisionEvent.game_id
            == event.game_id,
            DecisionEvent.stage
            == event.stage,
            DecisionEvent.round
            == event.round,
            Decision.decision_type
            == request.decision_type,
        )
    ).first()

    if existing_decision:
        raise HTTPException(
            status_code=409,
            detail={
                "message": (
                    f"{request.decision_type} has "
                    f"already been recorded for "
                    f"Stage {event.stage}-"
                    f"{event.round}."
                ),
                "decision_id":
                    existing_decision.id,
                "decision_type":
                    existing_decision.decision_type,
                "stage": event.stage,
                "round": event.round,
            },
        )

    latest_decision = session.exec(
        select(Decision)
        .where(
            Decision.event_id == event_id
        )
        .order_by(
            desc(
                Decision.sequence_order
            )
        )
    ).first()

    if latest_decision:
        sequence_order = (
            latest_decision.sequence_order + 1
        )
    else:
        sequence_order = 1

    decision = Decision(
        game_id=event.game_id,
        event_id=event_id,
        sequence_order=sequence_order,
        decision_type=request.decision_type,
        gold_before=request.gold_before,
        gold_after=request.gold_after,
        level_before=request.level_before,
        level_after=request.level_after,
        notes=request.notes,
    )

    session.add(decision)
    session.commit()
    session.refresh(decision)

    return {
        "decision": decision,
    }


# ---------------------------------------------------------
# MANUAL GAME COMPLETION
# ---------------------------------------------------------

@app.post(
    "/api/games/{game_id}/complete"
)
def complete_game(
    game_id: int,
    request: CompleteGameRequest,
    session: Session = Depends(get_session),
):
    game = session.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found.",
        )

    if game.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Game is already "
                f"{game.status}."
            ),
        )

    game.placement = request.placement
    game.top4 = request.placement <= 4
    game.win = request.placement == 1

    game.riot_match_id = (
        request.riot_match_id
    )

    game.patch = request.patch

    game.status = "COMPLETED"

    game.completed_at = (
        datetime.now(timezone.utc)
    )

    session.add(game)
    session.commit()
    session.refresh(game)

    return {
        "message":
            "Game completed successfully.",
        "game": game,
    }


# ---------------------------------------------------------
# ABANDON GAME
# ---------------------------------------------------------

@app.post(
    "/api/games/{game_id}/abandon"
)
def abandon_game(
    game_id: int,
    session: Session = Depends(get_session),
):
    game = session.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found.",
        )

    if game.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Game is already "
                f"{game.status}."
            ),
        )

    game.status = "ABANDONED"

    game.completed_at = (
        datetime.now(timezone.utc)
    )

    session.add(game)
    session.commit()
    session.refresh(game)

    return {
        "message":
            "Game abandoned successfully.",
        "game": game,
    }


# ---------------------------------------------------------
# TIMELINE
# ---------------------------------------------------------

@app.get(
    "/api/games/{game_id}/timeline"
)
def get_game_timeline(
    game_id: int,
    session: Session = Depends(get_session),
):
    game = session.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found.",
        )

    events = session.exec(
        select(DecisionEvent)
        .where(
            DecisionEvent.game_id
            == game_id
        )
        .order_by(
            DecisionEvent.stage,
            DecisionEvent.round,
            DecisionEvent.created_at,
        )
    ).all()

    timeline = []

    for event in events:
        decisions = session.exec(
            select(Decision)
            .where(
                Decision.event_id
                == event.id
            )
            .order_by(
                Decision.sequence_order
            )
        ).all()

        timeline.append(
            {
                "event": event,
                "decisions": decisions,
            }
        )

    return {
        "game": game,
        "timeline": timeline,
    }


# ---------------------------------------------------------
# RIOT RESULT SYNC
# ---------------------------------------------------------

@app.post(
    "/api/games/{game_id}/sync-riot"
)
def sync_riot_result(
    game_id: int,
    session: Session = Depends(get_session),
):
    return sync_game_with_riot(
        game_id=game_id,
        session=session,
    )


# ---------------------------------------------------------
# DELETE TEST GAME
# ---------------------------------------------------------

@app.delete(
    "/api/games/{game_id}"
)
def delete_game(
    game_id: int,
    session: Session = Depends(get_session),
):
    """
    Permanently delete one Decision Lab game.

    Intended only for local development/testing.

    Deletes:
    - Decisions
    - Events
    - Riot match snapshot
    - Game

    Does NOT delete anything from Riot.
    """

    game = session.get(
        Game,
        game_id,
    )

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found.",
        )

    # -----------------------------------------------------
    # DELETE DECISIONS
    # -----------------------------------------------------

    decisions = session.exec(
        select(Decision).where(
            Decision.game_id == game_id
        )
    ).all()

    for decision in decisions:
        session.delete(decision)

    # -----------------------------------------------------
    # DELETE EVENTS
    # -----------------------------------------------------

    events = session.exec(
        select(DecisionEvent).where(
            DecisionEvent.game_id
            == game_id
        )
    ).all()

    for event in events:
        session.delete(event)

    # -----------------------------------------------------
    # DELETE RIOT SNAPSHOTS
    # -----------------------------------------------------

    snapshots = session.exec(
        select(RiotMatchSnapshot).where(
            RiotMatchSnapshot.game_id
            == game_id
        )
    ).all()

    for snapshot in snapshots:
        session.delete(snapshot)

    # -----------------------------------------------------
    # DELETE GAME
    # -----------------------------------------------------

    session.delete(game)

    session.commit()

    return {
        "message": (
            f"Game #{game_id} deleted "
            "successfully."
        ),
        "game_id": game_id,
    }


# ---------------------------------------------------------
# ANALYTICS SUMMARY
# ---------------------------------------------------------

@app.get(
    "/api/analytics/{game_name}/{tag_line}/summary"
)
def analytics_summary(
    game_name: str,
    tag_line: str,
    session: Session = Depends(get_session),
):
    return get_player_summary(
        session=session,
        game_name=game_name,
        tag_line=tag_line,
    )


# ---------------------------------------------------------
# EVENT ANALYTICS
# ---------------------------------------------------------

@app.get(
    "/api/analytics/{game_name}/{tag_line}/events"
)
def analytics_events(
    game_name: str,
    tag_line: str,
    event_type: str | None = None,
    stage: int | None = None,
    session: Session = Depends(get_session),
):
    return get_event_analysis(
        session=session,
        game_name=game_name,
        tag_line=tag_line,
        event_type=event_type,
        stage=stage,
    )


# ---------------------------------------------------------
# SEQUENCE ANALYTICS
# ---------------------------------------------------------

@app.get(
    "/api/analytics/{game_name}/{tag_line}/sequences"
)
def analytics_sequences(
    game_name: str,
    tag_line: str,
    event_type: str | None = None,
    stage: int | None = None,
    session: Session = Depends(get_session),
):
    return get_sequence_analysis(
        session=session,
        game_name=game_name,
        tag_line=tag_line,
        event_type=event_type,
        stage=stage,
    )