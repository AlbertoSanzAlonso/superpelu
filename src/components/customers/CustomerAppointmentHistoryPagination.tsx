import { typography } from '@/styles/typography'

type Props = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  ariaLabel?: string
}

const navButtonClass =
  'border border-gold/30 px-3 py-1.5 text-xs text-charcoal-muted hover:border-gold disabled:cursor-not-allowed disabled:opacity-40'

export function CustomerAppointmentHistoryPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  ariaLabel = 'Paginación del historial',
}: Props) {
  if (totalItems <= pageSize) return null

  const totalPages = Math.ceil(totalItems / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/15 px-4 py-3"
    >
      <p className={`${typography.caption} tabular-nums text-charcoal-muted`}>
        {from}–{to} de {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={navButtonClass}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </button>
        <span className={`${typography.caption} tabular-nums text-charcoal-muted`}>
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className={navButtonClass}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </nav>
  )
}
