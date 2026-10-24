"""Create a new, isolated SBCS SQLite demo database."""

import argparse
import os
from pathlib import Path

from sqlalchemy.engine import URL
from sqlmodel import Session, SQLModel, create_engine

from .sbcs_demo import seed_sbcs


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a separate SBCS demonstration database."
    )
    parser.add_argument(
        "--database",
        required=True,
        type=Path,
        help="Absolute path to a new SQLite database file.",
    )
    args = parser.parse_args()

    requested = args.database.expanduser()
    if not requested.is_absolute():
        parser.error("--database must be an absolute path.")

    target = requested.resolve()
    if not target.parent.is_dir():
        parser.error("The parent directory must already exist.")

    try:
        descriptor = os.open(
            target,
            os.O_CREAT | os.O_EXCL | os.O_WRONLY,
            0o600,
        )
    except FileExistsError:
        parser.error(
            "The target already exists. Choose a new filename. "
            "Existing databases are never replaced."
        )
    except OSError as error:
        parser.error(f"Cannot create the demo database: {error}")
    else:
        os.close(descriptor)

    engine = create_engine(
        URL.create("sqlite", database=str(target)),
        connect_args={"check_same_thread": False},
    )
    try:
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            result = seed_sbcs(session)
            session.commit()
    except Exception:
        print(
            f"Seeding failed. The newly created file remains at {target}. "
            "No existing database was replaced."
        )
        raise
    finally:
        engine.dispose()

    print(f"Created: {target}")
    print(f"Club ID: {result['club_id']}")
    print(f"Event ID: {result['event_id']}")
    print("Annual demo allocation: $8,500")
    print("Event allocation and fictional purchases: $4,500")
    print("Remaining annual demo allocation: $4,000")
    print("Demo login: eduardo@sbcs-demo.example / Eduardo!Demo2026")
    print("Start the isolated preview using app.sbcs_preview:app.")


if __name__ == "__main__":
    main()
