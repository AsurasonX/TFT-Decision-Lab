import os
from pathlib import Path

from dotenv import load_dotenv

from sqlmodel import (
    SQLModel,
    Session,
    create_engine
)


PROJECT_ROOT = Path(
    __file__
).resolve().parents[2]


ENV_FILE = (
    PROJECT_ROOT / ".env"
)


load_dotenv(
    ENV_FILE
)


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./tft_decision_lab.db"
)


# ==========================================
# POSTGRESQL DRIVER
# ==========================================

# Hosting providers commonly return:
#
# postgresql://...
#
# We use pg8000 as the PostgreSQL driver.

if DATABASE_URL.startswith(
    "postgresql://"
):

    DATABASE_URL = (
        DATABASE_URL.replace(
            "postgresql://",
            "postgresql+pg8000://",
            1
        )
    )


# Some providers may return:
#
# postgres://...

if DATABASE_URL.startswith(
    "postgres://"
):

    DATABASE_URL = (
        DATABASE_URL.replace(
            "postgres://",
            "postgresql+pg8000://",
            1
        )
    )


# ==========================================
# CONNECTION OPTIONS
# ==========================================

connect_args = {}


if DATABASE_URL.startswith(
    "sqlite"
):

    connect_args = {
        "check_same_thread":
            False
    }


# ==========================================
# ENGINE
# ==========================================

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True
)


# ==========================================
# CREATE TABLES
# ==========================================

def create_db_and_tables():

    SQLModel.metadata.create_all(
        engine
    )


# ==========================================
# DATABASE SESSION
# ==========================================

def get_session():

    with Session(
        engine
    ) as session:

        yield session