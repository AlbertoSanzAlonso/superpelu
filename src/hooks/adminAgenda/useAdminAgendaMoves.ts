import { useCallback, useMemo, useState } from 'react'
import {
  isSameAppointmentMove,
  validateAppointmentMove,
  type AppointmentMoveTarget,
} from '@/lib/appointmentPlacement'
import {
  getEffectivePlacement,
  getFinalMovesForSave,
  summarizePendingMoves,
  type AppointmentMoveDraft,
} from '@/lib/pendingAppointmentMoves'
import { ApiError, updateAdminAppointment } from '@/lib/api'
import type { StaffDaySchedule } from '@/types/booking'
import type { AppointmentDragEndPayload } from '@/components/agenda/admin/DraggableAppointmentBlock'
type MovesDeps = {
  adminToken: string
  date: string
  schedules: StaffDaySchedule[]
  load: () => Promise<void>
  setError: (message: string) => void
  clearSelection: () => void
  onMovesCommitted: () => void
}

export function useAdminAgendaMoves({
  adminToken,
  date,
  schedules,
  load,
  setError,
  clearSelection,
  onMovesCommitted,
}: MovesDeps) {
  const [pendingMoves, setPendingMoves] = useState<AppointmentMoveDraft[]>([])
  const [moveBusy, setMoveBusy] = useState(false)

  const pendingMoveSummary = useMemo(
    () => summarizePendingMoves(pendingMoves),
    [pendingMoves],
  )

  const proposeAppointmentMove = useCallback(
    (payload: AppointmentDragEndPayload) => {
      const summary = summarizePendingMoves(pendingMoves)
      const effective = getEffectivePlacement(summary, payload.appointment.id, {
        staffId: payload.fromStaffId,
        startTime: payload.appointment.startTime,
      })

      const fromStaffId = effective.staffId
      const fromStartTime = effective.startTime
      const fromStaffName =
        schedules.find((s) => s.staffId === fromStaffId)?.staffName ?? ''
      const toStaffName =
        schedules.find((s) => s.staffId === payload.toStaffId)?.staffName ?? ''
      const target: AppointmentMoveTarget = {
        staffId: payload.toStaffId,
        staffName: toStaffName,
        startTime: payload.toStartTime,
      }

      if (isSameAppointmentMove(fromStaffId, fromStartTime, target)) {
        return
      }

      const validation = validateAppointmentMove(
        schedules,
        date,
        payload.appointment,
        target,
        pendingMoves,
      )
      if (!validation.ok) {
        setError(validation.message)
        return
      }

      setError('')
      clearSelection()
      setPendingMoves((prev) => [
        ...prev,
        {
          appointment: payload.appointment,
          fromStaffId,
          fromStaffName,
          fromStartTime,
          toStaffId: payload.toStaffId,
          toStaffName,
          toStartTime: payload.toStartTime,
        },
      ])
    },
    [schedules, date, pendingMoves, setError, clearSelection],
  )

  const undoLastPendingMove = useCallback(() => {
    setPendingMoves((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)))
    setError('')
  }, [setError])

  const discardPendingMoves = useCallback(() => {
    setPendingMoves([])
    setError('')
  }, [setError])

  const commitPendingMoves = useCallback(
    async (notifyCustomerWhatsApp?: boolean): Promise<boolean> => {
      if (pendingMoves.length === 0 || !adminToken) return false
      setError('')
      setMoveBusy(true)
      try {
        for (const move of getFinalMovesForSave(pendingMoves)) {
          await updateAdminAppointment(move.appointment.id, adminToken, {
            staffId: move.toStaffId,
            date,
            startTime: move.toStartTime,
            notifyCustomerWhatsApp,
          })
        }
        setPendingMoves([])
        onMovesCommitted()
        await load()
        return true
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar los cambios')
        return false
      } finally {
        setMoveBusy(false)
      }
    },
    [pendingMoves, adminToken, date, load, setError, onMovesCommitted],
  )

  const requestSavePendingMoves = useCallback(() => {
    if (pendingMoves.length === 0) return false
    return true
  }, [pendingMoves.length])

  const resetMoves = useCallback(() => {
    setPendingMoves([])
  }, [])

  return {
    pendingMoves,
    pendingMoveSummary,
    proposeAppointmentMove,
    undoLastPendingMove,
    discardPendingMoves,
    commitPendingMoves,
    requestSavePendingMoves,
    moveBusy,
    resetMoves,
  }
}
