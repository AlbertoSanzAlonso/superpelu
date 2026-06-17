import type {
  Appointment,
  BookableService,
  BookingChainContinuation,
  CreateAppointmentPayload,
  ServiceCategory,
  StaffMember,
} from '@/types/booking'
import { request, encodeServiceStartOverrides } from './request'

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
  serviceStartOverrides: (string | undefined)[] = [],
) {
  const params = new URLSearchParams({
    date,
    serviceIds: serviceIds.join(','),
    startTime,
    staffAssignments: staffAssignments.join(','),
    serviceStartOverrides: encodeServiceStartOverrides(
      serviceStartOverrides.length > 0
        ? serviceStartOverrides
        : Array.from({ length: serviceIds.length }, () => undefined),
    ),
  })
  return request<BookingChainContinuation>(`/booking/chain?${params}`)
}

export function createAppointment(payload: CreateAppointmentPayload) {
  return request<{ appointment: Appointment; appointments?: Appointment[] }>('/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
