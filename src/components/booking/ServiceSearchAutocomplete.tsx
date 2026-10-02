import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from '@/i18n/useTranslation'
import { searchBookableServices } from '@/lib/catalog/serviceSearch'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  services: BookableService[]
  disabled?: boolean
  onPick: (service: BookableService) => void
}

export function ServiceSearchAutocomplete({ services, disabled = false, onPick }: Props) {
  const { locale, t } = useTranslation()
  const labels = t.servicePicker.public
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const hits = useMemo(
    () => searchBookableServices(services, query, locale),
    [services, query, locale],
  )

  const showList = open && query.trim().length >= 2

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    setActiveIndex(hits.length > 0 ? 0 : -1)
  }, [hits])

  function pick(service: BookableService) {
    onPick(service)
    setQuery('')
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (hits.length === 0 ? -1 : (i + 1) % hits.length))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) =>
        hits.length === 0 ? -1 : (i <= 0 ? hits.length - 1 : i - 1),
      )
      return
    }
    if (e.key === 'Enter' && activeIndex >= 0 && hits[activeIndex]) {
      e.preventDefault()
      pick(hits[activeIndex].service)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative mb-6">
      <label className="block text-left">
        <span className={`${typography.label} mb-2 block text-center md:text-left`}>
          {labels.searchLabel}
        </span>
        <input
          type="search"
          value={query}
          disabled={disabled || services.length === 0}
          placeholder={labels.searchPlaceholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className="w-full border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold disabled:opacity-50"
        />
      </label>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-gold/30 bg-cream shadow-md"
        >
          {hits.length === 0 ? (
            <li className="px-4 py-3 text-sm text-charcoal-muted">{labels.searchEmpty}</li>
          ) : (
            hits.map((hit, index) => {
              const active = index === activeIndex
              return (
                <li key={hit.service.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-option-${index}`}
                    role="option"
                    aria-selected={active}
                    className={[
                      'flex w-full cursor-pointer flex-col px-4 py-2.5 text-left transition-colors',
                      active ? 'bg-gold/10' : 'hover:bg-gold/10',
                    ].join(' ')}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(hit.service)}
                  >
                    <span className="text-sm font-medium text-gold">{hit.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-charcoal-muted">
                      <span>{hit.categoryLabel}</span>
                      {hit.phoneOnly && (
                        <span className="uppercase tracking-wide text-charcoal-muted/80">
                          · {labels.phoneOnly}
                        </span>
                      )}
                      {!hit.phoneOnly && hit.service.showDurationInBooking !== false && (
                        <span>· {labels.minutes(hit.service.durationMinutes)}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
