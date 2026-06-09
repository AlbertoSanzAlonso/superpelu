import { useCallback, useState } from 'react'
import { summarizeStaffColumnGridSelection } from '@/lib/agenda/gridSelection'
import type { StaffDaySchedule } from '@/types/booking'
import type { AdminColumnSelection } from './types'

export function useAdminAgendaSelection(schedules: StaffDaySchedule[], date: string) {
  const [selection, setSelection] = useState<AdminColumnSelection | null>(null)

  const clearSelection = useCallback(() => setSelection(null), [])

  const toggleSlot = useCallback(
    (staffId: string, staffName: string, time: string) => {
      setSelection((prev) => {
        if (prev?.staffId !== staffId) {
          return { staffId, staffName, times: new Set([time]) }
        }
        const next = new Set(prev.times)
        if (next.has(time)) next.delete(time)
        else next.add(time)
        if (next.size === 0) return null
        return { staffId, staffName, times: next }
      })
    },
    [],
  )

  const selectionSummary = useCallback(() => {
    if (!selection) {
      return { freeTimes: [], blockIds: [], hasAppointment: false }
    }
    return summarizeStaffColumnGridSelection(
      schedules,
      selection.staffId,
      date,
      selection.times,
    )
  }, [selection, schedules, date])

  const resetSelection = useCallback(() => setSelection(null), [])

  return {
    selection,
    setSelection,
    toggleSlot,
    clearSelection,
    selectionSummary,
    resetSelection,
  }
}
