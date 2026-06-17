export type AdminColumnSelection = {
  staffId: string
  staffName: string
  times: Set<string>
}

export type EditingScheduleBaseline = {
  staffId: string
  appointmentDate: string
  startTime: string
}

export function appointmentScheduleChanged(
  baseline: EditingScheduleBaseline,
  current: { staffId: string; date: string; startTime: string },
): boolean {
  return (
    baseline.appointmentDate !== current.date ||
    baseline.startTime !== current.startTime ||
    baseline.staffId !== current.staffId
  )
}
