import { formatDisplayDate } from '@/lib/core/dates'
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

type RecurrenceOption = 'single' | 'weekly-permanent' | 'weekly-until'

function toRecurrenceOption(
  scope: AppointmentRecurrenceScope,
  endDate: string,
  anchorDate: string,
): RecurrenceOption {
  if (scope === 'single') return 'single'
  if (endDate && endDate !== anchorDate) return 'weekly-until'
  return 'weekly-permanent'
}

export function AppointmentRecurrenceFields({
  anchorDate,
  scope,
  endDate,
  onScopeChange,
  onEndDateChange,
  compact = false,
}: Props) {
  const option = toRecurrenceOption(scope, endDate, anchorDate)
  const labelCn = compact ? `${typography.label} mb-0.5 block text-xs` : `${typography.label} mb-1 block`
  const selectCn = compact
    ? 'w-full cursor-pointer border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold'
    : 'w-full cursor-pointer border border-gold/30 bg-cream px-3 py-2 text-sm outline-none focus:border-gold'

  function handleOptionChange(value: RecurrenceOption) {
    if (value === 'single') {
      onScopeChange('single')
      onEndDateChange('')
      return
    }
    if (value === 'weekly-permanent') {
      onScopeChange('weekly')
      onEndDateChange('')
      return
    }
    onScopeChange('weekly')
    onEndDateChange(endDate && endDate >= anchorDate ? endDate : anchorDate)
  }

  return (
    <div className="space-y-2">
      <div>
        <label className={labelCn} htmlFor="appointment-recurrence">
          Repetición
        </label>
        <select
          id="appointment-recurrence"
          value={option}
          onChange={(e) => handleOptionChange(e.target.value as RecurrenceOption)}
          className={selectCn}
        >
          <option value="single">Solo este día</option>
          <option value="weekly-permanent">Cada semana (permanente)</option>
          <option value="weekly-until">Cada semana hasta una fecha</option>
        </select>
        {option === 'weekly-permanent' && (
          <p className={`${typography.caption} mt-1`}>
            Mismo día y hora todas las semanas hasta que la elimines.
          </p>
        )}
      </div>

      {option === 'weekly-until' && (
        <div>
          <label className={labelCn} htmlFor="appointment-recurrence-end">
            Última semana (incluida)
          </label>
          <input
            id="appointment-recurrence-end"
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
    </div>
  )
}
