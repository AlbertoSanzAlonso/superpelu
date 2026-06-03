import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildServiceFilterOptions,
  buildStaffFilterOptions,
  EMPTY_APPOINTMENT_HISTORY_FILTERS,
  filterAppointmentHistory,
  hasActiveAppointmentHistoryFilters,
  type AppointmentHistoryFilters,
} from '@/lib/appointmentHistoryFilters'
import { fetchAppointments, ApiError } from '@/lib/api'
import { addDaysToDateString, todaySalon } from '@/lib/dates'
import { isColorGroupWashRow } from '@/lib/bookingOccupancy'
import type { Appointment } from '@/types/booking'

function sortNewestFirst(rows: Appointment[]): Appointment[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return b.startTime.localeCompare(a.startTime)
  })
}

export function useSalonAppointmentHistory(adminToken: string) {
  const today = todaySalon()
  const defaultFrom = addDaysToDateString(today, -90)
  const defaultTo = addDaysToDateString(today, 60)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<AppointmentHistoryFilters>({
    ...EMPTY_APPOINTMENT_HISTORY_FILTERS,
    dateFrom: defaultFrom,
    dateTo: defaultTo,
  })

  const load = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const from = filters.dateFrom || defaultFrom
      const to = filters.dateTo || defaultTo
      const { appointments: rows } = await fetchAppointments(from, to, adminToken)
      setAppointments(sortNewestFirst(rows))
    } catch (err) {
      setAppointments([])
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las citas')
    } finally {
      setLoading(false)
    }
  }, [adminToken, filters.dateFrom, filters.dateTo, defaultFrom, defaultTo])

  useEffect(() => {
    void load()
  }, [load])

  const serviceOptions = useMemo(() => buildServiceFilterOptions(appointments), [appointments])
  const staffOptions = useMemo(() => buildStaffFilterOptions(appointments), [appointments])

  const filteredAppointments = useMemo(
    () => sortNewestFirst(filterAppointmentHistory(appointments, filters)),
    [appointments, filters],
  )

  const listableTotal = useMemo(
    () => appointments.filter((a) => !isColorGroupWashRow(a.colorGroupRole)).length,
    [appointments],
  )

  const patchFilters = useCallback((patch: Partial<AppointmentHistoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      ...EMPTY_APPOINTMENT_HISTORY_FILTERS,
      dateFrom: defaultFrom,
      dateTo: defaultTo,
    })
  }, [defaultFrom, defaultTo])

  return {
    appointments,
    filteredAppointments,
    loading,
    error,
    filters,
    patchFilters,
    clearFilters,
    hasFilters: hasActiveAppointmentHistoryFilters(filters),
    serviceOptions,
    staffOptions,
    listableTotal,
    reload: load,
    updateAppointments: setAppointments,
  }
}
