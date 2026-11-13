import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { fetchCustomerDetail, fetchCustomers, ApiError } from '@/lib/api'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatPhoneDisplay } from '@/lib/customer/phone'
import { customerSearchHint, customerSearchTokens } from '@/lib/customer/search'
import { useIgnoreKeyboardDismissInput } from '@/hooks/useIgnoreKeyboardDismissInput'
import type { Customer, CustomerDetail } from '@/types/customers'
import { typography } from '@/styles/typography'

type Props = {
  adminToken: string
  onSelect: (customer: CustomerDetail['customer']) => void
  disabled?: boolean
}

export function CustomerSearchPicker({ adminToken, onSelect, disabled = false }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const { onBlurCapture, shouldAcceptChange } = useIgnoreKeyboardDismissInput()

  useEffect(() => {
    if (!open) return
    function onDocPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    // pointerdown (no mousedown): evita el click fantasma tras cerrar el desplegable en móvil.
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [open])

  const search = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (trimmed.length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      setError('')
      try {
        const { customers } = await fetchCustomers(adminToken, trimmed)
        setResults(customers.slice(0, 20))
      } catch {
        setResults([])
        setError('No se pudo buscar')
      } finally {
        setLoading(false)
      }
    },
    [adminToken],
  )

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void search(query), 280)
    return () => window.clearTimeout(timer)
  }, [query, open, search])

  async function pick(phone: string) {
    setLoading(true)
    setError('')
    try {
      const detail = await fetchCustomerDetail(adminToken, phone)
      onSelect(detail.customer)
      setQuery('')
      setOpen(false)
      setResults([])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el cliente')
    } finally {
      setLoading(false)
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Evita que Enter/Search envíe el formulario de la cita padre.
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      ;(e.target as HTMLInputElement).blur()
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-left">
        <span className={`${typography.caption} mb-0.5 block text-[11px]`}>
          Buscar cliente existente
        </span>
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          role="searchbox"
          value={query}
          disabled={disabled}
          aria-busy={loading}
          placeholder="Nombre o teléfono…"
          onFocus={() => setOpen(true)}
          onBlur={(e) => onBlurCapture(e.target.value)}
          onChange={(e) => {
            const next = e.target.value
            if (!shouldAcceptChange(query, next)) return
            setQuery(next)
            setOpen(true)
          }}
          onKeyDown={onSearchKeyDown}
          className="w-full border border-gold/30 bg-cream px-2.5 py-1.5 text-base outline-none focus:border-gold disabled:opacity-50 sm:text-sm"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      {open && (query.trim().length >= 2 || results.length > 0) && (
        <ul
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto border border-gold/30 bg-cream shadow-md"
          role="listbox"
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-charcoal-muted">Buscando…</li>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <li className="px-3 py-2 text-xs text-charcoal-muted">Sin resultados</li>
          )}
          {results.map((c) => {
            const hint = customerSearchHint(c, customerSearchTokens(query))
            return (
              <li key={c.phone}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full cursor-pointer flex-col px-3 py-2 text-left text-sm hover:bg-gold/10"
                  onClick={() => void pick(c.phone)}
                >
                  <span className="font-medium">
                    {formatCustomerDisplayName(c.firstName, c.lastName)}
                  </span>
                  {hint && (
                    <span className={`${typography.caption} text-charcoal-muted`}>{hint}</span>
                  )}
                  <span className={`${typography.caption} tabular-nums`}>
                    {formatPhoneDisplay(c.phone)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-800" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
