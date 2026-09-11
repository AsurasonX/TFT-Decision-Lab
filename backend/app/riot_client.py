import os
from pathlib import Path
from urllib.parse import quote

import requests
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]

ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(
    ENV_FILE,
    override=True
)

API_KEY = os.getenv("RIOT_API_KEY")


if not API_KEY:
    raise RuntimeError(
        "RIOT_API_KEY was not found in .env"
    )

if not API_KEY:
    raise RuntimeError(
        "RIOT_API_KEY was not found in .env"
    )


# ==========================================
# RIOT API SETTINGS
# ==========================================

RIOT_REGION_URL = (
    "https://asia.api.riotgames.com"
)

HEADERS = {
    "X-Riot-Token": API_KEY
}


# ==========================================
# ACCOUNT LOOKUP
# ==========================================

def get_account(
    game_name: str,
    tag_line: str
):

    encoded_name = quote(
        game_name,
        safe=""
    )

    encoded_tag = quote(
        tag_line,
        safe=""
    )

    url = (
        f"{RIOT_REGION_URL}"
        "/riot/account/v1/accounts/"
        "by-riot-id/"
        f"{encoded_name}/"
        f"{encoded_tag}"
    )


    response = requests.get(
        url,
        headers=HEADERS,
        timeout=10
    )


    if response.status_code != 200:

        raise Exception(
            f"Account lookup failed "
            f"({response.status_code}): "
            f"{response.text}"
        )


    return response.json()


# ==========================================
# MATCH IDS
# ==========================================

def get_match_ids(
    puuid: str,
    count: int = 20
):

    url = (
        f"{RIOT_REGION_URL}"
        "/tft/match/v1/matches/"
        "by-puuid/"
        f"{puuid}/ids"
    )


    params = {
        "start": 0,
        "count": count
    }


    response = requests.get(
        url,
        headers=HEADERS,
        params=params,
        timeout=10
    )


    if response.status_code != 200:

        raise Exception(
            f"Match ID request failed "
            f"({response.status_code}): "
            f"{response.text}"
        )


    return response.json()


# ==========================================
# SINGLE MATCH
# ==========================================

def get_match(
    match_id: str
):

    url = (
        f"{RIOT_REGION_URL}"
        "/tft/match/v1/matches/"
        f"{match_id}"
    )


    response = requests.get(
        url,
        headers=HEADERS,
        timeout=10
    )


    if response.status_code != 200:

        raise Exception(
            f"Match request failed "
            f"({response.status_code}): "
            f"{response.text}"
        )


    return response.json()


# ==========================================
# FIND PLAYER INSIDE MATCH
# ==========================================

def find_player(
    match_data: dict,
    puuid: str
):

    participants = (
        match_data
        .get("info", {})
        .get("participants", [])
    )


    for player in participants:

        if player.get("puuid") == puuid:
            return player


    return None


# ==========================================
# RECENT MATCH SUMMARY
# ==========================================

def get_recent_matches(
    game_name: str,
    tag_line: str,
    count: int = 20
):

    # Riot ID -> account
    account = get_account(
        game_name,
        tag_line
    )


    puuid = account["puuid"]


    # PUUID -> match IDs
    match_ids = get_match_ids(
        puuid,
        count
    )


    matches = []


    for match_id in match_ids:

        match_data = get_match(
            match_id
        )


        player = find_player(
            match_data,
            puuid
        )


        if player is None:
            continue


        placement = player.get(
            "placement"
        )


        # ------------------------------
        # Units
        # ------------------------------

        units = []

        for unit in player.get(
            "units",
            []
        ):

            units.append(
                {
                    "character_id":
                        unit.get(
                            "character_id"
                        ),

                    "tier":
                        unit.get(
                            "tier"
                        ),

                    "items":
                        unit.get(
                            "items",
                            []
                        )
                }
            )


        # ------------------------------
        # Traits
        # ------------------------------

        traits = []

        for trait in player.get(
            "traits",
            []
        ):

            traits.append(
                {
                    "name":
                        trait.get("name"),

                    "num_units":
                        trait.get(
                            "num_units"
                        ),

                    "style":
                        trait.get(
                            "style"
                        ),

                    "tier_current":
                        trait.get(
                            "tier_current"
                        )
                }
            )


        # ------------------------------
        # Match summary
        # ------------------------------

        match_summary = {

            "match_id":
                match_id,

            "game_datetime":
                 match_data
                .get("info", {})
                .get("game_datetime"),

            "queue_id":
                match_data
                .get("info", {})
                .get("queue_id"),

            "tft_game_type":
                match_data
                .get("info", {})
                .get("tft_game_type"),

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
                player.get(
                    "level"
                ),

            "last_round":
                player.get(
                    "last_round"
                ),

            "game_version":
                match_data
                .get("info", {})
                .get(
                    "game_version"
                ),

            "units":
                units,

            "traits":
                traits

                
                
        }


        matches.append(
            match_summary
        )




    return {
        "player": {
            "game_name":
                account.get(
                    "gameName"
                ),

            "tag_line":
                account.get(
                    "tagLine"
                ),

            "puuid":
                puuid
        },

        "matches":
            matches
    }