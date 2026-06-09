import { timeToMinutes, minutesToTime } from '@/lib/agenda/adminCalendar'
import {
  COLOR_SPLIT_SEGMENT_MINUTES,
  getOccupiedSegmentsForAppointment,
  getWashPhaseStartMinutes,
  isColorGroupColorRow,
  isColorGroupWashRow,
  occupiedSegmentsOverlap,
} from '@/lib/booking/occupancy'
import {
  appointmentAtStartTime,
  buildSchedulesWithPendingMoves,
  getFinalMovesForSave,
} from '@/lib/agenda/pendingMoves'
import { buildStaffDayGrid } from '@/lib/agenda/timeGrid'
import { segmentFitsInWorkWindows } from '@/lib/core/scheduleHours'
import type { AppointmentMoveDraft } from '@/lib/agenda/pendingMoves'
import type { DayScheduleAppointment, StaffDaySchedule } from '@/types/booking'

const LINKED_WASH_PHASE_BLOCKED_MESSAGE =
  'El tramo de aclarado/lavado quedaría en un horario ocupado. Elige otra hora para la aplicación del color.'

function sharesBookingGroup(
  a: DayScheduleAppointment,
  b: DayScheduleAppointment,
): boolean {
  return Boolean(a.bookingGroupId && a.bookingGroupId === b.bookingGroupId)
}

export type AppointmentMoveTarget = {
  staffId: string
  staffName: string
  startTime: string
}

export type AppointmentMoveValidation =
  | { ok: true }
  | { ok: false; message: string }

function blockSegments(
  startTime: string,
  endTime: string,
): { startMinutes: number; durationMinutes: number }[] {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  return [{ startMinutes: start, durationMinutes: end - start }]
}

export function validateAppointmentMove(
  schedules: StaffDaySchedule[],
  date: string,
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

  const result = validateAppointmentMoveOnSchedule(schedule, date, appointment, target)
  if (!result.ok) return result

  if (isColorGroupColorRow(appointment.colorGroupRole) && appointment.colorGroupId) {
    return validateLinkedWashPhaseAfterColorMove(
      schedules,
      date,
      appointment,
      target,
      pendingMoves,
    )
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

function findWashAppointmentInGroup(
  schedules: StaffDaySchedule[],
  colorGroupId: string,
): { wash: DayScheduleAppointment; staffId: string } | null {
  for (const schedule of schedules) {
    const wash = schedule.appointments.find(
      (a) => a.colorGroupId === colorGroupId && isColorGroupWashRow(a.colorGroupRole),
    )
    if (wash) return { wash, staffId: schedule.staffId }
  }
  return null
}

function layoutWithColorAtTarget(
  schedules: StaffDaySchedule[],
  pendingMoves: AppointmentMoveDraft[],
  colorAppointment: DayScheduleAppointment,
  target: AppointmentMoveTarget,
): StaffDaySchedule[] {
  const layout = buildSchedulesWithPendingMoves(
    schedules,
    pendingMoves.filter((m) => m.appointment.id !== colorAppointment.id),
  )
  return layout.map((schedule) => {
    const withoutColor = schedule.appointments.filter((a) => a.id !== colorAppointment.id)
    if (schedule.staffId !== target.staffId) {
      return { ...schedule, appointments: withoutColor }
    }
    return {
      ...schedule,
      appointments: [
        ...withoutColor,
        appointmentAtStartTime(colorAppointment, target.startTime),
      ],
    }
  })
}

function validateLinkedWashPhaseAfterColorMove(
  schedules: StaffDaySchedule[],
  date: string,
  colorAppointment: DayScheduleAppointment,
  colorTarget: AppointmentMoveTarget,
  pendingMoves: AppointmentMoveDraft[],
): AppointmentMoveValidation {
  const groupId = colorAppointment.colorGroupId
  if (!groupId) return { ok: true }

  const linked = findWashAppointmentInGroup(schedules, groupId)
  if (!linked) return { ok: true }

  const { wash, staffId: washStaffId } = linked
  const washExplicitlyMoved = pendingMoves.some((m) => m.appointment.id === wash.id)
  if (washExplicitlyMoved) return { ok: true }

  const washStartTime = minutesToTime(
    getWashPhaseStartMinutes(timeToMinutes(colorTarget.startTime)),
  )

  const layout = layoutWithColorAtTarget(schedules, pendingMoves, colorAppointment, colorTarget)
  const washSchedule = layout.find((s) => s.staffId === washStaffId)
  if (!washSchedule) {
    return { ok: false, message: 'Profesional del lavado no encontrado.' }
  }

  const scheduleWithoutWash: StaffDaySchedule = {
    ...washSchedule,
    appointments: washSchedule.appointments.filter((a) => a.id !== wash.id),
  }

  const virtualWash: DayScheduleAppointment = {
    ...wash,
    durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES,
    startTime: washStartTime,
  }

  const washResult = validateAppointmentMoveOnSchedule(
    scheduleWithoutWash,
    date,
    virtualWash,
    {
      staffId: washStaffId,
      staffName: washSchedule.staffName,
      startTime: washStartTime,
    },
  )
  if (!washResult.ok) {
    if (
      washResult.message === 'Ese horario ya tiene otra cita.' ||
      washResult.message === 'Ese horario está bloqueado.'
    ) {
      return { ok: false, message: LINKED_WASH_PHASE_BLOCKED_MESSAGE }
    }
    return washResult
  }

  return { ok: true }
}

function validateAppointmentMoveOnSchedule(
  schedule: StaffDaySchedule,
  date: string,
  appointment: DayScheduleAppointment,
  target: AppointmentMoveTarget,
): AppointmentMoveValidation {
  if (!schedule.working || schedule.windows.length === 0) {
    return { ok: false, message: 'Este profesional no trabaja este día.' }
  }

  const startMinutes = timeToMinutes(target.startTime)
  const segments = getOccupiedSegmentsForAppointment(
    appointment.serviceId,
    startMinutes,
    appointment.durationMinutes,
    { colorGroupRole: appointment.colorGroupRole },
  )

  for (const seg of segments) {
    if (!segmentFitsInWorkWindows(seg.startMinutes, seg.durationMinutes, schedule.windows)) {
      return { ok: false, message: 'La cita quedaría fuera del horario de trabajo.' }
    }
  }

  const cells = buildStaffDayGrid(schedule, date)
  const pastTimes = new Set(cells.filter((c) => c.status === 'past').map((c) => c.time))
  for (const seg of segments) {
    for (let m = seg.startMinutes; m < seg.startMinutes + seg.durationMinutes; m += 30) {
      const time = minutesToTime(m)
      if (pastTimes.has(time)) {
        return { ok: false, message: 'No se puede mover a un horario pasado.' }
      }
    }
  }

  for (const other of schedule.appointments) {
    if (other.id === appointment.id) continue
    if (sharesBookingGroup(appointment, other)) continue
    const otherSegments = getOccupiedSegmentsForAppointment(
      other.serviceId,
      timeToMinutes(other.startTime),
      other.durationMinutes,
      { colorGroupRole: other.colorGroupRole },
    )
    if (occupiedSegmentsOverlap(segments, otherSegments)) {
      return { ok: false, message: 'Ese horario ya tiene otra cita.' }
    }
  }

  for (const block of schedule.blocks) {
    const blockSegs = blockSegments(block.startTime, block.endTime)
    if (occupiedSegmentsOverlap(segments, blockSegs)) {
      return { ok: false, message: 'Ese horario está bloqueado.' }
    }
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
