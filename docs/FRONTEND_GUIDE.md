# ClubOS: backend guide for the frontend

The backend is done and running. This page tells the UI/UX side **what data exists and where to get it**.
The wireframes (shared separately) are deliberately plain black-and-white. They show *which data goes
where*, not how it should look. Make it look 🔥.

The wireframe images are shared with the team directly, not stored in the repo. Regenerate them any time with `python docs/wireframes/generate.py`.

## Run the backend locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

- API: `http://localhost:8000`
- **Interactive docs: `http://localhost:8000/docs`**. Click *Authorize*, log in with a demo account, and try every endpoint.
- Full machine-readable spec: [`openapi.json`](openapi.json) (you can generate a typed client from it).
- Demo logins: [`demo-accounts.csv`](demo-accounts.csv). Main demo user: `sarah@sbu.clubos` / `Sarah!Tech2026`.

## The 4 rules

1. **Login** with `POST /api/auth/login` `{email, password}`. Keep `access_token` and send
   `Authorization: Bearer <access_token>` on every other request.
2. After login, **open the dashboard of `default_club_id`**. Every club screen lives under `/api/clubs/{club_id}/...`.
3. `clubs[]` from login (or `GET /api/clubs`) powers the **club switcher**. Switching = same screens, new `club_id`.
4. Errors always look like `{"detail": "message"}`. `401` means go to login, `403` means not allowed (show the message).

## Screens → endpoints

| Screen | Load with | Actions |
|---|---|---|
| Login | — | `POST /api/auth/login` |
| Dashboard | `GET /dashboard` (one call, everything) | — |
| Event workspace | `GET /events/{id}/workspace` (one call) | `PATCH /events/{id}`, `POST /events/{id}/vendors` |
| Events list | `GET /events?upcoming_only=true` | `POST /events` |
| Tasks (kanban) | `GET /tasks?event_id=&assignee_id=&status=&mine=true` | `POST /tasks`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}` |
| ClubChat | `GET /channels`, `GET /channels/{id}/messages?after_id=` | `POST /channels/{id}/messages`, **`POST /messages/{id}/to-task`** |
| Approvals | `GET /approvals` | `.../simulate-next` on reservations, sb-engaged, finance/requests; `POST /sb-engaged/{id}/documents/{i}/toggle` |
| Finance | `GET /finance/summary` | `POST /finance/expenses` (returns the new budget), `PATCH /finance/categories/{id}`, `POST /finance/requests` |
| Vendors | `GET /vendors` | `POST /vendors`, `PATCH /vendors/{id}` |
| Email generator | `GET /emails/templates`, `GET /emails/drafts` | `POST /emails/generate`, `POST /emails/polish` (AI), `POST /emails/mailto`, `POST /emails/drafts` |
| Members | `GET /members`, `GET /members/{user_id}` | — |
| AI Assistant panel | `GET /agent/status` | `POST /agent/chat`, `POST /agent/actions/{id}/confirm`, `.../reject` |

(All paths above are relative to `/api/clubs/{club_id}`.)

## Things the UI should know

- **Chat is polling, not websockets.** Every ~3 s call `GET /channels/{id}/messages?after_id=<last id you have>` and append.
  Messages with `is_bot: true` come from ClubOS (e.g. "📌 Sarah turned a message into a task").
- **Message → task:** every field is optional. With an empty body `{}` the message text becomes the title, the
  message author becomes the assignee, and the channel's event is linked.
- **Finance permissions:** only President/Treasurer may change money. Use `can_manage_finance` (in login `clubs[]`,
  dashboard `me`, finance summary) to hide/disable buttons. The API returns 403 anyway.
- **Simulated integrations:** 25Live, SB Engaged and NXT are fake. Every such record has `simulated: true` and
  reference numbers start with `SIM-`. Please show a small "Simulated" badge. The "Simulate next step" buttons
  exist to move statuses forward during the demo.
- **Readiness** (`readiness.score`, 0–100) = tasks 40% + 25Live 20% + SB Engaged 20% + NXT 20%.
  `readiness.parts[]` has the breakdown if you want a ring + checklist.
- **Vendors are samples** (`is_sample: true`): label them "Sample vendor, not SBU-verified".
- **Emails never send.** `mailto` is a ready link: `window.location.href = mailto` opens the user's mail app.
- **AI:** if `GET /agent/status` returns `available: false` (no Gemini key), disable the AI buttons. AI endpoints return 503.
  `POST /agent/chat` body: `{message, history: [{role: "user"|"assistant", text}]}`. Response:
  `{reply, proposals[], emails[], tools_used[]}`. Render each proposal as a confirm card (✅ → `/confirm`, ❌ → `/reject`).
  Render each email as a card with "Open in mail app" (`mailto`).
- **Activity feed** (`recent_activity` on the dashboard) updates after every change, which is good for the
  "back to dashboard" demo moment.
- `avatar_url` is filled for every user (DiceBear). Feel free to use initials instead.
- Dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC.
- **Reset the demo** any time: `POST /api/demo/reset` (any logged-in user).

## Demo script (backend already supports every step)

1. Log in as Sarah → Dashboard (stats, upcoming events, pending tasks).
2. Open **Fall Tech Networking Night** → workspace (8 tasks, 5 done, readiness 75%).
3. Assign a task to a board member.
4. ClubChat `#event-planning` → send a message → "Make task".
5. Approvals → simulate SB Engaged approval → readiness goes up.
6. Finance → add an expense → budget bars update.
7. Email generator → event invitation from the event's data → AI polish → open in mail app.
8. Back to Dashboard: the activity feed and numbers reflect everything.
9. Bonus: AI Assistant: "Who should book a photographer for networking night?" → confirm the card.
