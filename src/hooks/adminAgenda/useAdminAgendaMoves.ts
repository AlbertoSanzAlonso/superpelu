import { useCallback, useMemo, useState } from 'react'
import {
  buildBookingGroupMoveDrafts,
  isSameAppointmentMove,
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
import type { StaffDaySchedule } from '@/types/booking'
import type { AppointmentDragEndPayload } from '@/components/agenda/admin/DraggableAppointmentBlock'

type MovesDeps = {
  adminToken: string
  date: string
  schedules: StaffDaySchedule[]
  load: (opts?: { silent?: boolean }) => Promise<StaffDaySchedule[] | null>
  setError: (message: string) => void
  clearSelection: () => void
  onMovesCommitted: () => void
  resyncAppointmentSnapshots?: (options?: { notify?: boolean }) => Promise<void>
}

export function useAdminAgendaMoves({
  adminToken,
  date,
  schedules,
  load,
  setError,
  clearSelection,
  onMovesCommitted,
  resyncAppointmentSnapshots,
}: MovesDeps) {
  const [pendingMoves, setPendingMoves] = useState<AppointmentMoveDraft[]>([])
  const [moveBusy, setMoveBusy] = useState(false)

  const pendingMoveSummary = useMemo(
    () => summarizePendingMoves(pendingMoves),
    [pendingMoves],
  )

  const proposeAppointmentMove = useCallback(
    (payload: AppointmentDragEndPayload) => {
      // Resize — persistir al momento (hora si se estiró desde arriba + duración).
      if (payload.newDuration) {
        const startTimeChanged =
          payload.toStartTime !== payload.appointment.startTime
        setMoveBusy(true)
        updateAdminAppointment(payload.appointment.id, adminToken, {
          serviceDurations: [payload.newDuration],
          ...(startTimeChanged ? { startTime: payload.toStartTime } : {}),
          forceSchedule: true,
        })
          .then(async () => {
            await load({ silent: true })
            await resyncAppointmentSnapshots?.({ notify: true })
          })
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

      const validation = buildBookingGroupMoveDrafts(
        schedules,
        date,
        {
          appointment: payload.appointment,
          fromStaffId,
          fromStartTime,
          toStaffId: payload.toStaffId,
          toStaffName,
          toStartTime: payload.toStartTime,
        },
        pendingMoves,
        summary,
      )
      if (!validation.ok) {
        // No acumular el arrastre fallido: solo aviso, sin pending oculto.
        setError(validation.message)
        return
      }
      if (validation.moves.length === 0) {
        return
      }

      setError('')
      clearSelection()
      setPendingMoves((prev) => [...prev, ...validation.moves])
    },
    [schedules, date, pendingMoves, setError, clearSelection, adminToken, load, resyncAppointmentSnapshots],
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
        const finalMoves = getFinalMovesForSave(pendingMoves)
        const notifiedBookingGroups = new Set<string>()

        for (const move of finalMoves) {
          const bookingGroupId = move.appointment.bookingGroupId
          const shouldNotify =
            notifyCustomerWhatsApp === true &&
            (!bookingGroupId || !notifiedBookingGroups.has(bookingGroupId))
          if (shouldNotify && bookingGroupId) {
            notifiedBookingGroups.add(bookingGroupId)
          }

          await updateAdminAppointment(move.appointment.id, adminToken, {
            staffId: move.toStaffId,
            date,
            startTime: move.toStartTime,
            // Conservar duración personalizada (p. ej. tras alargar con el borde).
            serviceDurations: [move.appointment.durationMinutes],
            notifyCustomerWhatsApp: shouldNotify,
            forceSchedule: true,
          })
        }
        await resyncAppointmentSnapshots?.({ notify: true })
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
    [
      pendingMoves,
      adminToken,
      date,
      schedules,
      load,
      setError,
      onMovesCommitted,
      resyncAppointmentSnapshots,
    ],
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
