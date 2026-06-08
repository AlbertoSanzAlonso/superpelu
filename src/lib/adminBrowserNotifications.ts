import {
  adminAppointmentNotificationKindLabel,
  formatAdminAppointmentNotificationTime,
  type AdminAppointmentNotificationItem,
} from '@/lib/adminAppointmentNotifications'
import { formatDisplayDate } from '@/lib/dates'

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
    const body = `${item.customerName} · ${item.serviceName} · ${item.staffName} — ${date} ${time}`
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: item.key,
    })
  }
}
