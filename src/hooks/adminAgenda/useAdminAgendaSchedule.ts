import { useCallback, useEffect, useState } from 'react'
import { ApiError, fetchDaySchedule } from '@/lib/api'
import type { StaffDaySchedule } from '@/types/booking'

export function useAdminAgendaSchedule(adminToken: string, date: string) {
  const [schedules, setSchedules] = useState<StaffDaySchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gridActionsBusy, setGridActionsBusy] = useState(false)

  const load = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchDaySchedule(date, adminToken)
      setSchedules(res.schedules)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Sesión de administración no válida.')
      } else {
        setError('No se pudo cargar la agenda.')
      }
    } finally {
      setLoading(false)
    }
  }, [adminToken, date])

  useEffect(() => {
    void load()
  }, [load])

  return {
    schedules,
    loading,
    error,
    setError,
    load,
    gridActionsBusy,
    setGridActionsBusy,
  }
}
