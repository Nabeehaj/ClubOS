# ClubOS
ClubOS is a centralized club management platform designed for Stony Brook University (SBU) student organizations.Simplify club operations, improve collaboration, automate repetitive tasks, and make managing student organizations significantly easier.


## Repo layout

| Folder | Owner | What |
|---|---|---|
| [`backend/`](backend/) | Backend | Python FastAPI API. See [backend/README.md](backend/README.md) to run it |
| [`frontend/`](frontend/) | UI/UX | React/Vite app |
| [`docs/`](docs/) | Everyone | [Frontend guide](docs/FRONTEND_GUIDE.md), wireframe generator (`docs/wireframes/generate.py`), [demo accounts](docs/demo-accounts.csv), [OpenAPI spec](docs/openapi.json) |

Quick start: `cd backend`, install `requirements.txt`, then `uvicorn app.main:app --reload` and open http://localhost:8000/docs

## Vercel Services (proposed)

The root [`vercel.json`](vercel.json) defines one Vercel project with a FastAPI
`backend` service and a Vite `frontend` service. `/api/*` is public and reaches
FastAPI without stripping `/api`; everything else reaches the frontend, where a
service-scoped rewrite serves `index.html` for React Router deep links. Vercel
Services is currently a beta feature. Set the Vercel project's framework to
**Services** and use the repository root as the project root.

There are no service bindings: the Vite build is static, and all API calls are
made by the browser to same-origin `/api/*`. Bindings are only injected into
server-side functions at runtime, so a frontend binding would not be available
to this application. If a server-side frontend is added later, bind `backend`
on that calling service and use the injected URL from its function code.

For local development, start FastAPI on port 8000 and Vite on port 5173. Vite
proxies `/api/*` to FastAPI. `VITE_API_URL` is an optional override for a
separately hosted API; leave it unset for same-origin Vercel previews.

**Before deploying:** The current default database is a local SQLite file.
Vercel Functions do not provide durable application file storage, so a live
deployment needs a persistent database and a `DATABASE_URL` configured in
Vercel, plus a private `JWT_SECRET`. Do not copy `backend/.env` into Git or put
these secrets in `VITE_*` variables. The database provider and production seed
strategy still need to be chosen; this routing config alone does not make the
backend production-ready.
