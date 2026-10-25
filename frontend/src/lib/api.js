// The only place the frontend talks to the backend. Screens import from here and never call fetch.
// Contract: docs/FRONTEND_GUIDE.md. Errors are { detail: "..." }; 401 = back to login; 403 = show the message.

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

const TOKEN_KEY = 'clubos.token'

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
  get isUnauthorized() { return this.status === 401 }
  get isForbidden() { return this.status === 403 }
  get isUnavailable() { return this.status === 503 }
  get isNetwork() { return this.status === 0 }
}

// ---- token ----
export const tokenStore = {
  get() {
    try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
  },
  set(token) {
    try { localStorage.setItem(TOKEN_KEY, token) } catch { /* storage blocked: session only */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
  },
}

// Called on any 401 so the app can drop the session and show the login screen.
let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) { onUnauthorized = fn }

function detailToMessage(detail, status) {
  if (typeof detail === 'string') return detail
  // FastAPI validation errors arrive as a list of { loc, msg }
  if (Array.isArray(detail)) return detail.map((d) => d.msg).filter(Boolean).join('. ')
  return status ? `Request failed (${status})` : 'Something went wrong'
}

async function request(method, path, { body, query } = {}) {
  const url = new URL(API_URL + path)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }

  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(0, "Can't reach the ClubOS server. Is the backend running?")
  }

  let data = null
  if (res.status !== 204) {
    try { data = await res.json() } catch { data = null }
  }

  if (!res.ok) {
    const err = new ApiError(res.status, detailToMessage(data?.detail, res.status), data)
    // A wrong password on the login call is also a 401, but that is not an expired session.
    if (err.isUnauthorized && path !== '/api/auth/login') {
      tokenStore.clear()
      onUnauthorized(err)
    }
    throw err
  }
  return data
}

const get = (path, query) => request('GET', path, { query })
const post = (path, body = {}) => request('POST', path, { body })
const patch = (path, body) => request('PATCH', path, { body })
const del = (path) => request('DELETE', path)

// ---- not club-scoped ----
export const auth = {
  login: async (email, password) => {
    const data = await post('/api/auth/login', { email, password })
    tokenStore.set(data.access_token)
    return data // { access_token, user, clubs[], default_club_id }
  },
  me: () => get('/api/auth/me'),
  logout: () => tokenStore.clear(),
}

export const clubs = {
  list: () => get('/api/clubs'),
  get: (clubId) => get(`/api/clubs/${clubId}`),
}

export const demo = {
  reset: () => post('/api/demo/reset'),
}

export const health = () => get('/api/health')

// ---- club-scoped: clubApi(clubId).events.list() etc. ----
export function clubApi(clubId) {
  const base = `/api/clubs/${clubId}`
  return {
    dashboard: () => get(`${base}/dashboard`),
    activity: (limit) => get(`${base}/activity`, { limit }),

    members: {
      list: () => get(`${base}/members`),
      get: (userId) => get(`${base}/members/${userId}`),
    },

    events: {
      list: (query) => get(`${base}/events`, query), // { status, upcoming_only }
      get: (id) => get(`${base}/events/${id}`),
      workspace: (id) => get(`${base}/events/${id}/workspace`),
      create: (body) => post(`${base}/events`, body),
      update: (id, body) => patch(`${base}/events/${id}`, body),
      addVendor: (id, body) => post(`${base}/events/${id}/vendors`, body),
    },

    tasks: {
      list: (query) => get(`${base}/tasks`, query), // { event_id, assignee_id, status, mine }
      get: (id) => get(`${base}/tasks/${id}`),
      create: (body) => post(`${base}/tasks`, body),
      update: (id, body) => patch(`${base}/tasks/${id}`, body),
      remove: (id) => del(`${base}/tasks/${id}`),
    },

    chat: {
      channels: () => get(`${base}/channels`),
      // Poll every ~3 s with after_id = the last message id you already have.
      messages: (channelId, query) => get(`${base}/channels/${channelId}/messages`, query), // { after_id, limit }
      send: (channelId, body) => post(`${base}/channels/${channelId}/messages`, body),
      toTask: (messageId, body = {}) => post(`${base}/messages/${messageId}/to-task`, body), // every field optional
    },

    approvals: {
      list: () => get(`${base}/approvals`),
      reservations: () => get(`${base}/reservations`),
      createReservation: (body) => post(`${base}/reservations`, body),
      updateReservation: (id, body) => patch(`${base}/reservations/${id}`, body),
      simulateReservation: (id) => post(`${base}/reservations/${id}/simulate-next`),
      sbEngaged: () => get(`${base}/sb-engaged`),
      updateSbEngaged: (id, body) => patch(`${base}/sb-engaged/${id}`, body),
      toggleDocument: (id, index) => post(`${base}/sb-engaged/${id}/documents/${index}/toggle`),
      simulateSbEngaged: (id) => post(`${base}/sb-engaged/${id}/simulate-next`),
    },

    finance: {
      summary: () => get(`${base}/finance/summary`),
      expenses: (query) => get(`${base}/finance/expenses`, query), // { event_id }
      addExpense: (body) => post(`${base}/finance/expenses`, body), // returns the new budget
      removeExpense: (id) => del(`${base}/finance/expenses/${id}`),
      categories: () => get(`${base}/finance/categories`),
      updateCategory: (id, body) => patch(`${base}/finance/categories/${id}`, body),
      requests: () => get(`${base}/finance/requests`),
      createRequest: (body) => post(`${base}/finance/requests`, body),
      updateRequest: (id, body) => patch(`${base}/finance/requests/${id}`, body),
      simulateRequest: (id) => post(`${base}/finance/requests/${id}/simulate-next`),
    },

    vendors: {
      list: (query) => get(`${base}/vendors`, query), // { category }
      get: (id) => get(`${base}/vendors/${id}`),
      create: (body) => post(`${base}/vendors`, body),
      update: (id, body) => patch(`${base}/vendors/${id}`, body),
    },

    emails: {
      templates: () => get(`${base}/emails/templates`),
      drafts: (query) => get(`${base}/emails/drafts`, query), // { event_id }
      generate: (body) => post(`${base}/emails/generate`, body),
      polish: (body) => post(`${base}/emails/polish`, body), // AI: 503 without a Gemini key
      mailto: (body) => post(`${base}/emails/mailto`, body),
      saveDraft: (body) => post(`${base}/emails/drafts`, body),
      removeDraft: (id) => del(`${base}/emails/drafts/${id}`),
    },

    agent: {
      status: () => get(`${base}/agent/status`),
      chat: (message, history = []) => post(`${base}/agent/chat`, { message, history }),
      confirm: (actionId) => post(`${base}/agent/actions/${actionId}/confirm`),
      confirmMany: (actionIds) => post(`${base}/agent/actions/confirm`, { action_ids: actionIds }), // { results, applied, failed }
      reject: (actionId) => post(`${base}/agent/actions/${actionId}/reject`),
    },
  }
}
