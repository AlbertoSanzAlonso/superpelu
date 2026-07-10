import { isColorGroupWashRow } from '@/lib/booking/occupancy'
import { addDaysToDateString, todaySalon } from '@/lib/core/dates'
import type { Appointment } from '@/types/booking'

export type AdminAppointmentNotificationKind =
  | 'created'
  | 'cancelled'
  | 'modified'
  | 'series_created'
  | 'series_ended'

export type AdminAppointmentNotificationItem = {
  key: string
  kind: AdminAppointmentNotificationKind
  id: string
  date: string
  staffId: string
  staffName: string
  customerName: string
  customerPhone: string
  serviceName: string
  startTime: string
  timestamp: number
  seriesId?: string
  seriesCount?: number
  seriesEndDate?: string
}

export type AppointmentSnapshot = {
  id: string
  date: string
  startTime: string
  staffId: string
  staffName: string
  customerName: string
  customerPhone: string
  serviceId: string
  serviceName: string
  status: string
  seriesId: string | null
}

export const ADMIN_APPOINTMENT_NOTIFY_RANGE_DAYS = 90
export const ADMIN_APPOINTMENT_TOAST_MS = 6_000
export const ADMIN_APPOINTMENT_NOTIFY_MAX_AGE_MS = 3_600_000

const ACTIVE_STATUSES = new Set(['confirmed', 'pending'])

export function adminAppointmentNotifyDateRange(): { from: string; to: string } {
  const from = todaySalon()
  return { from, to: addDaysToDateString(from, ADMIN_APPOINTMENT_NOTIFY_RANGE_DAYS) }
}

export function isTrackableAdminAppointment(apt: Appointment): boolean {
  if (!apt.staffId) return false
  return !isColorGroupWashRow(apt.colorGroupRole)
}

function isActiveAppointmentStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status)
}

export function buildAppointmentSnapshot(apt: Appointment): AppointmentSnapshot | null {
  if (!isTrackableAdminAppointment(apt)) return null
  return {
    id: apt.id,
    date: apt.date,
    startTime: apt.startTime,
    staffId: apt.staffId!,
    staffName: apt.staffName ?? '',
    customerName: apt.customerName,
    customerPhone: apt.customerPhone,
    serviceId: apt.serviceId,
    serviceName: apt.serviceName,
    status: apt.status,
    seriesId: apt.seriesId ?? null,
  }
}

function snapshotToNotificationItem(
  snapshot: AppointmentSnapshot,
  kind: AdminAppointmentNotificationKind,
): AdminAppointmentNotificationItem {
  return {
    key: `${snapshot.id}-${kind}-${Date.now()}`,
    kind,
    id: snapshot.id,
    date: snapshot.date,
    staffId: snapshot.staffId,
    staffName: snapshot.staffName,
    customerName: snapshot.customerName,
    customerPhone: snapshot.customerPhone,
    serviceName: snapshot.serviceName,
    startTime: snapshot.startTime,
    timestamp: Date.now(),
    seriesId: snapshot.seriesId ?? undefined,
  }
}

export function detectAppointmentNotificationKind(
  previous: AppointmentSnapshot | undefined,
  current: AppointmentSnapshot,
  isNew: boolean,
): AdminAppointmentNotificationKind | null {
  if (isNew) {
    return isActiveAppointmentStatus(current.status) ? 'created' : null
  }
  if (!previous) return null

  const wasActive = isActiveAppointmentStatus(previous.status)
  const isActive = isActiveAppointmentStatus(current.status)

  if (wasActive && !isActive) return 'cancelled'
  if (!wasActive) return null

  if (
    previous.date !== current.date ||
    previous.startTime !== current.startTime ||
    previous.staffId !== current.staffId ||
    previous.serviceId !== current.serviceId
  ) {
    return 'modified'
  }

  return null
}

function collapseSeriesItems(
  items: AdminAppointmentNotificationItem[],
): AdminAppointmentNotificationItem[] {
  const seriesGroups = new Map<string, AdminAppointmentNotificationItem[]>()
  const standalone: AdminAppointmentNotificationItem[] = []

  for (const item of items) {
    if (item.seriesId && item.kind === 'created') {
      const group = seriesGroups.get(item.seriesId) ?? []
      group.push(item)
      seriesGroups.set(item.seriesId, group)
    } else {
      standalone.push(item)
    }
  }

  for (const [, group] of seriesGroups) {
    const first = group[0]
    standalone.push({
      ...first,
      key: `series-${first.seriesId}-created-${Date.now()}`,
      kind: 'series_created',
      seriesCount: group.length,
    })
  }

  return standalone
}

export function diffAppointmentSnapshots(
  previousById: ReadonlyMap<string, AppointmentSnapshot>,
  appointments: Appointment[],
): AdminAppointmentNotificationItem[] {
  const items: AdminAppointmentNotificationItem[] = []
  const seenIds = new Set<string>()

  for (const apt of appointments) {
    const current = buildAppointmentSnapshot(apt)
    if (!current) continue
    seenIds.add(current.id)

    const previous = previousById.get(current.id)
    const isNew = previous === undefined
    const kind = detectAppointmentNotificationKind(previous, current, isNew)
    if (kind) items.push(snapshotToNotificationItem(current, kind))
  }

  for (const [id, previous] of previousById) {
    if (seenIds.has(id)) continue
    if (!isActiveAppointmentStatus(previous.status)) continue
    items.push(snapshotToNotificationItem(previous, 'cancelled'))
  }

  return collapseSeriesItems(items)
}

export function snapshotsFromAppointments(appointments: Iterable<Appointment>): Map<string, AppointmentSnapshot> {
  const map = new Map<string, AppointmentSnapshot>()
  for (const apt of appointments) {
    const snapshot = buildAppointmentSnapshot(apt)
    if (snapshot) map.set(snapshot.id, snapshot)
  }
  return map
}

export function formatAdminAppointmentNotificationTime(startTime: string): string {
  return startTime.slice(0, 5)
}

export function adminAppointmentNotificationKindLabel(kind: AdminAppointmentNotificationKind): string {
  switch (kind) {
    case 'created':
      return 'Nueva cita'
    case 'cancelled':
      return 'Cita cancelada'
    case 'modified':
      return 'Cita modificada'
    case 'series_created':
      return 'Serie semanal creada'
    case 'series_ended':
      return 'Serie finalizada'
  }
}
