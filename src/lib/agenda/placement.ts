import {
  buildSchedulesWithPendingMoves,
  getEffectivePlacement,
  getFinalMovesForSave,
  type AppointmentMoveDraft,
  type PendingMoveSummary,
} from '@/lib/agenda/pendingMoves'
import type { DayScheduleAppointment, StaffDaySchedule } from '@/types/booking'

export type AppointmentMoveTarget = {
  staffId: string
  staffName: string
  startTime: string
}

export type AppointmentMoveValidation =
  | { ok: true }
  | { ok: false; message: string }

/** Agenda admin: libertad total — solo exige que exista la columna del profesional. */
export function validateAppointmentMove(
  schedules: StaffDaySchedule[],
  _date: string,
  appointment: DayScheduleAppointment,
  target: AppointmentMoveTarget,
  pendingMoves: AppointmentMoveDraft[] = [],
): AppointmentMoveValidation {
  const layout = buildSchedulesWithPendingMoves(
    schedules,
    pendingMoves.filter((m) => m.appointment.id !== appointment.id),
  )
  const schedule = layout.find((s) => s.staffId === target.staffId)
  if (!schedule) {
    return { ok: false, message: 'Profesional no encontrado.' }
  }
  return { ok: true }
}

export function validatePendingMovesForSave(
  schedules: StaffDaySchedule[],
  date: string,
  pendingMoves: AppointmentMoveDraft[],
): AppointmentMoveValidation {
  const finalMoves = getFinalMovesForSave(pendingMoves)
  for (const move of finalMoves) {
    const result = validateAppointmentMove(
      schedules,
      date,
      move.appointment,
      {
        staffId: move.toStaffId,
        staffName: move.toStaffName,
        startTime: move.toStartTime,
      },
      pendingMoves,
    )
    if (!result.ok) return result
  }
  return { ok: true }
}

export function isSameAppointmentMove(
  fromStaffId: string,
  fromStartTime: string,
  target: AppointmentMoveTarget,
): boolean {
  return fromStaffId === target.staffId && fromStartTime === target.startTime
}

export function collectBookingGroupMembers(
  schedules: StaffDaySchedule[],
  bookingGroupId: string,
): DayScheduleAppointment[] {
  const members: DayScheduleAppointment[] = []
  for (const schedule of schedules) {
    for (const apt of schedule.appointments) {
      if (
        apt.bookingGroupId === bookingGroupId &&
        apt.colorGroupRole !== 'wash' &&
        apt.status === 'confirmed'
      ) {
        members.push(apt)
      }
    }
  }
  return members.sort((a, b) => a.startTime.localeCompare(b.startTime))
}

function staffNameForId(schedules: StaffDaySchedule[], staffId: string): string {
  return schedules.find((s) => s.staffId === staffId)?.staffName ?? ''
}

/**
 * Prepara el movimiento del tratamiento arrastrado.
 * Cada cita del grupo se mueve sola; los hermanos no se desplazan en bloque.
 * Agenda admin: sin restricciones de horario, bloqueos ni solapes.
 */
export function buildBookingGroupMoveDrafts(
  schedules: StaffDaySchedule[],
  date: string,
  anchor: {
    appointment: DayScheduleAppointment
    fromStaffId: string
    fromStartTime: string
    toStaffId: string
    toStaffName: string
    toStartTime: string
  },
  pendingMoves: AppointmentMoveDraft[],
  pendingSummary: PendingMoveSummary,
): { ok: true; moves: AppointmentMoveDraft[] } | { ok: false; message: string } {
  const member = anchor.appointment
  const effective = getEffectivePlacement(pendingSummary, member.id, {
    staffId: member.staffId,
    startTime: member.startTime,
  })
  const fromStaffId = effective.staffId
  const fromStartTime = effective.startTime
  const target: AppointmentMoveTarget = {
    staffId: anchor.toStaffId,
    staffName: anchor.toStaffName,
    startTime: anchor.toStartTime,
  }

  if (isSameAppointmentMove(fromStaffId, fromStartTime, target)) {
    return { ok: true, moves: [] }
  }

  const validation = validateAppointmentMove(
    schedules,
    date,
    member,
    target,
    pendingMoves,
  )
  if (!validation.ok) return validation

  return {
    ok: true,
    moves: [
      {
        appointment: member,
        fromStaffId,
        fromStaffName: staffNameForId(schedules, fromStaffId),
        fromStartTime,
        toStaffId: target.staffId,
        toStaffName: target.staffName,
        toStartTime: target.startTime,
      },
    ],
  }
}
