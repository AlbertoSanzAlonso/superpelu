export type ScheduleTimeRange = { start: string; end: string }

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
