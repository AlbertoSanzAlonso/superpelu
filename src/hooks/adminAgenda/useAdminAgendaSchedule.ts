import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, fetchDaySchedule } from '@/lib/api'
import type { StaffDaySchedule } from '@/types/booking'
import { schedulesEqual } from './schedulesEqual'

export function useAdminAgendaSchedule(adminToken: string, date: string) {
  const [schedules, setSchedules] = useState<StaffDaySchedule[]>([])
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => Boolean(adminToken))
  const [error, setError] = useState('')
  const [gridActionsBusy, setGridActionsBusy] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!adminToken) return null
    const fetchDate = date
    const silent = opts?.silent === true || hasLoadedOnceRef.current
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const res = await fetchDaySchedule(fetchDate, adminToken)
      hasLoadedOnceRef.current = true
      setSchedules((prev) => (schedulesEqual(prev, res.schedules) ? prev : res.schedules))
      setLoadedDate(fetchDate)
      return res.schedules
    } catch (err) {
      if (!silent) {
        if (err instanceof ApiError && err.status === 401) {
          setError('Sesión de administración no válida.')
        } else {
          setError('No se pudo cargar la agenda.')
        }
      }
      return null
    } finally {
      if (!silent) setLoading(false)
    }
  }, [adminToken, date])

  useEffect(() => {
    setLoadedDate(null)
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  return {
    schedules,
    loadedDate,
    loading,
    error,
    setError,
    load,
    gridActionsBusy,
    setGridActionsBusy,
  }
}
