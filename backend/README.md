# ClubOS backend

Python 3.11+ · FastAPI · SQLite (via SQLModel) · JWT login · Google Gemini for AI.

## Start it

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate             # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env             # Mac/Linux: cp .env.example .env   (then paste your GEMINI_API_KEY)
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs**. The database (`clubos.db`) is created and filled with demo data
automatically the first time.

| Command | What it does |
|---|---|
| `uvicorn app.main:app --reload` | Run the API (auto-restarts when you edit code) |
| `python -m app.seed` | Wipe the database and reload demo data |
| `pytest -q` | Run the tests (they replay the whole hackathon demo) |
| `python ../docs/wireframes/generate.py` | Redraw the wireframe PNGs (kept out of git) |

## Where things are

```
app/
  main.py        app setup, CORS, auto-seed, /api/health, /api/demo/reset
  config.py      settings (read from .env)
  models.py      every database table
  auth.py        passwords, login tokens, "is this user on this club's board?"
  services.py    shared JSON shapes + readiness score + budget math
  activity.py    writes the dashboard activity feed
  ai.py          Gemini wrapper (email polish)
  seed.py        all demo data (10 accounts, 3 clubs, the connected Networking Night event)
  routers/       one file per feature: auth, clubs, dashboard, events, tasks, chat,
                 approvals (25Live + SB Engaged), finance (+ NXT), vendors, emails, agent
tests/test_demo_flow.py
```

## Backend components

- [x] Project skeleton, config, CORS for the React dev server
- [x] Database models (multi-club: every row belongs to a club)
- [x] Login: email + password, hashed, JWT; 10 demo accounts across 3 clubs
- [x] Permissions: board members only see their clubs; only President/Treasurer change finances
- [x] Seed data + one-click demo reset
- [x] Dashboard (one call)
- [x] Clubs, club switcher, members with task counts
- [x] Events + event workspace (one call) + vendor links
- [x] Tasks: create, assign, status, priority, deadlines, filters
- [x] ClubChat: channels, messages (polling), **message → task**
- [x] 25Live reservations (simulated)
- [x] SB Engaged approvals with document checklist (simulated)
- [x] Event readiness score
- [x] Finance: budget categories, expenses (live budget update), NXT requests (simulated)
- [x] Vendors (sample)
- [x] Email generator: 3 templates from real event data, mailto link, drafts, **AI polish**
- [x] **AI agent**: answers questions, suggests assignees by workload, drafts emails, proposes task
      creates/updates as confirm cards (no money or approval powers)
- [x] Activity feed
- [x] API docs (`/docs`, `docs/openapi.json`, `docs/FRONTEND_GUIDE.md`) and wireframes
- [ ] Import real club data from the CSV (waiting on the data partner)
- [ ] Stretch: `@clubos` mentions in ClubChat, deploy online

## Notes

- **AI:** put `GEMINI_API_KEY` in `.env`. Without it the app works fine and AI endpoints answer 503
  "AI unavailable". Change the model with `GEMINI_MODEL`.
- **Demo dates** are fixed (Networking Night is Nov 5, 2026). If the demo day moves past them, edit the dates in
  `app/seed.py` and run `python -m app.seed`.
- All people, emails (`@sbu.clubos`), vendors and 25Live/SB Engaged/NXT records are fictional.
