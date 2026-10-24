# ClubOS
ClubOS is a centralized club management platform designed for Stony Brook University (SBU) student organizations.Simplify club operations, improve collaboration, automate repetitive tasks, and make managing student organizations significantly easier.


## Repo layout

| Folder | Owner | What |
|---|---|---|
| [`backend/`](backend/) | Backend | Python FastAPI API. See [backend/README.md](backend/README.md) to run it |
| [`frontend/`](frontend/) | UI/UX | React/Vite app |
| [`docs/`](docs/) | Everyone | [Frontend guide](docs/FRONTEND_GUIDE.md), wireframe generator (`docs/wireframes/generate.py`), [demo accounts](docs/demo-accounts.csv), [OpenAPI spec](docs/openapi.json) |

Quick start: `cd backend`, install `requirements.txt`, then `uvicorn app.main:app --reload` and open http://localhost:8000/docs

## Vercel Services demo

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

This is a **single-club SBCS demo**, not a production data system. On Vercel,
the API seeds fictional SBCS data into a temporary SQLite file. Each function
instance can have a different copy, and all changes may disappear at any time.
This is suitable for UI review, but not for shared edits, real student records,
or reliable persistent collaboration. Local development still uses
`backend/clubos.db` by default. Set a private `JWT_SECRET` in Vercel. Do not
copy `backend/.env` into Git or put secrets in `VITE_*` variables. A real
database and authentication review will be required before production use.
