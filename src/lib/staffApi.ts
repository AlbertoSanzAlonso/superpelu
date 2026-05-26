import type { Appointment, BookableService, StaffDaySchedule } from '@/types/booking'
import { ApiError } from '@/lib/api'

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
  serviceId: string,
  excludeAppointmentId?: string,
) {
  const params = new URLSearchParams({ date, serviceId })
  if (excludeAppointmentId) params.set('excludeAppointmentId', excludeAppointmentId)
  return staffRequest<{ slots: string[] }>(`/me/slots?${params}`, token).then((r) => ({
    slots: r.slots ?? [],
  }))
}

export function fetchMyAppointments(token: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to })
  return staffRequest<{ appointments: Appointment[] }>(`/me/appointments?${params}`, token).then(
    (r) => ({ appointments: r.appointments ?? [] }),
  )
}

export function createMyAppointment(
  token: string,
  payload: {
    serviceId: string
    date: string
    startTime: string
    customerFirstName: string
    customerLastName?: string
    customerPhone: string
    customerEmail?: string
    notes?: string
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
    date: string
    startTime: string
    customerFirstName: string
    customerLastName: string
    customerPhone: string
    customerEmail: string | null
    notes: string | null
  }>,
) {
  return staffRequest<{ appointment: Appointment }>(`/me/appointments/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteMyAppointment(token: string, id: string) {
  return staffRequest<{ ok: true }>(`/me/appointments/${id}`, token, { method: 'DELETE' })
}

export function fetchMyBlocks(token: string, from: string, to: string) {
  const params = new URLSearchParams({ from, to })
  return staffRequest<{ blocks: TimeBlock[] }>(`/me/blocks?${params}`, token).then((r) => ({
    blocks: r.blocks ?? [],
  }))
}

export function createMyBlock(
  token: string,
  payload: { date: string; startTime: string; endTime: string; note?: string },
) {
  return staffRequest<{ block: TimeBlock }>('/me/blocks', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteMyBlock(token: string, id: string) {
  return staffRequest<{ ok: true }>(`/me/blocks/${id}`, token, { method: 'DELETE' })
}
