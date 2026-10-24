import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // 401/403/404 will not fix themselves; only retry network blips and 5xx once.
      retry: (count, err) => count < 1 && (err?.status === 0 || err?.status >= 500),
    },
  },
})

// Every club query key starts with ['club', clubId] so one invalidate refreshes the whole club after a change.
export const keys = {
  club: (clubId) => ['club', String(clubId)],
  dashboard: (clubId) => ['club', String(clubId), 'dashboard'],
  agentStatus: (clubId) => ['club', String(clubId), 'agent-status'],
}
