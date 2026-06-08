import type {
  Appointment,
  BookableService,
  BookingChainContinuation,
  CreateAppointmentPayload,
  ServiceCategory,
  StaffDaySchedule,
  StaffMember,
} from '@/types/booking'
import type { Customer, CustomerDetail } from '@/types/customers'
import type { BlockScope, BlockSeriesMeta } from '@/types/blocks'

const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Comprueba que la app esté desplegada y en marcha.',
    )
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const isHtml = contentType.includes('text/html')
    const hint =
      res.status === 500 && import.meta.env.DEV
        ? ' En desarrollo: ejecuta npm run dev (web + API) o arranca la API en el puerto 3001.'
        : isHtml && res.ok
          ? ' La ruta /api devuelve HTML: en Coolify quita la etiqueta caddy_0.try_files.'
          : ' Abre /api/health en el navegador (debe ser JSON).'
    throw new ApiError(
      res.ok
        ? `El servidor devolvió una respuesta inválida (¿la API está activa?).${hint}`
        : `Error del servidor (${res.status}).${hint}`,
      res.status,
    )
  }

  const data = await res.json().catch(() => {
    throw new ApiError('Respuesta JSON inválida del servidor.', res.status)
  })

  if (!res.ok) {
    const payload = data as { error?: string; code?: string }
    throw new ApiError(payload.error ?? 'Error en la solicitud', res.status, payload.code)
  }

  return data as T
}

export function verifyAdminToken(adminToken: string) {
  return request<{ ok: true }>('/auth/verify', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })
}

export function fetchServices() {
  return request<{ services?: BookableService[] }>('/services').then((res) => ({
    services: Array.isArray(res.services) ? res.services : [],
  }))
}

export function fetchServiceCategories() {
  return request<{ categories?: ServiceCategory[] }>('/service-categories').then((res) => ({
    categories: Array.isArray(res.categories) ? res.categories : [],
  }))
}

export function fetchStaffForService(serviceId: string) {
  const params = new URLSearchParams({ serviceId })
  return request<{ staff?: StaffMember[] }>(`/staff?${params}`).then((res) => ({
    staff: Array.isArray(res.staff) ? res.staff : [],
  }))
}

export function fetchSlots(date: string, serviceId: string, staffId: string) {
  const params = new URLSearchParams({ date, serviceId, staffId })
  return request<{ slots?: string[] }>(`/slots?${params}`).then((res) => ({
    slots: Array.isArray(res.slots) ? res.slots : [],
  }))
}

export function fetchServiceDaySlots(date: string, serviceIds: string[]) {
  const params = new URLSearchParams({
    date,
    serviceIds: serviceIds.join(','),
  })
  return request<{ slots?: string[] }>(`/slots?${params}`).then((res) => ({
    slots: Array.isArray(res.slots) ? res.slots : [],
  }))
}

export function fetchStaffAtSlot(date: string, serviceIds: string[], startTime: string) {
  const params = new URLSearchParams({
    date,
    serviceIds: serviceIds.join(','),
    startTime,
  })
  return request<{ staff?: StaffMember[] }>(`/staff?${params}`).then((res) => ({
    staff: Array.isArray(res.staff) ? res.staff : [],
  }))
}

export function fetchBookingChainContinuation(
  date: string,
  serviceIds: string[],
  startTime: string,
  staffAssignments: string[],
) {
  const params = new URLSearchParams({
    date,
    serviceIds: serviceIds.join(','),
    startTime,
    staffAssignments: staffAssignments.join(','),
  })
  return request<BookingChainContinuation>(`/booking/chain?${params}`)
}

export function createAppointment(payload: CreateAppointmentPayload) {
  return request<{ appointment: Appointment; appointments?: Appointment[] }>('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchDaySchedule(date: string, adminToken: string) {
  const params = new URLSearchParams({ date })
  return request<{ date: string; schedules?: StaffDaySchedule[] }>(`/schedule/day?${params}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).then((res) => ({
    date: res.date,
    schedules: Array.isArray(res.schedules) ? res.schedules : [],
  }))
}

export function fetchAppointments(from: string, to: string, adminToken: string) {
  const params = new URLSearchParams({ from, to })
  return request<{ appointments?: Appointment[] }>(`/appointments?${params}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).then((res) => ({
    appointments: Array.isArray(res.appointments) ? res.appointments : [],
  }))
}

export function cancelAppointment(
  id: string,
  adminToken: string,
  options?: { notifyCustomerWhatsApp?: boolean },
) {
  return request<{ appointment: Appointment }>(`/appointments/${id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      notifyCustomerWhatsApp: options?.notifyCustomerWhatsApp === true,
    }),
  })
}

export function markAppointmentNoShow(
  id: string,
  adminToken: string,
  options?: { sendWhatsApp?: boolean },
) {
  return request<{ appointment: Appointment }>(`/appointments/${id}/no-show`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      sendWhatsApp: options?.sendWhatsApp === true,
    }),
  })
}

export function deleteAppointment(id: string, adminToken: string) {
  return request<{ ok: true }>(`/appointments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  })
}

function adminHeaders(adminToken: string) {
  return { Authorization: `Bearer ${adminToken}` }
}

export function fetchStaffServicesForAdmin(staffId: string, adminToken: string) {
  const params = new URLSearchParams({ staffId })
  return request<{ services?: BookableService[] }>(`/schedule/services?${params}`, {
    headers: adminHeaders(adminToken),
  }).then((res) => ({ services: res.services ?? [] }))
}

export function fetchAdminSlots(
  date: string,
  serviceId: string,
  staffId: string,
  adminToken: string,
  excludeAppointmentId?: string,
) {
  const params = new URLSearchParams({ date, serviceId, staffId })
  if (excludeAppointmentId) params.set('excludeAppointmentId', excludeAppointmentId)
  return request<{ slots?: string[] }>(`/schedule/slots?${params}`, {
    headers: adminHeaders(adminToken),
  }).then((res) => ({ slots: res.slots ?? [] }))
}

export type AdminAppointmentPayload = {
  staffId: string
  serviceId: string
  date: string
  startTime: string
  customerFirstName: string
  customerLastName?: string
  customerPhone: string
  customerEmail?: string
  customerNotes?: string
  notes?: string
  customerLocale?: 'es' | 'en'
  notifyCustomerWhatsApp?: boolean
}

export function createAdminAppointment(payload: AdminAppointmentPayload, adminToken: string) {
  return request<{ appointment: Appointment }>('/schedule/appointments', {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(payload),
  })
}

export function updateAdminAppointment(
  id: string,
  adminToken: string,
  patch: Partial<AdminAppointmentPayload>,
) {
  return request<{ appointment: Appointment }>(`/schedule/appointments/${id}`, {
    method: 'PATCH',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(patch),
  })
}

export function fetchAdminBlockSeries(adminToken: string, blockId: string) {
  return request<{ series: BlockSeriesMeta }>(`/schedule/blocks/${blockId}/series`, {
    headers: adminHeaders(adminToken),
  }).then((res) => res.series)
}

export function createAdminBlock(
  adminToken: string,
  payload: {
    staffId: string
    date: string
    startTime: string
    endTime: string
    note?: string
    scope?: BlockScope
    endDate?: string
  },
) {
  return request<{ block: { id: string }; series?: BlockSeriesMeta }>('/schedule/blocks', {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(payload),
  })
}

export function updateAdminBlock(
  adminToken: string,
  blockId: string,
  payload: { note?: string | null; mode?: 'single' | 'series' },
) {
  return request<{ block: { id: string; note: string | null } }>(`/schedule/blocks/${blockId}`, {
    method: 'PATCH',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(payload),
  })
}

export function fetchCustomers(adminToken: string, q?: string) {
  const params = new URLSearchParams()
  if (q?.trim()) params.set('q', q.trim())
  const qs = params.toString()
  return request<{ customers: Customer[] }>(`/customers${qs ? `?${qs}` : ''}`, {
    headers: adminHeaders(adminToken),
  }).then((res) => ({ customers: res.customers ?? [] }))
}

export function fetchCustomerDetail(adminToken: string, phone: string) {
  return request<CustomerDetail>(`/customers/${encodeURIComponent(phone)}`, {
    headers: adminHeaders(adminToken),
  })
}

export function sendCustomerReviewRequest(
  adminToken: string,
  phone: string,
  options?: { appointmentId?: string },
) {
  return request<{ reviewRequestSentAt: string }>(
    `/customers/${encodeURIComponent(phone)}/review-request`,
    {
      method: 'POST',
      headers: adminHeaders(adminToken),
      body: JSON.stringify(options ?? {}),
    },
  )
}

export function updateCustomer(
  adminToken: string,
  phone: string,
  payload: {
    firstName: string
    lastName?: string
    email?: string | null
    notes?: string | null
    locale?: 'es' | 'en'
  },
) {
  return request<{ customer: CustomerDetail['customer'] }>(
    `/customers/${encodeURIComponent(phone)}`,
    {
      method: 'PATCH',
      headers: adminHeaders(adminToken),
      body: JSON.stringify(payload),
    },
  )
}

export function createCustomer(
  adminToken: string,
  payload: {
    phone: string
    firstName: string
    lastName?: string
    email?: string | null
    notes?: string | null
    locale?: 'es' | 'en'
  },
) {
  return request<{ customer: CustomerDetail['customer'] }>('/customers', {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(payload),
  })
}

export function deleteCustomer(adminToken: string, phone: string) {
  return request<{ ok: true }>(`/customers/${encodeURIComponent(phone)}`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}

export function deleteAdminBlock(
  id: string,
  adminToken: string,
  mode: 'single' | 'series' = 'single',
) {
  const params = new URLSearchParams({ mode })
  return request<{ ok: true }>(`/schedule/blocks/${id}?${params}`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}
