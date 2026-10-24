import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { clubApi } from './api'
import { useAuth } from './auth'

// The active club comes from the URL (/c/:clubId/...), so the club switcher is just navigation.
export function useClub() {
  const { clubId } = useParams()
  const { clubs = [] } = useAuth()
  const club = clubs.find((c) => String(c.id) === String(clubId)) ?? null
  const api = useMemo(() => clubApi(clubId), [clubId])
  return { clubId, club, api, canManageFinance: !!club?.can_manage_finance }
}
