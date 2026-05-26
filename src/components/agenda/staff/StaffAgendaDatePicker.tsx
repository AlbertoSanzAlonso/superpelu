import { addDaysToDateString } from '@/lib/dates'
import { typography } from '@/styles/typography'

type Props = {
  date: string
  onDateChange: (date: string) => void
}

const dayNavButtonClass =
  'flex shrink-0 items-center justify-center border border-gold/30 bg-cream px-3 py-3 text-gold transition-colors hover:border-gold hover:bg-gold/10 focus-visible:border-gold focus-visible:outline-none'

function NavChevron({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      {direction === 'prev' ? (
        <path
          fillRule="evenodd"
          d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
          clipRule="evenodd"
        />
      ) : (
        <path
          fillRule="evenodd"
          d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.25 4.5a.75.75 0 010 1.08l-4.25 4.5a.75.75 0 01-1.06-.02z"
          clipRule="evenodd"
        />
      )}
    </svg>
  )
}

export function StaffAgendaDatePicker({ date, onDateChange }: Props) {
  function shiftDay(days: number) {
    onDateChange(addDaysToDateString(date, days))
  }

  return (
    <div>
      <label htmlFor="staff-date" className={`${typography.label} mb-2 block`}>
        Día
      </label>
      <div className="flex max-w-md items-stretch gap-2">
        <input
          id="staff-date"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="min-w-0 flex-1 border border-gold/30 bg-cream px-4 py-3 text-sm outline-none focus:border-gold"
        />
        <div className="flex shrink-0">
          <button
            type="button"
            className={`${dayNavButtonClass} border-r-0`}
            aria-label="Día anterior"
            onClick={() => shiftDay(-1)}
          >
            <NavChevron direction="prev" />
          </button>
          <button
            type="button"
            className={dayNavButtonClass}
            aria-label="Día siguiente"
            onClick={() => shiftDay(1)}
          >
            <NavChevron direction="next" />
          </button>
        </div>
      </div>
    </div>
  )
}
