import { useCallback, useMemo, useState } from 'react'
import {
  isSameAppointmentMove,
  validateAppointmentMove,
  validatePendingMovesForSave,
  type AppointmentMoveTarget,
} from '@/lib/agenda/placement'
import {
  getEffectivePlacement,
  getFinalMovesForSave,
  summarizePendingMoves,
  type AppointmentMoveDraft,
} from '@/lib/agenda/pendingMoves'
import { ApiError, updateAdminAppointment } from '@/lib/api'
import type { Appointment, StaffDaySchedule } from '@/types/booking'
import type { AppointmentDragEndPayload } from '@/components/agenda/admin/DraggableAppointmentBlock'
type MovesDeps = {
  adminToken: string
  date: string
  schedules: StaffDaySchedule[]
  load: (opts?: { silent?: boolean }) => Promise<StaffDaySchedule[] | null>
  setError: (message: string) => void
  clearSelection: () => void
  onMovesCommitted: () => void
  markAppointmentSnapshots?: (appointments: Iterable<Appointment>) => void
}

export function useAdminAgendaMoves({
  adminToken,
  date,
  schedules,
  load,
  setError,
  clearSelection,
  onMovesCommitted,
  markAppointmentSnapshots,
}: MovesDeps) {
  const [pendingMoves, setPendingMoves] = useState<AppointmentMoveDraft[]>([])
  const [moveBusy, setMoveBusy] = useState(false)

  const pendingMoveSummary = useMemo(
    () => summarizePendingMoves(pendingMoves),
    [pendingMoves],
  )

  const proposeAppointmentMove = useCallback(
    (payload: AppointmentDragEndPayload) => {
      // Resize — apply immediately
      if (payload.newDuration) {
        setMoveBusy(true)
        updateAdminAppointment(payload.appointment.id, adminToken, {
          serviceDurations: [payload.newDuration],
        })
          .then(() => load({ silent: true }))
          .catch((err) =>
            setError(err instanceof ApiError ? err.message : 'Error al cambiar duración'),
          )
          .finally(() => setMoveBusy(false))
        return
      }

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
    [schedules, date, pendingMoves, setError, clearSelection, adminToken, load],
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
      const validation = validatePendingMovesForSave(schedules, date, pendingMoves)
      if (!validation.ok) {
        setError(validation.message)
        return false
      }
      setError('')
      setMoveBusy(true)
      try {
        const updatedAppointments: Appointment[] = []
        for (const move of getFinalMovesForSave(pendingMoves)) {
          const { appointment } = await updateAdminAppointment(move.appointment.id, adminToken, {
            staffId: move.toStaffId,
            date,
            startTime: move.toStartTime,
            notifyCustomerWhatsApp,
          })
          updatedAppointments.push(appointment)
        }
        markAppointmentSnapshots?.(updatedAppointments)
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
    [pendingMoves, adminToken, date, schedules, load, setError, onMovesCommitted, markAppointmentSnapshots],
  )

  const requestSavePendingMoves = useCallback(() => {
    if (pendingMoves.length === 0) return false
    const validation = validatePendingMovesForSave(schedules, date, pendingMoves)
    if (!validation.ok) {
      setError(validation.message)
      return false
    }
    return true
  }, [pendingMoves, schedules, date, setError])

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
