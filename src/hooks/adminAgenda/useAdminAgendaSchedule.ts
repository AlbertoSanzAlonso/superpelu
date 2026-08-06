import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, fetchDaySchedule, fetchScheduleRange, type ScheduleDayBundle } from '@/lib/api'
import {
  datesForAgendaView,
  type AgendaViewMode,
} from '@/lib/agenda/agendaView'
import type { StaffDaySchedule } from '@/types/booking'
import { schedulesEqual } from './schedulesEqual'

function salonWindowsEqual(
  a: { startTime: string; endTime: string }[],
  b: { startTime: string; endTime: string }[],
): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function dayBundlesEqual(a: ScheduleDayBundle[], b: ScheduleDayBundle[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].date !== b[i].date) return false
    if (!schedulesEqual(a[i].schedules, b[i].schedules)) return false
    if (!salonWindowsEqual(a[i].salonWindows, b[i].salonWindows)) return false
  }
  return true
}

export function useAdminAgendaSchedule(
  adminToken: string,
  date: string,
  agendaView: AgendaViewMode = 'day',
) {
  const [schedules, setSchedules] = useState<StaffDaySchedule[]>([])
  const [salonWindows, setSalonWindows] = useState<{ startTime: string; endTime: string }[]>([])
  const [dayBundles, setDayBundles] = useState<ScheduleDayBundle[]>([])
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => Boolean(adminToken))
  const [error, setError] = useState('')
  const [gridActionsBusy, setGridActionsBusy] = useState(false)
  const hasLoadedOnceRef = useRef(false)

  const viewDates = useMemo(() => datesForAgendaView(agendaView, date), [agendaView, date])
  const rangeFrom = viewDates[0] ?? date
  const rangeTo = viewDates[viewDates.length - 1] ?? date

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!adminToken) return null
    const silent = opts?.silent === true || hasLoadedOnceRef.current
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      if (agendaView === 'day') {
        const res = await fetchDaySchedule(date, adminToken)
        hasLoadedOnceRef.current = true
        setSchedules((prev) => (schedulesEqual(prev, res.schedules) ? prev : res.schedules))
        setSalonWindows((prev) =>
          salonWindowsEqual(prev, res.salonWindows) ? prev : res.salonWindows,
        )
        setDayBundles([
          { date: res.date, schedules: res.schedules, salonWindows: res.salonWindows },
        ])
        setLoadedDate(date)
        return res.schedules
      }

      const res = await fetchScheduleRange(rangeFrom, rangeTo, adminToken)
      hasLoadedOnceRef.current = true
      const ordered = viewDates.map(
        (d) =>
          res.days.find((day) => day.date === d) ?? {
            date: d,
            schedules: [],
            salonWindows: [],
          },
      )
      setDayBundles((prev) => (dayBundlesEqual(prev, ordered) ? prev : ordered))
      const anchor =
        ordered.find((day) => day.date === date) ?? ordered[0] ?? {
          date,
          schedules: [],
          salonWindows: [],
        }
      setSchedules((prev) =>
        schedulesEqual(prev, anchor.schedules) ? prev : anchor.schedules,
      )
      setSalonWindows((prev) =>
        salonWindowsEqual(prev, anchor.salonWindows) ? prev : anchor.salonWindows,
      )
      setLoadedDate(date)
      return anchor.schedules
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
  }, [adminToken, date, agendaView, rangeFrom, rangeTo, viewDates])

  useEffect(() => {
    setLoadedDate(null)
  }, [date, agendaView])

  useEffect(() => {
    void load()
  }, [load])

  return {
    schedules,
    salonWindows,
    dayBundles,
    viewDates,
    loadedDate,
    loading,
    error,
    setError,
    load,
    gridActionsBusy,
    setGridActionsBusy,
  }
}
