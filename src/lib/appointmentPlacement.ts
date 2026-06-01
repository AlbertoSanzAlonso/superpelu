import { timeToMinutes, minutesToTime } from '@/lib/adminCalendar'
import {
  getOccupiedSegmentsForAppointment,
  occupiedSegmentsOverlap,
} from '@/lib/bookingOccupancy'
import { buildStaffDayGrid } from '@/lib/timeGrid'
import type { DayScheduleAppointment, StaffDaySchedule } from '@/types/booking'

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
  schedule: StaffDaySchedule,
  date: string,
  appointment: DayScheduleAppointment,
  target: AppointmentMoveTarget,
): AppointmentMoveValidation {
  if (!schedule.working || !schedule.window) {
    return { ok: false, message: 'Este profesional no trabaja este día.' }
  }

  const startMinutes = timeToMinutes(target.startTime)
  const segments = getOccupiedSegmentsForAppointment(
    appointment.serviceId,
    startMinutes,
    appointment.durationMinutes,
    { colorGroupRole: appointment.colorGroupRole },
  )

  const windowStart = timeToMinutes(schedule.window.startTime)
  const windowEnd = timeToMinutes(schedule.window.endTime)

  for (const seg of segments) {
    const segEnd = seg.startMinutes + seg.durationMinutes
    if (seg.startMinutes < windowStart || segEnd > windowEnd) {
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
  appointment: DayScheduleAppointment,
  fromStaffId: string,
  target: AppointmentMoveTarget,
): boolean {
  return (
    fromStaffId === target.staffId && appointment.startTime === target.startTime
  )
}
