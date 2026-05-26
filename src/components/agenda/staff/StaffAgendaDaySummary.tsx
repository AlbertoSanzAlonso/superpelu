import { formatDisplayDate } from '@/lib/dates'
import type { StaffDaySchedule } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  date: string
  loading: boolean
  schedule: StaffDaySchedule | null
}

export function StaffAgendaDaySummary({ date, loading, schedule }: Props) {
  if (loading) {
    return <p className={typography.caption}>Cargando…</p>
  }

  if (schedule && !schedule.working) {
    return <p className={typography.body}>No trabajas este día según tu horario.</p>
  }

  if (!schedule?.working) return null

  return (
    <div className="border border-gold/20 bg-cream p-4 text-sm">
      <p className={`${typography.caption} capitalize`}>{formatDisplayDate(date)}</p>
    </div>
  )
}
