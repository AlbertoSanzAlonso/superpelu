import { request, adminHeaders } from './request'

export type AdminService = {
  id: string
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  categoryNameEs: string | null
  bookableOnline: boolean
  active: boolean
  sortOrder: number
}

export type AdminServiceCategory = {
  id: string
  nameEs: string
  nameEn: string
  active: boolean
  sortOrder: number
  priceFromCents: number | null
  priceNote: string | null
  serviceCount: number
}

export function fetchAdminServices(adminToken: string) {
  return request<{ services: AdminService[] }>('/admin/services', {
    headers: adminHeaders(adminToken),
  }).then((res) => ({ services: res.services ?? [] }))
}

export function createAdminService(
  adminToken: string,
  data: {
    nameEs: string
    nameEn: string
    durationMinutes: number
    categoryId: string | null
    bookableOnline: boolean
    sortOrder: number
  },
) {
  return request<{ service: AdminService }>('/admin/services', {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(data),
  })
}

export function updateAdminService(
  adminToken: string,
  id: string,
  data: {
    nameEs?: string
    nameEn?: string
    durationMinutes?: number
    categoryId?: string | null
    bookableOnline?: boolean
    active?: boolean
    sortOrder?: number
  },
) {
  return request<{ ok: true }>(`/admin/services/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(data),
  })
}

export function deleteAdminService(adminToken: string, id: string) {
  return request<{ ok: true }>(`/admin/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}

export function hardDeleteAdminService(adminToken: string, id: string) {
  return request<{ ok: true }>(`/admin/services/${encodeURIComponent(id)}/hard`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}

export function fetchAdminServiceCategories(adminToken: string) {
  return request<{ categories: AdminServiceCategory[] }>('/admin/service-categories', {
    headers: adminHeaders(adminToken),
  }).then((res) => ({ categories: res.categories ?? [] }))
}

export function createAdminServiceCategory(
  adminToken: string,
  data: {
    id: string
    nameEs: string
    nameEn: string
    sortOrder: number
    priceFromCents?: number | null
    priceNote?: string | null
  },
) {
  return request<{ category: AdminServiceCategory }>('/admin/service-categories', {
    method: 'POST',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(data),
  })
}

export function updateAdminServiceCategory(
  adminToken: string,
  id: string,
  data: {
    nameEs?: string
    nameEn?: string
    active?: boolean
    sortOrder?: number
    priceFromCents?: number | null
    priceNote?: string | null
  },
) {
  return request<{ ok: true }>(`/admin/service-categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: adminHeaders(adminToken),
    body: JSON.stringify(data),
  })
}

export function deleteAdminServiceCategory(adminToken: string, id: string) {
  return request<{ ok: true }>(`/admin/service-categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}

export function hardDeleteAdminServiceCategory(adminToken: string, id: string) {
  return request<{ ok: true }>(`/admin/service-categories/${encodeURIComponent(id)}/hard`, {
    method: 'DELETE',
    headers: adminHeaders(adminToken),
  })
}
