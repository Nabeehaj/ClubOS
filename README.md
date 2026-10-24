# ClubOS
ClubOS is a centralized club management platform designed for Stony Brook University (SBU) student organizations.Simplify club operations, improve collaboration, automate repetitive tasks, and make managing student organizations significantly easier.


## Repo layout

| Folder | Owner | What |
|---|---|---|
| [`backend/`](backend/) | Backend | Python FastAPI API. See [backend/README.md](backend/README.md) to run it |
| `frontend/` | UI/UX | React app (to come) |
| [`docs/`](docs/) | Everyone | [Frontend guide](docs/FRONTEND_GUIDE.md), wireframe generator (`docs/wireframes/generate.py`), [demo accounts](docs/demo-accounts.csv), [OpenAPI spec](docs/openapi.json) |

Quick start: `cd backend`, install `requirements.txt`, then `uvicorn app.main:app --reload` and open http://localhost:8000/docs
