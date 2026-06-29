import type { BlockScope } from '@/types/blocks'

export type AppointmentRecurrenceScope = Extract<BlockScope, 'single' | 'weekly'>

export type AppointmentSeriesMeta = {
  appointmentId: string
  seriesId: string | null
  scope: AppointmentRecurrenceScope | 'legacy'
  count: number
  dates: string[]
  anchorDate: string
  startTime: string
  serviceName: string
  customerName: string
}

export type AppointmentSeriesMode = 'single' | 'series' | 'group'
