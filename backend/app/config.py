"""Settings, overridable in backend/.env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# On Vercel only /tmp is writable, so the demo database lives there (it resets when the server restarts)
_default_db = "/tmp/clubos.db" if os.getenv("VERCEL") else (BASE_DIR / "clubos.db").as_posix()
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_default_db}")

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-me-before-deploying")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
# Tried in order after GEMINI_MODEL when it is overloaded or retired
GEMINI_FALLBACK_MODELS = [m.strip() for m in os.getenv(
    "GEMINI_FALLBACK_MODELS", "gemini-3.5-flash,gemini-flash-lite-latest").split(",") if m.strip()]
GEMINI_MODELS = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]
# Tokens the model may spend "thinking" before answering. 0 keeps replies to a few seconds;
# the default thinking takes 30-60s per call, which is too slow for a multi-step assistant.
GEMINI_THINKING_BUDGET = int(os.getenv("GEMINI_THINKING_BUDGET", "0"))

# Allowed frontend origins
FRONTEND_ORIGINS = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]

# Positions allowed to change finances
FINANCE_POSITIONS = {"President", "Treasurer"}
