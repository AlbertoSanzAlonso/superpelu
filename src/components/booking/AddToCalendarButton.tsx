import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  addAppointmentToCalendar,
  buildGoogleCalendarUrl,
  downloadAppointmentIcs,
} from '@/lib/calendar'
import type { Appointment } from '@/types/booking'

type Props = {
  appointment: Appointment
}

const DESKTOP_QUERY = '(min-width: 768px)'

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => setIsDesktop(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

const menuItemClass =
  'block w-full cursor-pointer px-4 py-3 text-left font-sans text-xs uppercase tracking-wide text-charcoal transition-colors hover:bg-gold/10 hover:text-gold-dark focus:bg-gold/10 focus:text-gold-dark focus:outline-none'

export function AddToCalendarButton({ appointment }: Props) {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Móvil: un solo botón con detección de dispositivo (Android → Google, iPhone → .ics nativo).
  if (!isDesktop) {
    return (
      <Button
        variant="solid"
        size="md"
        className="w-full"
        onClick={() => addAppointmentToCalendar(appointment)}
      >
        Añadir al calendario
      </Button>
    )
  }

  // Escritorio: menú con opciones de calendario.
  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="solid"
        size="md"
        className="w-full"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Añadir al calendario
      </Button>
      {open && (
        <div
          role="menu"
          className="ui-rounded absolute left-1/2 z-20 mt-2 w-64 -translate-x-1/2 overflow-hidden border border-gold/25 bg-cream shadow-[0_18px_40px_-20px_rgba(31,31,31,0.45)]"
        >
          <a
            href={buildGoogleCalendarUrl(appointment)}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={menuItemClass}
            onClick={() => setOpen(false)}
          >
            Google Calendar
          </a>
          <button
            type="button"
            role="menuitem"
            className={`${menuItemClass} border-t border-gold/15`}
            onClick={() => {
              downloadAppointmentIcs(appointment)
              setOpen(false)
            }}
          >
            Apple Calendar / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  )
}
