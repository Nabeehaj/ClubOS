# ClubOS frontend

React/Vite UI for the ClubOS demo. It talks to the FastAPI backend through `VITE_API_URL`.

## Local development

```bash
npm ci
npm run dev
```

The default API URL is `http://localhost:8000`. To use another API, copy `.env.example` to `.env` and change `VITE_API_URL`.

## Vercel deployment

Import the GitHub repository as a Vercel project with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment Variable | `VITE_API_URL=https://<your-public-api-host>` |

Set `VITE_API_URL` for both Preview and Production before building. It is a public browser-side setting, not a secret. The API must be reachable over HTTPS and allow the deployed frontend origin in its `FRONTEND_ORIGINS` setting. The backend needs a persistent database for shared demo changes; its local SQLite file is not a persistent Vercel database.

`vercel.json` sends direct page loads (for example `/c/1/finance`) to the React app. After deploying, test both the root URL and a direct page URL, then log in and try a write action.
