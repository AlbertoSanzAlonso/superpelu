import { useEffect, useState } from 'react'
import type { CustomerAppointmentStatusFilter } from '@/lib/customer/appointmentStatus'
import { CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS } from '@/lib/customer/appointmentStatus'
import {
  APPOINTMENT_ORIGIN_FILTER_OPTIONS,
  type AppointmentHistoryFilters as Filters,
  type AppointmentOriginFilter,
} from '@/lib/customer/historyFilters'
import { typography } from '@/styles/typography'

const fieldClass =
  'h-9 w-full border border-gold/30 bg-cream/40 px-2.5 font-sans text-sm text-charcoal outline-none backdrop-blur-[2px] focus:border-gold'

const buttonClass =
  'inline-flex h-9 items-center border border-gold/30 bg-cream/40 px-2.5 font-sans text-charcoal outline-none backdrop-blur-[2px] hover:border-gold disabled:opacity-40'

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
    <div className="border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="customer-history-filters"
          className={`${buttonClass} shrink-0 cursor-pointer gap-1.5 text-left text-xs`}
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              <span className={`${typography.caption} mb-0.5 block text-[11px]`}>Origen</span>
              <select
                value={filters.originFilter}
                onChange={(e) =>
                  onPatch({
                    originFilter: e.target.value as AppointmentOriginFilter | '',
                  })
                }
                className={fieldClass}
              >
                <option value="">Todos</option>
                {APPOINTMENT_ORIGIN_FILTER_OPTIONS.map((opt) => (
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
              className={`${buttonClass} px-3 text-xs text-charcoal-muted sm:justify-self-end`}
            >
              Quitar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
