import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildServiceFilterOptions,
  buildStaffFilterOptions,
  EMPTY_APPOINTMENT_HISTORY_FILTERS,
  filterAppointmentHistory,
  hasActiveAppointmentHistoryFilters,
  type AppointmentHistoryFilters,
} from '@/lib/appointmentHistoryFilters'
import { fetchCustomerDetail, ApiError } from '@/lib/api'
import { isColorGroupWashRow } from '@/lib/bookingOccupancy'
import type { Appointment } from '@/types/booking'
import type { Customer } from '@/types/customers'

export type CustomerAppointmentHistoryFilters = AppointmentHistoryFilters

export function useCustomerAppointmentHistory(adminToken: string, phone: string) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<AppointmentHistoryFilters>(EMPTY_APPOINTMENT_HISTORY_FILTERS)

  const load = useCallback(async () => {
    if (!adminToken || !phone) return
    setLoading(true)
    setError('')
    try {
      const detail = await fetchCustomerDetail(adminToken, phone)
      setCustomer({
        ...detail.customer,
        appointmentCount: detail.appointments.filter(
          (a) => a.status !== 'cancelled' && !isColorGroupWashRow(a.colorGroupRole),
        ).length,
        lastAppointmentDate: detail.appointments[0]?.date ?? null,
      })
      setAppointments(detail.appointments)
    } catch (err) {
      setCustomer(null)
      setAppointments([])
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }, [adminToken, phone])

  useEffect(() => {
    void load()
  }, [load])

  const serviceOptions = useMemo(() => buildServiceFilterOptions(appointments), [appointments])
  const staffOptions = useMemo(() => buildStaffFilterOptions(appointments), [appointments])

  const filteredAppointments = useMemo(
    () => filterAppointmentHistory(appointments, filters),
    [appointments, filters],
  )

  const patchFilters = useCallback((patch: Partial<AppointmentHistoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_APPOINTMENT_HISTORY_FILTERS)
  }, [])

  const updateAppointments = useCallback(
    (updater: (rows: Appointment[]) => Appointment[]) => {
      setAppointments(updater)
    },
    [],
  )

  return {
    customer,
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
    reload: load,
    updateAppointments,
    setCustomer,
  }
}
