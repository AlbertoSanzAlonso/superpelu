import { useEffect } from 'react'
import { formatDisplayDate } from '@/lib/dates'
import {
  ADMIN_APPOINTMENT_TOAST_MS,
  formatAdminAppointmentNotificationTime,
  type AdminAppointmentNotificationItem,
} from '@/lib/adminAppointmentNotifications'
import { typography } from '@/styles/typography'

type ToastEntry = {
  key: string
  item: AdminAppointmentNotificationItem
}

type Props = {
  toasts: ToastEntry[]
  onDismiss: (key: string) => void
  onSelect: (item: AdminAppointmentNotificationItem) => void
}

export function AdminAppointmentToastStack({ toasts, onDismiss, onSelect }: Props) {
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[min(100vw-2rem,22rem)] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <AdminAppointmentToast
          key={toast.key}
          item={toast.item}
          onDismiss={() => onDismiss(toast.key)}
          onSelect={() => onSelect(toast.item)}
        />
      ))}
    </div>
  )
}

function AdminAppointmentToast({
  item,
  onDismiss,
  onSelect,
}: {
  item: AdminAppointmentNotificationItem
  onDismiss: () => void
  onSelect: () => void
}) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, ADMIN_APPOINTMENT_TOAST_MS)
    return () => window.clearTimeout(id)
  }, [onDismiss])

  return (
    <button
      type="button"
      onClick={onSelect}
      className="pointer-events-auto w-full cursor-pointer border border-gold/40 bg-cream px-4 py-3 text-left shadow-[0_12px_40px_-12px_rgba(30,30,30,0.35)] transition hover:border-gold hover:bg-gold/5"
    >
      <p className={`${typography.label} text-gold`}>Nueva cita</p>
      <p className="mt-1 text-sm font-medium text-charcoal">{item.customerName}</p>
      <p className="text-xs text-charcoal-muted">
        {item.serviceName} · {item.staffName}
      </p>
      <p className="mt-1 text-xs tabular-nums text-charcoal-muted">
        {formatDisplayDate(item.date)} · {formatAdminAppointmentNotificationTime(item.startTime)}
      </p>
    </button>
  )
}
