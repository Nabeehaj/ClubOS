"""Run the existing application against an isolated SBCS preview database."""

import sqlite3
from contextlib import closing
from pathlib import Path

from sqlalchemy.engine import make_url
from starlette.responses import JSONResponse

from .config import DATABASE_URL

SBCS_SLUG = "stony-brook-computing-society"


def validate_preview_database() -> None:
    url = make_url(DATABASE_URL)
    if url.get_backend_name() != "sqlite":
        raise RuntimeError("The SBCS preview requires a separate SQLite file.")

    if not url.database or url.database == ":memory:":
        raise RuntimeError("Configure an existing, seeded SBCS SQLite file.")

    path = Path(url.database).expanduser()
    if not path.is_absolute() or not path.is_file():
        raise RuntimeError(
            "DATABASE_URL must point to an existing, absolute SBCS demo path. "
            "Run the isolated seed command first."
        )

    try:
        with closing(
            sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
        ) as connection:
            slugs = [
                row[0]
                for row in connection.execute("SELECT slug FROM club")
            ]
    except sqlite3.Error as error:
        raise RuntimeError("The configured file is not a seeded ClubOS demo.") from error

    if slugs != [SBCS_SLUG]:
        raise RuntimeError(
            "This is not the isolated SBCS demo database. "
            "The preview will not start against existing club data."
        )


validate_preview_database()

# Import only after the read-only validation succeeds.
from .main import app as clubos_app  # noqa: E402


class PreviewResetGuard:
    def __init__(self, wrapped_app):
        self.wrapped_app = wrapped_app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] == "http"
            and scope["method"] == "POST"
            and scope["path"].rstrip("/") == "/api/demo/reset"
        ):
            response = JSONResponse(
                status_code=409,
                content={
                    "detail": (
                        "Reset is disabled in the isolated SBCS preview. "
                        "Create another demo database with seed_sbcs_demo "
                        "to start over."
                    )
                },
            )
            await response(scope, receive, send)
            return

        await self.wrapped_app(scope, receive, send)


app = PreviewResetGuard(clubos_app)
