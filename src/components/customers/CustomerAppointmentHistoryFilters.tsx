import { useEffect, useState } from 'react'
import type { CustomerAppointmentStatusFilter } from '@/lib/customerAppointmentStatus'
import { CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS } from '@/lib/customerAppointmentStatus'
import type { AppointmentHistoryFilters as Filters } from '@/lib/appointmentHistoryFilters'
import { typography } from '@/styles/typography'

const fieldClass =
  'w-full border border-gold/30 bg-cream px-2.5 py-1.5 font-sans text-sm text-charcoal outline-none focus:border-gold'

function FilterChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-gold transition-transform ${expanded ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

type Props = {
  filters: Filters
  hasFilters: boolean
  serviceOptions: { id: string; name: string }[]
  staffOptions: { id: string; name: string }[]
  filteredCount: number
  totalCount: number
  onPatch: (patch: Partial<Filters>) => void
  onClear: () => void
  /** @deprecated Los filtros van siempre en desplegable compacto. */
  collapsibleOnMobile?: boolean
}

export function CustomerAppointmentHistoryFiltersBar({
  filters,
  hasFilters,
  serviceOptions,
  staffOptions,
  filteredCount,
  totalCount,
  onPatch,
  onClear,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(hasFilters)

  useEffect(() => {
    if (hasFilters) setFiltersOpen(true)
  }, [hasFilters])

  return (
    <div className="border-b border-gold/15 bg-cream/90 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="customer-history-filters"
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border border-gold/30 px-2.5 py-1.5 text-left text-xs text-charcoal hover:border-gold"
        >
          <span className={typography.label}>
            Filtros
            {hasFilters && (
              <span className="ml-1.5 font-normal text-gold">· activos</span>
            )}
          </span>
          <FilterChevron expanded={filtersOpen} />
        </button>

        <label className="min-w-[10rem] flex-1">
          <span className="sr-only">Buscar en el historial</span>
          <input
            type="search"
            value={filters.textQuery}
            onChange={(e) => onPatch({ textQuery: e.target.value })}
            placeholder="Buscar tratamiento, profesional, notas…"
            className={fieldClass}
          />
        </label>

        <p className={`${typography.caption} shrink-0 tabular-nums text-charcoal-muted`}>
          {filteredCount} / {totalCount}
        </p>
      </div>

      {filtersOpen && (
        <div
          id="customer-history-filters"
          className="mt-2 space-y-2 border-t border-gold/10 pt-2"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="block text-left">
              <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Estado</span>
              <select
                value={filters.statusFilter}
                onChange={(e) =>
                  onPatch({
                    statusFilter: e.target.value as CustomerAppointmentStatusFilter | '',
                  })
                }
                className={fieldClass}
              >
                <option value="">Todos</option>
                {CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-left">
              <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Desde</span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onPatch({ dateFrom: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="block text-left">
              <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Hasta</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => onPatch({ dateTo: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block text-left">
              <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Tratamiento</span>
              <select
                value={filters.serviceFilter}
                onChange={(e) => onPatch({ serviceFilter: e.target.value })}
                className={fieldClass}
              >
                <option value="">Todos</option>
                {serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-left">
              <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Profesional</span>
              <select
                value={filters.staffFilter}
                onChange={(e) => onPatch({ staffFilter: e.target.value })}
                className={fieldClass}
              >
                <option value="">Todos</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!hasFilters}
              onClick={onClear}
              className="h-[34px] border border-gold/30 px-3 text-xs text-charcoal-muted hover:border-gold disabled:opacity-40 sm:justify-self-end"
            >
              Quitar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
