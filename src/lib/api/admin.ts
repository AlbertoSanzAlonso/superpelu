import type { Appointment, BookableService, StaffDaySchedule } from '@/types/booking'
import type { Customer, CustomerDetail } from '@/types/customers'
import type { BlockScope, BlockSeriesMeta } from '@/types/blocks'
import type { AppointmentSeriesMeta, AppointmentSeriesMode } from '@/types/appointmentSeries'
import type { FullScheduleData, SalonScheduleData, ScheduleTimeRange } from '@/types/schedule'
import { request, adminHeaders, encodeServiceStartOverrides } from './request'

export function verifyAdminToken(adminToken: string) {
  return request<{ ok: true }>('/auth/verify', {
    headers: { Authorization: `Bearer ${adminToken}` },
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
  options?: { notifyCustomerWhatsApp?: boolean; mode?: AppointmentSeriesMode },
) {
  return request<{ appointment: Appointment }>(`/appointments/${id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      notifyCustomerWhatsApp: options?.notifyCustomerWhatsApp === true,
      mode: options?.mode,
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

export function deleteAppointment(
  id: string,
  adminToken: string,
  mode: AppointmentSeriesMode = 'single',
) {
  const params = mode === 'series' ? '?mode=series' : ''
  return request<{ ok: true }>(`/appointments/${id}${params}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  })
}

export function fetchAdminAppointmentSeries(adminToken: string, appointmentId: string) {
  return request<{ series: AppointmentSeriesMeta }>(
    `/schedule/appointments/${appointmentId}/series`,
    { headers: adminHeaders(adminToken) },
  ).then((res) => res.series)
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
  return request<{ slots?: string[]; slotsOverHours?: string[] }>(`/schedule/slots?${params}`, {
    headers: adminHeaders(adminToken),
  }).then((res) => ({ slots: res.slots ?? [], slotsOverHours: res.slotsOverHours ?? [] }))
}

export type AdminAppointmentPayload = {
  staffId: string
  staffAssignments?: string[]
  serviceIds: string[]
  serviceId?: string
  /** Hora de inicio individual por tratamiento (misma longitud que serviceIds); si falta, se encadenan desde startTime. */
  serviceStartTimes?: string[]
  /** Duración personalizada por tratamiento (minutos). Si no se envía, se usa la del catálogo. */
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
  notifyCustomerWhatsApp?: boolean
  scope?: BlockScope
  endDate?: string
  conflictResolutions?: SeriesConflictResolution[]
  forceSchedule?: boolean
}

export type SeriesConflictResolution = {
  date: string
  action: 'skip' | 'reassign' | 'reschedule'
  staffId?: string
  startTime?: string
}

export type SeriesDateConflict = {
  date: string
  serviceIndex: number
  serviceName: string
  staffId: string
  staffName: string
  idealStartTime: string
  availableSlots: string[]
  availableStaff: { id: string; name: string; freeSlots: string[] }[]
}

export type SeriesPreviewResult = {
  dates: string[]
  conflicts: SeriesDateConflict[]
  okDates: string[]
}

export function createAdminAppointment(payload: AdminAppointmentPayload, adminToken: string) {
  return request<{ appointment: Appointment }>('/schedule/appointments', {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(payload),
  })
}

export function previewSeriesConflicts(
  payload: Omit<AdminAppointmentPayload, 'conflictResolutions'>,
  adminToken: string,
) {
  return request<SeriesPreviewResult>('/schedule/appointments/preview-series', {
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

function appendServiceDurations(
  params: URLSearchParams,
  serviceDurations?: (number | null)[],
) {
  if (!serviceDurations?.length) return
  params.set(
    'serviceDurations',
    serviceDurations.map((duration) =>
      duration != null && duration > 0 ? String(duration) : '',
    ).join(','),
  )
}

export function fetchAdminMultiSlots(
  date: string,
  serviceIds: string[],
  staffId: string,
  adminToken: string,
  excludeAppointmentId?: string,
  serviceDurations?: (number | null)[],
) {
  const params = new URLSearchParams({ date, serviceIds: serviceIds.join(','), staffId })
  if (excludeAppointmentId) params.set('excludeAppointmentId', excludeAppointmentId)
  appendServiceDurations(params, serviceDurations)
  return request<{ slots?: string[]; slotsOverHours?: string[] }>(`/schedule/slots?${params}`, {
    headers: adminHeaders(adminToken),
  }).then((res) => ({ slots: res.slots ?? [], slotsOverHours: res.slotsOverHours ?? [] }))
}

export function fetchAdminDaySlots(
  date: string,
  serviceIds: string[],
  adminToken: string,
  excludeAppointmentId?: string,
  serviceDurations?: (number | null)[],
) {
  const params = new URLSearchParams({ date, serviceIds: serviceIds.join(',') })
  if (excludeAppointmentId) params.set('excludeAppointmentId', excludeAppointmentId)
  appendServiceDurations(params, serviceDurations)
  return request<{ slots?: string[] }>(`/schedule/day-slots?${params}`, {
    headers: adminHeaders(adminToken),
  }).then((res) => res.slots ?? [])
}

export function fetchAdminChainContinuation(
  date: string,
  serviceIds: string[],
  startTime: string,
  staffAssignments: string[],
  adminToken: string,
  options: {
    excludeAppointmentId?: string
    serviceDurations?: (number | null)[]
    serviceStartOverrides?: (string | undefined)[]
  } = {},
) {
  const params = new URLSearchParams({
    date,
    serviceIds: serviceIds.join(','),
    startTime,
    staffAssignments: staffAssignments.join(','),
  })
  if (options.excludeAppointmentId) {
    params.set('excludeAppointmentId', options.excludeAppointmentId)
  }
  appendServiceDurations(params, options.serviceDurations)
  if (options.serviceStartOverrides?.length) {
    params.set(
      'serviceStartOverrides',
      encodeServiceStartOverrides(options.serviceStartOverrides),
    )
  }
  return request<import('@/types/booking').BookingChainContinuation>(`/schedule/chain?${params}`, {
    headers: adminHeaders(adminToken),
  })
}

export function fetchStaffAtSlotAdmin(
  date: string,
  serviceId: string,
  startTime: string,
  adminToken: string,
) {
  const params = new URLSearchParams({ date, serviceId, startTime })
  return request<{ staff: { id: string; name: string; role: string | null }[] }>(
    `/schedule/staff-at-slot?${params}`,
    { headers: adminHeaders(adminToken) },
  ).then((res) => ({ staff: res.staff ?? [] }))
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

export function fetchFullSchedule(adminToken: string) {
  return request<FullScheduleData>('/admin/schedule', {
    headers: adminHeaders(adminToken),
  })
}

export function updateSalonSchedule(
  adminToken: string,
  weeklyWindows: Record<number, ScheduleTimeRange[]>,
) {
  return request<SalonScheduleData>('/admin/schedule/salon', {
    method: 'PUT',
    headers: adminHeaders(adminToken),
    body: JSON.stringify({ weeklyWindows }),
  })
}

export function fetchStaffSpecialSchedule(
  adminToken: string,
  staffId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const params = new URLSearchParams()
  if (dateFrom) params.set('from', dateFrom)
  if (dateTo) params.set('to', dateTo)
  const qs = params.toString()
  return request<{ staffId: string; specialDays: Record<string, ScheduleTimeRange[]> }>(
    `/admin/schedule/special/${encodeURIComponent(staffId)}${qs ? `?${qs}` : ''}`,
    { headers: adminHeaders(adminToken) },
  )
}

export function updateStaffSpecialSchedule(
  adminToken: string,
  staffId: string,
  specialDays: Record<string, ScheduleTimeRange[]>,
) {
  return request<{ staffId: string; specialDays: Record<string, ScheduleTimeRange[]> }>(
    `/admin/schedule/special/${encodeURIComponent(staffId)}`,
    {
      method: 'PUT',
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ specialDays }),
    },
  )
}

export function deleteStaffSpecialDate(
  adminToken: string,
  staffId: string,
  date: string,
) {
  const params = new URLSearchParams({ date })
  return request<{ ok: true }>(
    `/admin/schedule/special/${encodeURIComponent(staffId)}?${params}`,
    { method: 'DELETE', headers: adminHeaders(adminToken) },
  )
}

export function fetchSalonSpecialSchedule(
  adminToken: string,
  dateFrom?: string,
  dateTo?: string,
) {
  const params = new URLSearchParams()
  if (dateFrom) params.set('from', dateFrom)
  if (dateTo) params.set('to', dateTo)
  const qs = params.toString()
  return request<{ specialDays: Record<string, ScheduleTimeRange[]> }>(
    `/admin/schedule/salon/special${qs ? `?${qs}` : ''}`,
    { headers: adminHeaders(adminToken) },
  )
}

export function updateSalonSpecialSchedule(
  adminToken: string,
  specialDays: Record<string, ScheduleTimeRange[]>,
) {
  return request<{ specialDays: Record<string, ScheduleTimeRange[]> }>(
    '/admin/schedule/salon/special',
    {
      method: 'PUT',
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ specialDays }),
    },
  )
}

export function deleteSalonSpecialDate(adminToken: string, date: string) {
  const params = new URLSearchParams({ date })
  return request<{ ok: true }>(`/admin/schedule/salon/special?${params}`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}

export function updateStaffSchedule(
  adminToken: string,
  staffId: string,
  weeklyWindows: Record<number, ScheduleTimeRange[]>,
) {
  return request<{ staffId: string; weeklyWindows: Record<number, ScheduleTimeRange[]> }>(
    `/admin/schedule/staff/${encodeURIComponent(staffId)}`,
    {
      method: 'PUT',
      headers: adminHeaders(adminToken),
      body: JSON.stringify({ weeklyWindows }),
    },
  )
}

export type StatsResponse = {
  totalAppointments: number
  appointmentsThisMonth: number
  newCustomers: number
  topServices: { id: string; name: string; count: number }[]
  topStaff: { id: string; name: string; count: number }[]
  appointmentsByDay: { date: string; count: number }[]
  appointmentsByMonth: { month: string; count: number }[]
  originDistribution: { origin: string; count: number; percentage: number }[]
}

export function fetchStats(adminToken: string) {
  return request<StatsResponse>('/admin/stats', {
    headers: adminHeaders(adminToken),
  })
}

// ── Staff CRUD ──────────────────────────────────────────────────────

export type AdminStaffMember = {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function fetchAdminStaff(adminToken: string) {
  return request<{ staff: AdminStaffMember[] }>('/admin/staff', {
    headers: adminHeaders(adminToken),
  })
}

export function createAdminStaff(
  adminToken: string,
  data: {
    id?: string
    name: string
    role: string | null
    phone: string | null
    email: string | null
    password: string
    sortOrder: number
  },
) {
  return request<{ staff: AdminStaffMember }>('/admin/staff', {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(data),
  })
}

export function updateAdminStaff(
  adminToken: string,
  id: string,
  data: {
    name?: string
    role?: string | null
    phone?: string | null
    email?: string | null
    password?: string
    active?: boolean
    sortOrder?: number
  },
) {
  return request<{ ok: true }>(`/admin/staff/${id}`, {
    method: 'PATCH',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(data),
  })
}

export function deleteAdminStaff(adminToken: string, id: string) {
  return request<{ ok: true }>(`/admin/staff/${id}`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}
