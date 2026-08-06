import type { Appointment, BookableService, StaffDaySchedule } from '@/types/booking'
import type { BlockScope, BlockSeriesMeta } from '@/types/blocks'
import type { AppointmentSeriesMeta, AppointmentSeriesMode } from '@/types/appointmentSeries'
import type { SeriesPreviewResult, SeriesConflictResolution } from './admin'
import { ApiError } from './request'

const API_BASE = '/api'

export type StaffSession = {
  id: string
  name: string
  role: string | null
}

export type TimeBlock = {
  id: string
  staffId: string
  date: string
  startTime: string
  endTime: string
  note: string | null
  createdAt: string
}

async function staffRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? 'Error en la solicitud', res.status)
  }
  return data as T
}

export function staffLogin(name: string, password: string) {
  return fetch(`${API_BASE}/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  }).then(async (res) => {
    const data = await res.json()
    if (!res.ok) throw new ApiError(data.error ?? 'Error al entrar', res.status)
    return data as { token: string; staff: StaffSession }
  })
}

export function staffLogout(token: string) {
  return staffRequest<{ ok: true }>('/auth/staff/logout', token, { method: 'POST' })
}

export function verifyStaffToken(token: string) {
  return staffRequest<{ ok: true; staff: StaffSession }>('/me/verify', token)
}

export function fetchMyServices(token: string) {
  return staffRequest<{ services: BookableService[] }>('/me/services', token).then((r) => ({
    services: r.services ?? [],
  }))
}

export function fetchMySchedule(date: string, token: string) {
  return staffRequest<{ date: string; schedule: StaffDaySchedule | null }>(
    `/me/schedule?date=${date}`,
    token,
  )
}

export function fetchMySlots(
  token: string,
  date: string,
  serviceIds: string[],
  excludeAppointmentId?: string,
) {
  const params = new URLSearchParams({ date, serviceIds: serviceIds.join(',') })
  if (excludeAppointmentId) params.set('excludeAppointmentId', excludeAppointmentId)
  return staffRequest<{ slots: string[]; slotsOverHours?: string[] }>(`/me/slots?${params}`, token).then((r) => ({
    slots: r.slots ?? [],
    slotsOverHours: r.slotsOverHours ?? [],
  }))
}

export function fetchMyAppointments(token: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to })
  return staffRequest<{ appointments: Appointment[] }>(`/me/appointments?${params}`, token).then(
    (r) => ({ appointments: r.appointments ?? [] }),
  )
}

export function previewMySeriesConflicts(
  token: string,
  payload: {
    serviceIds?: string[]
    serviceStartTimes?: string[]
    serviceDurations?: (number | null)[]
    date: string
    startTime: string
    customerFirstName: string
    customerLastName?: string
    customerPhone: string
    customerEmail?: string
    customerNotes?: string
    notes?: string
    customerLocale?: 'es' | 'en'
    endDate?: string
  },
) {
  return staffRequest<SeriesPreviewResult>('/me/appointments/preview-series', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createMyAppointment(
  token: string,
  payload: {
    serviceId?: string
    serviceIds?: string[]
    serviceStartTimes?: string[]
    serviceDurations?: (number | null)[]
    date: string
    startTime: string
    customerFirstName: string
    customerLastName?: string
    customerPhone: string
    customerEmail?: string
    customerNotes?: string
    notes?: string
    customerLocale?: 'es' | 'en'
    scope?: BlockScope
    endDate?: string
    forceSchedule?: boolean
    conflictResolutions?: SeriesConflictResolution[]
  },
) {
  return staffRequest<{ appointment: Appointment }>('/me/appointments', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMyAppointment(
  token: string,
  id: string,
  payload: Partial<{
    serviceId: string
    serviceIds: string[]
    serviceStartTimes: string[]
    serviceDurations: (number | null)[]
    staffAssignments: string[]
    date: string
    startTime: string
    customerFirstName: string
    customerLastName: string
    customerPhone: string
    customerEmail: string | null
    customerNotes?: string | null
    notes: string | null
    customerLocale?: 'es' | 'en'
    forceSchedule?: boolean
  }>,
) {
  return staffRequest<{ appointment: Appointment }>(`/me/appointments/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchMyAppointmentSeries(token: string, appointmentId: string) {
  return staffRequest<{ series: AppointmentSeriesMeta }>(
    `/me/appointments/${appointmentId}/series`,
    token,
  ).then((r) => r.series)
}

export function deleteMyAppointment(
  token: string,
  id: string,
  mode: AppointmentSeriesMode = 'single',
) {
  const params = mode !== 'single' ? `?mode=${mode}` : ''
  return staffRequest<{ ok: true }>(`/me/appointments/${id}${params}`, token, { method: 'DELETE' })
}

export function markMyAppointmentNoShow(
  token: string,
  id: string,
  options?: { sendWhatsApp?: boolean },
) {
  return staffRequest<{ appointment: Appointment }>(`/me/appointments/${id}/no-show`, token, {
    method: 'PATCH',
    body: JSON.stringify({
      sendWhatsApp: options?.sendWhatsApp === true,
    }),
  })
}

export function fetchMyBlocks(token: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to })
  return staffRequest<{ blocks: TimeBlock[] }>(`/me/blocks?${params}`, token).then((r) => ({
    blocks: r.blocks ?? [],
  }))
}

export function createMyBlock(
  token: string,
  payload: {
    date: string
    startTime: string
    endTime: string
    note?: string
    scope?: BlockScope
    endDate?: string
  },
) {
  return staffRequest<{ block: TimeBlock }>('/me/blocks', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchMyBlockSeries(token: string, blockId: string) {
  return staffRequest<{ series: BlockSeriesMeta }>(
    `/me/blocks/${blockId}/series`,
    token,
  ).then((r) => r.series)
}

export function updateMyBlock(
  token: string,
  blockId: string,
  payload: {
    note?: string | null
    startTime?: string
    endTime?: string
    mode?: 'single' | 'series'
  },
) {
  return staffRequest<{ block: TimeBlock }>(`/me/blocks/${blockId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMyBlock(
  token: string,
  id: string,
  mode: 'single' | 'series' = 'single',
) {
  const params = new URLSearchParams({ mode })
  return staffRequest<{ ok: true }>(`/me/blocks/${id}?${params}`, token, { method: 'DELETE' })
}
