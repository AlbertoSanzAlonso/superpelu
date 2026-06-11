import { useEffect, useRef } from 'react'
import { formatDisplayDate } from '@/lib/core/dates'
import {
  adminAppointmentNotificationKindLabel,
  formatAdminAppointmentNotificationTime,
  type AdminAppointmentNotificationItem,
} from '@/lib/agenda/adminNotifications'
import { typography } from '@/styles/typography'

type Props = {
  inbox: AdminAppointmentNotificationItem[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (item: AdminAppointmentNotificationItem) => void
}

function BellIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.454 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
      />
    </svg>
  )
}

function kindBadgeClass(kind: AdminAppointmentNotificationItem['kind']): string {
  switch (kind) {
    case 'created':
      return 'text-emerald-700'
    case 'cancelled':
      return 'text-red-700'
    case 'modified':
      return 'text-amber-800'
  }
}

export function AdminAppointmentNotificationsBell({
  inbox,
  open,
  onOpen,
  onClose,
  onSelect,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, onClose])

  const badge = inbox.length

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center border border-gold/30 text-gold hover:border-gold hover:bg-gold/10"
        aria-label={
          badge > 0 ? `Novedades en la agenda, ${badge} sin leer` : 'Novedades en la agenda'
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BellIcon />
        {badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold tabular-nums text-cream">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] w-[min(20rem,calc(100vw-1.5rem))] border border-gold/30 bg-cream shadow-[0_16px_48px_-16px_rgba(30,30,30,0.4)] backdrop-blur-none"
          role="menu"
        >
          <div className="border-b border-gold/15 px-3 py-2">
            <p className={`${typography.label} text-gold`}>Novedades</p>
          </div>
          {inbox.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-charcoal-muted">
              No hay novedades desde la última vez.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {inbox.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full cursor-pointer border-b border-gold/10 px-3 py-2.5 text-left hover:bg-gold/5"
                    onClick={() => onSelect(item)}
                  >
                    <p className={`text-[10px] font-medium uppercase tracking-wide ${kindBadgeClass(item.kind)}`}>
                      {adminAppointmentNotificationKindLabel(item.kind)}
                    </p>
                    <p className="text-sm font-medium text-charcoal">{item.customerName}</p>
                    <p className="text-xs text-charcoal-muted">
                      {item.serviceName} · {item.staffName}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-charcoal-muted">
                      {formatDisplayDate(item.date)} ·{' '}
                      {formatAdminAppointmentNotificationTime(item.startTime)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
