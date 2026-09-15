export type ScheduleTimeRange = { start: string; end: string }

/** Horario especial de un día concreto (admin /horarios). */
export type SpecialDayEntry = {
  ranges: ScheduleTimeRange[]
  /** Texto explicativo opcional (festivo, vacaciones, etc.). */
  note: string
}

export type SpecialDaysMap = Record<string, SpecialDayEntry>

export type SalonScheduleData = {
  openDays: number[]
  openTime: string
  closeTime: string
  weeklyWindows: Record<number, ScheduleTimeRange[]>
}

export type StaffScheduleData = {
  staffId: string
  staffName: string
  weeklyWindows: Record<number, ScheduleTimeRange[]>
}

export type FullScheduleData = {
  salon: SalonScheduleData
  staff: StaffScheduleData[]
}

export type StaffSpecialScheduleData = {
  staffId: string
  staffName: string
  specialDays: SpecialDaysMap
}

export type SalonSpecialScheduleData = {
  specialDays: SpecialDaysMap
}

export function createSpecialDayEntry(
  ranges: ScheduleTimeRange[] = [{ start: '10:00', end: '14:00' }],
  note = '',
): SpecialDayEntry {
  return {
    ranges: ranges.map((r) => ({ ...r })),
    note,
  }
}

export function specialDayRanges(entry: SpecialDayEntry | undefined): ScheduleTimeRange[] {
  return entry?.ranges ?? []
}
