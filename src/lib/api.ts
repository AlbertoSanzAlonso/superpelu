import type { Appointment, BookableService, CreateAppointmentPayload } from '@/types/booking'

const API_BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? 'Error en la solicitud')
  }

  return data as T
}

export function fetchServices() {
  return request<{ services?: BookableService[] }>('/services').then((res) => ({
    services: Array.isArray(res.services) ? res.services : [],
  }))
}

export function fetchSlots(date: string, serviceId: string) {
  const params = new URLSearchParams({ date, serviceId })
  return request<{ slots?: string[] }>(`/slots?${params}`).then((res) => ({
    slots: Array.isArray(res.slots) ? res.slots : [],
  }))
}

export function createAppointment(payload: CreateAppointmentPayload) {
  return request<{ appointment: Appointment }>('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchAppointments(from: string, to: string, adminToken: string) {
  const params = new URLSearchParams({ from, to })
  return request<{ appointments: Appointment[] }>(`/appointments?${params}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
}

export function cancelAppointment(id: string, adminToken: string) {
  return request<{ appointment: Appointment }>(`/appointments/${id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
  })
}
