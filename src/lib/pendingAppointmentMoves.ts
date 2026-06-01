import { appointmentOccupiedSlots } from '@/lib/bookingOccupancy'
import type { DayScheduleAppointment, StaffDaySchedule } from '@/types/booking'

export type AppointmentMoveDraft = {
  appointment: DayScheduleAppointment
  fromStaffId: string
  fromStaffName: string
  fromStartTime: string
  toStaffId: string
  toStaffName: string
  toStartTime: string
}

export type PendingMoveVisual = {
  originStaffId: string
  originStartTime: string
  targetStaffId: string
  targetStartTime: string
}

export type PendingMoveSummary = {
  count: number
  lastMove: AppointmentMoveDraft | null
  byAppointmentId: Map<string, { first: AppointmentMoveDraft; latest: AppointmentMoveDraft }>
}

export function summarizePendingMoves(moves: AppointmentMoveDraft[]): PendingMoveSummary {
  const byAppointmentId = new Map<
    string,
    { first: AppointmentMoveDraft; latest: AppointmentMoveDraft }
  >()
  for (const move of moves) {
    const existing = byAppointmentId.get(move.appointment.id)
    if (!existing) {
      byAppointmentId.set(move.appointment.id, { first: move, latest: move })
    } else {
      byAppointmentId.set(move.appointment.id, { first: existing.first, latest: move })
    }
  }
  return {
    count: moves.length,
    lastMove: moves.length > 0 ? moves[moves.length - 1]! : null,
    byAppointmentId,
  }
}

export function getPendingVisualForAppointment(
  summary: PendingMoveSummary,
  appointmentId: string,
): PendingMoveVisual | null {
  const entry = summary.byAppointmentId.get(appointmentId)
  if (!entry) return null
  return {
    originStaffId: entry.first.fromStaffId,
    originStartTime: entry.first.fromStartTime,
    targetStaffId: entry.latest.toStaffId,
    targetStartTime: entry.latest.toStartTime,
  }
}

export function getEffectivePlacement(
  summary: PendingMoveSummary,
  appointmentId: string,
  fallback: { staffId: string; startTime: string },
): { staffId: string; startTime: string } {
  const visual = getPendingVisualForAppointment(summary, appointmentId)
  if (!visual) return fallback
  return { staffId: visual.targetStaffId, startTime: visual.targetStartTime }
}

export function appointmentAtStartTime(
  apt: DayScheduleAppointment,
  startTime: string,
): DayScheduleAppointment {
  return {
    ...apt,
    startTime,
    occupiedSlots: appointmentOccupiedSlots(apt.serviceId, startTime, apt.durationMinutes, {
      colorGroupRole: apt.colorGroupRole,
    }),
  }
}

/** Aplica la posición final de cada cita movida (último paso del historial). */
export function buildSchedulesWithPendingMoves(
  schedules: StaffDaySchedule[],
  moves: AppointmentMoveDraft[],
): StaffDaySchedule[] {
  const { byAppointmentId } = summarizePendingMoves(moves)
  const movedIds = new Set(byAppointmentId.keys())

  return schedules.map((schedule) => {
    let appointments = schedule.appointments.filter((a) => !movedIds.has(a.id))

    for (const { latest } of byAppointmentId.values()) {
      if (latest.toStaffId !== schedule.staffId) continue
      appointments = [
        ...appointments.filter((a) => a.id !== latest.appointment.id),
        appointmentAtStartTime(latest.appointment, latest.toStartTime),
      ]
    }

    return { ...schedule, appointments }
  })
}

/** Una entrada por cita: posición final a persistir al guardar. */
export function getFinalMovesForSave(moves: AppointmentMoveDraft[]): AppointmentMoveDraft[] {
  const { byAppointmentId } = summarizePendingMoves(moves)
  return [...byAppointmentId.values()].map((e) => e.latest)
}
