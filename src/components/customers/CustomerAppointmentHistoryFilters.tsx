import { useState } from 'react'
import type { CustomerAppointmentStatusFilter } from '@/lib/customerAppointmentStatus'
import { CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS } from '@/lib/customerAppointmentStatus'
import type { AppointmentHistoryFilters as Filters } from '@/lib/appointmentHistoryFilters'
import { typography } from '@/styles/typography'

const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none focus:border-gold'

function FilterChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gold transition-transform ${expanded ? 'rotate-180' : ''}`}
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
  collapsibleOnMobile = true,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className="border-b border-gold/15 bg-cream/90 px-3 py-3">
      {collapsibleOnMobile && (
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="customer-history-filters"
          className="flex w-full items-center justify-between gap-3 text-left sm:hidden"
        >
          <span className={typography.label}>
            Filtrar historial
            {hasFilters && (
              <span className="ml-2 font-normal text-charcoal-muted">· activos</span>
            )}
          </span>
          <FilterChevron expanded={filtersOpen} />
        </button>
      )}
      <p
        className={`${typography.label} mb-3 ${collapsibleOnMobile ? 'hidden sm:block' : ''}`}
      >
        Filtrar historial
        {hasFilters && <span className="ml-2 font-normal text-charcoal-muted">· activos</span>}
      </p>
      <label className={`mb-3 block ${collapsibleOnMobile ? 'mt-3 sm:mt-0' : ''}`}>
        <span className={`${typography.caption} mb-1 block`}>Buscar en el historial</span>
        <input
          type="search"
          value={filters.textQuery}
          onChange={(e) => onPatch({ textQuery: e.target.value })}
          placeholder="Tratamiento, profesional, notas…"
          className={fieldClass}
        />
      </label>
      <div
        id="customer-history-filters"
        className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${
          collapsibleOnMobile
            ? filtersOpen
              ? 'grid'
              : 'hidden sm:grid'
            : 'grid'
        }`}
      >
        <div className="flex flex-col gap-3 sm:col-span-2">
          <label className="block text-left">
            <span className={`${typography.caption} mb-1 block`}>Estado de la cita</span>
            <select
              value={filters.statusFilter}
              onChange={(e) =>
                onPatch({
                  statusFilter: e.target.value as CustomerAppointmentStatusFilter | '',
                })
              }
              className={fieldClass}
            >
              <option value="">Todos los estados</option>
              {CUSTOMER_APPOINTMENT_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!hasFilters}
            onClick={onClear}
            className="w-full border border-gold/30 px-3 py-2 text-sm text-charcoal-muted hover:border-gold disabled:opacity-40"
          >
            Quitar filtros
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <label className="block text-left">
            <span className={`${typography.caption} mb-1 block`}>Desde</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onPatch({ dateFrom: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block text-left">
            <span className={`${typography.caption} mb-1 block`}>Hasta</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onPatch({ dateTo: e.target.value })}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="flex flex-col gap-3">
          <label className="block text-left">
            <span className={`${typography.caption} mb-1 block`}>Tratamiento</span>
            <select
              value={filters.serviceFilter}
              onChange={(e) => onPatch({ serviceFilter: e.target.value })}
              className={fieldClass}
            >
              <option value="">Todos los tratamientos</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-left">
            <span className={`${typography.caption} mb-1 block`}>Profesional</span>
            <select
              value={filters.staffFilter}
              onChange={(e) => onPatch({ staffFilter: e.target.value })}
              className={fieldClass}
            >
              <option value="">Todos los profesionales</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className={`${typography.caption} mt-3`}>
        {filteredCount} de {totalCount} citas
      </p>
    </div>
  )
}
