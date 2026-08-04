import {
  adminAppointmentNotificationKindLabel,
  formatAdminAppointmentNotificationTime,
  type AdminAppointmentNotificationItem,
} from '@/lib/agenda/adminNotifications'
import { formatDisplayDate } from '@/lib/core/dates'

export function requestAdminNotificationPermission(): void {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'default') return
  void Notification.requestPermission()
}

function shouldShowBrowserNotification(): boolean {
  return document.hidden || !document.hasFocus()
}

export function showAdminBrowserNotifications(items: AdminAppointmentNotificationItem[]): void {
  if (items.length === 0) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!shouldShowBrowserNotification()) return

  for (const item of items) {
    const title = adminAppointmentNotificationKindLabel(item.kind)
    const time = formatAdminAppointmentNotificationTime(item.startTime)
    const date = formatDisplayDate(item.date)
    const detail =
      item.treatmentCount && item.treatmentCount > 1
        ? `${item.treatmentCount} tratamientos · ${item.staffName}`
        : `${item.serviceName} · ${item.staffName}`
    const body = `${item.customerName} · ${detail} — ${date} ${time}`
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: item.key,
    })
  }
}
