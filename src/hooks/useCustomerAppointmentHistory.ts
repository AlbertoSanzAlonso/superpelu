import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCustomerDetail, ApiError } from '@/lib/api'
import { isColorGroupWashRow } from '@/lib/bookingOccupancy'
import {
  matchesCustomerAppointmentStatusFilter,
  type CustomerAppointmentStatusFilter,
} from '@/lib/customerAppointmentStatus'
import type { Appointment } from '@/types/booking'
import type { Customer } from '@/types/customers'

export type CustomerAppointmentHistoryFilters = {
  dateFrom: string
  dateTo: string
  serviceFilter: string
  staffFilter: string
  statusFilter: CustomerAppointmentStatusFilter | ''
  textQuery: string
}

const EMPTY_FILTERS: CustomerAppointmentHistoryFilters = {
  dateFrom: '',
  dateTo: '',
  serviceFilter: '',
  staffFilter: '',
  statusFilter: '',
  textQuery: '',
}

function matchesTextQuery(apt: Appointment, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    apt.serviceName,
    apt.staffName ?? '',
    apt.notes ?? '',
    apt.date,
    apt.status,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

export function useCustomerAppointmentHistory(adminToken: string, phone: string) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState<CustomerAppointmentHistoryFilters>(EMPTY_FILTERS)

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

  const serviceOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const apt of appointments) {
      map.set(apt.serviceId, apt.serviceName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [appointments])

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const apt of appointments) {
      if (apt.staffId && apt.staffName) {
        map.set(apt.staffId, apt.staffName)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [appointments])

  const filteredAppointments = useMemo(() => {
    const { dateFrom, dateTo, serviceFilter, staffFilter, statusFilter, textQuery } = filters
    return appointments.filter((apt) => {
      if (isColorGroupWashRow(apt.colorGroupRole)) return false
      if (dateFrom && apt.date < dateFrom) return false
      if (dateTo && apt.date > dateTo) return false
      if (serviceFilter && apt.serviceId !== serviceFilter) return false
      if (staffFilter && apt.staffId !== staffFilter) return false
      if (statusFilter && !matchesCustomerAppointmentStatusFilter(apt, statusFilter)) {
        return false
      }
      if (!matchesTextQuery(apt, textQuery)) return false
      return true
    })
  }, [appointments, filters])

  const hasFilters = Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.serviceFilter ||
      filters.staffFilter ||
      filters.statusFilter ||
      filters.textQuery.trim(),
  )

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
  }, [])

  const patchFilters = useCallback((patch: Partial<CustomerAppointmentHistoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
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
    hasFilters,
    serviceOptions,
    staffOptions,
    reload: load,
    updateAppointments,
  }
}
