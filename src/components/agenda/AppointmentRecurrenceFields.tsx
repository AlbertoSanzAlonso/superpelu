import { useEffect, useState } from 'react'
import { formatDisplayDate } from '@/lib/dates'
import type { AppointmentRecurrenceScope } from '@/types/appointmentSeries'
import { typography } from '@/styles/typography'

type Props = {
  anchorDate: string
  scope: AppointmentRecurrenceScope
  endDate: string
  onScopeChange: (scope: AppointmentRecurrenceScope) => void
  onEndDateChange: (endDate: string) => void
  compact?: boolean
}

export function AppointmentRecurrenceFields({
  anchorDate,
  scope,
  endDate,
  onScopeChange,
  onEndDateChange,
  compact = false,
}: Props) {
  const [weeklyMode, setWeeklyMode] = useState<'permanent' | 'until'>(
    endDate && endDate !== anchorDate ? 'until' : 'permanent',
  )

  useEffect(() => {
    if (scope !== 'weekly') return
    setWeeklyMode(endDate && endDate !== anchorDate ? 'until' : 'permanent')
  }, [scope, endDate, anchorDate])

  const labelCn = compact ? `${typography.label} mb-0.5 block text-xs` : `${typography.label} mb-1 block`

  function selectSingle() {
    onScopeChange('single')
  }

  function selectWeeklyPermanent() {
    onScopeChange('weekly')
    onEndDateChange('')
    setWeeklyMode('permanent')
  }

  function selectWeeklyUntil() {
    onScopeChange('weekly')
    onEndDateChange(endDate && endDate >= anchorDate ? endDate : anchorDate)
    setWeeklyMode('until')
  }

  return (
    <fieldset className="space-y-2">
      <legend className={labelCn}>Repetición</legend>

      <label className="flex cursor-pointer items-start gap-3 border border-gold/25 p-3 has-[:checked]:border-gold has-[:checked]:bg-gold/5">
        <input
          type="radio"
          name="appointment-recurrence"
          checked={scope === 'single'}
          onChange={selectSingle}
          className="mt-1 accent-gold"
        />
        <span className="text-sm">
          <span className="font-medium">Solo este día</span>
          <span className={`${typography.caption} mt-0.5 block`}>Una única cita.</span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 border border-gold/25 p-3 has-[:checked]:border-gold has-[:checked]:bg-gold/5">
        <input
          type="radio"
          name="appointment-recurrence"
          checked={scope === 'weekly' && weeklyMode === 'permanent'}
          onChange={selectWeeklyPermanent}
          className="mt-1 accent-gold"
        />
        <span className="text-sm">
          <span className="font-medium">Cada semana (permanente)</span>
          <span className={`${typography.caption} mt-0.5 block`}>
            Mismo día y hora todas las semanas hasta que la elimines.
          </span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 border border-gold/25 p-3 has-[:checked]:border-gold has-[:checked]:bg-gold/5">
        <input
          type="radio"
          name="appointment-recurrence"
          checked={scope === 'weekly' && weeklyMode === 'until'}
          onChange={selectWeeklyUntil}
          className="mt-1 accent-gold"
        />
        <span className="text-sm">
          <span className="font-medium">Cada semana hasta una fecha</span>
          <span className={`${typography.caption} mt-0.5 block`}>
            Repite el mismo día de la semana hasta la fecha indicada (incluida).
          </span>
        </span>
      </label>

      {scope === 'weekly' && weeklyMode === 'until' && (
        <div className="pl-1">
          <label className={`${typography.label} mb-1 block`}>Última semana (incluida)</label>
          <input
            type="date"
            required
            min={anchorDate}
            value={endDate || anchorDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full border border-gold/30 bg-cream px-3 py-2 text-sm"
          />
          <p className={`${typography.caption} mt-1 capitalize`}>
            Desde {formatDisplayDate(anchorDate)}
          </p>
        </div>
      )}
    </fieldset>
  )
}
