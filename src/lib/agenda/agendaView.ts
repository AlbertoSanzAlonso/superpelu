import { addDaysToDateString, dayOfWeekFromDateString } from '@/lib/core/dates'

export type AgendaViewMode = 'day' | '3days' | 'week'

const STORAGE_KEY = 'agenda-admin-view'

export function isAgendaViewMode(value: string): value is AgendaViewMode {
  return value === 'day' || value === '3days' || value === 'week'
}

export function readStoredAgendaView(): AgendaViewMode {
  if (typeof sessionStorage === 'undefined') return 'day'
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw && isAgendaViewMode(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'day'
}

export function storeAgendaView(view: AgendaViewMode): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, view)
  } catch {
    /* ignore */
  }
}

/** Lunes de la semana (Europa) para una fecha YYYY-MM-DD. */
export function mondayOfWeekContaining(dateStr: string): string {
  const dow = dayOfWeekFromDateString(dateStr) // 0=dom … 6=sáb
  const daysFromMonday = dow === 0 ? 6 : dow - 1
  return addDaysToDateString(dateStr, -daysFromMonday)
}

/** Fechas visibles según vista y fecha ancla. */
export function datesForAgendaView(view: AgendaViewMode, anchorDate: string): string[] {
  if (view === 'day') return [anchorDate]
  if (view === '3days') {
    return [0, 1, 2].map((offset) => addDaysToDateString(anchorDate, offset))
  }
  const monday = mondayOfWeekContaining(anchorDate)
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDaysToDateString(monday, offset))
}

export function agendaViewNavStep(view: AgendaViewMode): number {
  if (view === '3days') return 3
  if (view === 'week') return 7
  return 1
}

export function agendaViewLabel(view: AgendaViewMode): string {
  if (view === '3days') return '3 días'
  if (view === 'week') return 'Semana'
  return 'Día'
}
