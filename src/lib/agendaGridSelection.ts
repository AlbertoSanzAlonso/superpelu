import {
  buildStaffDayGrid,
  groupContiguousSlotTimes,
  summarizeGridSelection,
} from '@/lib/timeGrid'
import type { PendingBlockGroup } from '@/types/blocks'
import type { StaffDaySchedule } from '@/types/booking'

export type GridSelectionSummary = ReturnType<typeof summarizeGridSelection>

const EMPTY_SUMMARY: GridSelectionSummary = {
  freeTimes: [],
  blockIds: [],
  hasAppointment: false,
}

export function summarizeScheduleGridSelection(
  schedule: StaffDaySchedule,
  date: string,
  times: Set<string>,
): GridSelectionSummary {
  const cells = buildStaffDayGrid(schedule, date)
  return summarizeGridSelection(times, cells)
}

export function summarizeStaffColumnGridSelection(
  schedules: StaffDaySchedule[],
  staffId: string,
  date: string,
  times: Set<string>,
): GridSelectionSummary {
  const schedule = schedules.find((s) => s.staffId === staffId)
  if (!schedule) return EMPTY_SUMMARY
  return summarizeScheduleGridSelection(schedule, date, times)
}

export function blockGroupsFromGridSummary(
  summary: GridSelectionSummary,
): PendingBlockGroup[] | null {
  if (summary.hasAppointment || summary.freeTimes.length === 0) return null
  return groupContiguousSlotTimes(summary.freeTimes)
}

export function singleFreeTimeFromGridSummary(
  summary: GridSelectionSummary,
): string | undefined {
  if (summary.freeTimes.length !== 1) return undefined
  return summary.freeTimes[0]
}
