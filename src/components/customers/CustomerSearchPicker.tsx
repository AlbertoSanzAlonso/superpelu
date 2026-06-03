import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCustomerDetail, fetchCustomers, ApiError } from '@/lib/api'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatPhoneDisplay } from '@/lib/phone'
import type { CustomerDetail } from '@/types/customers'
import { typography } from '@/styles/typography'

type Props = {
  adminToken: string
  onSelect: (customer: CustomerDetail['customer']) => void
  disabled?: boolean
}

export function CustomerSearchPicker({ adminToken, onSelect, disabled = false }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    { phone: string; firstName: string; lastName: string }[]
  >([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

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
        setResults(customers.slice(0, 8))
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

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-left">
        <span className={`${typography.caption} mb-0.5 block text-[11px]`}>
          Buscar cliente existente
        </span>
        <input
          type="search"
          value={query}
          disabled={disabled || loading}
          placeholder="Nombre o teléfono…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          className="w-full border border-gold/30 bg-cream px-2.5 py-1.5 text-sm outline-none focus:border-gold disabled:opacity-50"
          autoComplete="off"
        />
      </label>
      {open && (query.trim().length >= 2 || results.length > 0) && (
        <ul
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto border border-gold/30 bg-cream shadow-md"
          role="listbox"
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-charcoal-muted">Buscando…</li>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <li className="px-3 py-2 text-xs text-charcoal-muted">Sin resultados</li>
          )}
          {results.map((c) => (
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
                <span className={`${typography.caption} tabular-nums`}>
                  {formatPhoneDisplay(c.phone)}
                </span>
              </button>
            </li>
          ))}
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
