from collections import defaultdict

from sqlmodel import Session, select

from backend.app.models import (
    Game,
    DecisionEvent,
    Decision
)


def percent(
    numerator: int,
    denominator: int
):

    if denominator == 0:
        return 0.0

    return round(
        numerator / denominator * 100,
        1
    )


def calculate_average_placement(games):

    placements = [
        game.placement
        for game in games
        if game.placement is not None
    ]

    if not placements:
        return None

    return round(
        sum(placements) / len(placements),
        2
    )


# ==========================================
# GET COMPLETED GAMES
# ==========================================

def get_completed_games(
    session: Session,
    game_name: str,
    tag_line: str
):

    statement = (
        select(Game)
        .where(
            Game.game_name == game_name,
            Game.tag_line == tag_line,
            Game.status == "COMPLETED"
        )
    )

    return session.exec(
        statement
    ).all()


# ==========================================
# PLAYER SUMMARY
# ==========================================

def get_player_summary(
    session: Session,
    game_name: str,
    tag_line: str
):

    games = get_completed_games(
        session,
        game_name,
        tag_line
    )

    total_games = len(games)

    top4_count = sum(
        1
        for game in games
        if game.top4
    )

    win_count = sum(
        1
        for game in games
        if game.win
    )


    # --------------------------------------
    # Group games by opening intention
    # --------------------------------------

    strategy_groups = defaultdict(list)

    for game in games:

        strategy_groups[
            game.initial_strategy
        ].append(game)


    strategy_results = []


    for strategy, strategy_games in strategy_groups.items():

        number_of_games = len(
            strategy_games
        )

        top4_games = sum(
            1
            for game in strategy_games
            if game.top4
        )

        wins = sum(
            1
            for game in strategy_games
            if game.win
        )


        strategy_results.append(
            {
                "strategy": strategy,

                "games":
                    number_of_games,

                "top4_rate":
                    percent(
                        top4_games,
                        number_of_games
                    ),

                "win_rate":
                    percent(
                        wins,
                        number_of_games
                    ),

                "average_placement":
                    calculate_average_placement(
                        strategy_games
                    )
            }
        )


    return {
        "games":
            total_games,

        "top4_rate":
            percent(
                top4_count,
                total_games
            ),

        "win_rate":
            percent(
                win_count,
                total_games
            ),

        "average_placement":
            calculate_average_placement(
                games
            ),

        "opening_strategies":
            strategy_results
    }


# ==========================================
# EVENT / FIRST RESPONSE ANALYSIS
# ==========================================

def get_event_analysis(
    session: Session,
    game_name: str,
    tag_line: str,
    event_type: str,
    stage: int | None = None
):

    games = get_completed_games(
        session,
        game_name,
        tag_line
    )


    game_map = {
        game.id: game
        for game in games
        if game.id is not None
    }


    if not game_map:

        return {
            "event_type":
                event_type,

            "stage":
                stage,

            "occurrences":
                0,

            "responses":
                []
        }


    game_ids = list(
        game_map.keys()
    )


    event_query = (
        select(DecisionEvent)
        .where(
            DecisionEvent.game_id.in_(
                game_ids
            ),
            DecisionEvent.event_type
            == event_type
        )
    )


    if stage is not None:

        event_query = event_query.where(
            DecisionEvent.stage == stage
        )


    events = session.exec(
        event_query
    ).all()


    decision_query = (
        select(Decision)
        .where(
            Decision.game_id.in_(
                game_ids
            )
        )
        .order_by(
            Decision.sequence_order
        )
    )


    decisions = session.exec(
        decision_query
    ).all()


    decisions_by_event = defaultdict(list)


    for decision in decisions:

        decisions_by_event[
            decision.event_id
        ].append(
            decision
        )


    response_results = defaultdict(list)


    for event in events:

        event_decisions = (
            decisions_by_event[
                event.id
            ]
        )


        if event_decisions:

            # First action taken
            # after the situation occurred.

            response_name = (
                event_decisions[0]
                .decision_type
            )

        else:

            response_name = (
                "NO_RECORDED_DECISION"
            )


        game = game_map.get(
            event.game_id
        )


        if game:

            response_results[
                response_name
            ].append(
                game
            )


    response_stats = []


    for response, response_games in response_results.items():

        occurrences = len(
            response_games
        )

        top4_count = sum(
            1
            for game in response_games
            if game.top4
        )

        wins = sum(
            1
            for game in response_games
            if game.win
        )


        response_stats.append(
            {
                "decision_type":
                    response,

                "occurrences":
                    occurrences,

                "decision_percentage":
                    percent(
                        occurrences,
                        len(events)
                    ),

                "top4_rate":
                    percent(
                        top4_count,
                        occurrences
                    ),

                "win_rate":
                    percent(
                        wins,
                        occurrences
                    ),

                "average_placement":
                    calculate_average_placement(
                        response_games
                    )
            }
        )


    response_stats.sort(
        key=lambda result:
            result["occurrences"],
        reverse=True
    )


    return {
        "event_type":
            event_type,

        "stage":
            stage,

        "occurrences":
            len(events),

        "responses":
            response_stats
    }


# ==========================================
# DECISION SEQUENCE ANALYSIS
# ==========================================

def get_sequence_analysis(
    session: Session,
    game_name: str,
    tag_line: str,
    event_type: str,
    stage: int | None = None
):

    games = get_completed_games(
        session,
        game_name,
        tag_line
    )


    game_map = {
        game.id: game
        for game in games
        if game.id is not None
    }


    if not game_map:

        return {
            "event_type":
                event_type,

            "stage":
                stage,

            "sequences":
                []
        }


    game_ids = list(
        game_map.keys()
    )


    event_query = (
        select(DecisionEvent)
        .where(
            DecisionEvent.game_id.in_(
                game_ids
            ),
            DecisionEvent.event_type
            == event_type
        )
    )


    if stage is not None:

        event_query = event_query.where(
            DecisionEvent.stage == stage
        )


    events = session.exec(
        event_query
    ).all()


    decision_query = (
        select(Decision)
        .where(
            Decision.game_id.in_(
                game_ids
            )
        )
        .order_by(
            Decision.sequence_order
        )
    )


    decisions = session.exec(
        decision_query
    ).all()


    decisions_by_event = defaultdict(list)


    for decision in decisions:

        decisions_by_event[
            decision.event_id
        ].append(
            decision
        )


    sequence_results = defaultdict(list)


    for event in events:

        event_decisions = (
            decisions_by_event[
                event.id
            ]
        )


        if event_decisions:

            sequence_name = " → ".join(
                decision.decision_type
                for decision
                in event_decisions
            )

        else:

            sequence_name = (
                "NO_RECORDED_DECISION"
            )


        game = game_map.get(
            event.game_id
        )


        if game:

            sequence_results[
                sequence_name
            ].append(
                game
            )


    sequence_stats = []


    for sequence, sequence_games in sequence_results.items():

        occurrences = len(
            sequence_games
        )

        top4_count = sum(
            1
            for game in sequence_games
            if game.top4
        )

        wins = sum(
            1
            for game in sequence_games
            if game.win
        )


        sequence_stats.append(
            {
                "sequence":
                    sequence,

                "occurrences":
                    occurrences,

                "top4_rate":
                    percent(
                        top4_count,
                        occurrences
                    ),

                "win_rate":
                    percent(
                        wins,
                        occurrences
                    ),

                "average_placement":
                    calculate_average_placement(
                        sequence_games
                    )
            }
        )


    sequence_stats.sort(
        key=lambda result:
            result["occurrences"],
        reverse=True
    )


    return {
        "event_type":
            event_type,

        "stage":
            stage,

        "sequences":
            sequence_stats
    }