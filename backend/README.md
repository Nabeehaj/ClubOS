# ClubOS backend

FastAPI + SQLite (SQLModel), JWT auth, Gemini for the AI features.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate             # Mac/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env             # Mac/Linux: cp .env.example .env, then add GEMINI_API_KEY
uvicorn app.main:app --reload
```

API docs are at http://localhost:8000/docs. The SQLite database is created and seeded on first run.

- `python -m app.seed`: reset the database with demo data
- `pytest -q`: run tests
- `python ../docs/wireframes/generate.py`: regenerate the wireframe PNGs (not tracked in git)

## Structure

```
app/
  main.py        app setup, CORS, health + demo reset
  config.py      settings from .env
  models.py      database tables
  auth.py        passwords, JWT, club access checks
  services.py    shared queries, readiness score, budget totals
  activity.py    activity feed
  ai.py          Gemini client
  seed.py        demo data
  routers/       auth, clubs, dashboard, events, tasks, chat, approvals,
                 finance, vendors, emails, agent
tests/
```

## Notes

- Without `GEMINI_API_KEY` the AI endpoints return 503; everything else works.
- 25Live, SB Engaged and NXT records are simulated. Vendors are sample data.
- Demo event dates are set in `app/seed.py`.

## TODO

- Import the real club data from CSV
- `@clubos` mentions in chat
- Deployment

## Hosting (Vercel)

The backend deploys to Vercel from `main` (project root directory: `backend`). Every push to `main`
redeploys automatically. Set `JWT_SECRET` and, to enable AI, `GEMINI_API_KEY` in the Vercel project's
environment variables. The demo database lives in `/tmp` on Vercel and resets when the server restarts.
