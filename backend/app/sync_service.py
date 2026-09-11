import json

from datetime import (
    datetime,
    timezone
)

from fastapi import HTTPException

from sqlmodel import (
    Session,
    select
)

from backend.app.models import (
    Game,
    RiotMatchSnapshot
)

from backend.app.riot_client import (
    get_recent_matches
)


# Allow Riot match timestamps to differ
# from the Decision Lab session start.
#
# V1 uses a generous window because the
# exact timing relationship can vary.

MATCH_TIME_TOLERANCE_MS = (
    90 * 60 * 1000
)


def datetime_to_milliseconds(
    value: datetime
):

    if value.tzinfo is None:

        value = value.replace(
            tzinfo=timezone.utc
        )


    return int(
        value.timestamp() * 1000
    )


def snapshot_to_riot_match(
    snapshot: RiotMatchSnapshot
):

    placement = snapshot.placement


    return {

        "match_id":
            snapshot.riot_match_id,

        "game_datetime":
            snapshot.game_datetime,

        "placement":
            placement,

        "top4":
            None
            if placement is None
            else placement <= 4,

        "win":
            None
            if placement is None
            else placement == 1,

        "level":
            snapshot.level,

        "last_round":
            snapshot.last_round,

        "game_version":
            snapshot.game_version,

        "units":
            json.loads(
                snapshot.units_json
                or "[]"
            ),

        "traits":
            json.loads(
                snapshot.traits_json
                or "[]"
            )
    }


def sync_game_with_riot(
    session: Session,
    game_id: int
):

    # ======================================
    # FIND LOCAL GAME
    # ======================================

    game = session.get(
        Game,
        game_id
    )


    if not game:

        raise HTTPException(
            status_code=404,
            detail="Game not found."
        )


    # ======================================
    # ALREADY SYNCED
    # ======================================

    if game.riot_match_id:

        existing_snapshot = (
            session.exec(
                select(
                    RiotMatchSnapshot
                ).where(
                    RiotMatchSnapshot.game_id
                    == game.id
                )
            )
            .first()
        )


        if not existing_snapshot:

            raise HTTPException(
                status_code=404,
                detail=(
                    "Game has a Riot match ID "
                    "but no Riot snapshot."
                )
            )


        return {

            "message":
                "Game is already synced.",

            "game":
                game,

            "riot_match":
                snapshot_to_riot_match(
                    existing_snapshot
                )
        }


    # ======================================
    # GET RECENT RIOT MATCHES
    # ======================================

    try:

        riot_data = get_recent_matches(
            game.game_name,
            game.tag_line,
            count=10
        )


    except Exception as error:

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not retrieve Riot "
                f"match history: {error}"
            )
        )


    riot_matches = riot_data.get(
        "matches",
        []
    )


    if not riot_matches:

        raise HTTPException(
            status_code=404,
            detail=(
                "No recent Riot matches "
                "were found."
            )
        )


    # ======================================
    # LOCAL SESSION START
    # ======================================

    session_start_ms = (
        datetime_to_milliseconds(
            game.started_at
        )
    )


    # ======================================
    # PREVENT MATCH REUSE
    # ======================================

    existing_snapshots = (
        session.exec(
            select(
                RiotMatchSnapshot
            )
        )
        .all()
    )


    used_match_ids = {

        snapshot.riot_match_id

        for snapshot
        in existing_snapshots
    }


    # ======================================
    # FIND MATCH CANDIDATES
    # ======================================

    candidates = []


    for riot_match in riot_matches:

        match_id = riot_match.get(
            "match_id"
        )

        match_datetime = riot_match.get(
            "game_datetime"
        )


        if not match_id:
            continue


        if match_id in used_match_ids:
            continue


        if match_datetime is None:
            continue


        time_difference = abs(
            match_datetime
            -
            session_start_ms
        )


        if (
            time_difference
            <=
            MATCH_TIME_TOLERANCE_MS
        ):

            candidates.append(
                riot_match
            )


    if not candidates:

        raise HTTPException(
            status_code=404,
            detail=(
                "No completed Riot match "
                "matches this Decision Lab "
                "session yet. If the game "
                "just ended, wait briefly "
                "and try again."
            )
        )


    # ======================================
    # CHOOSE CLOSEST MATCH
    # ======================================

    matched = min(

        candidates,

        key=lambda match:
            abs(
                match["game_datetime"]
                -
                session_start_ms
            )
    )


    placement = matched.get(
        "placement"
    )


    if placement is None:

        raise HTTPException(
            status_code=404,
            detail=(
                "The Riot match does not "
                "contain a placement result."
            )
        )


    # ======================================
    # UPDATE LOCAL GAME
    # ======================================

    game.riot_match_id = (
        matched["match_id"]
    )


    game.placement = (
        placement
    )


    game.top4 = (
        placement <= 4
    )


    game.win = (
        placement == 1
    )


    game.patch = matched.get(
        "game_version"
    )


    game.status = (
        "COMPLETED"
    )


    game.completed_at = (
        datetime.now(
            timezone.utc
        )
    )


    # ======================================
    # RIOT SNAPSHOT
    # ======================================

    snapshot = RiotMatchSnapshot(

        game_id=game.id,

        riot_match_id=
            matched["match_id"],

        game_datetime=
            matched.get(
                "game_datetime"
            ),

        game_version=
            matched.get(
                "game_version"
            ),

        level=
            matched.get(
                "level"
            ),

        last_round=
            matched.get(
                "last_round"
            ),

        placement=
            placement,

        units_json=
            json.dumps(
                matched.get(
                    "units",
                    []
                )
            ),

        traits_json=
            json.dumps(
                matched.get(
                    "traits",
                    []
                )
            )
    )


    session.add(
        game
    )


    session.add(
        snapshot
    )


    session.commit()


    session.refresh(
        game
    )


    session.refresh(
        snapshot
    )


    return {

        "message":
            "Riot match synced successfully.",

        "game":
            game,

        "riot_match":
            matched
    }