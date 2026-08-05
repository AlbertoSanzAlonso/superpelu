import type { Locale } from '@/i18n/types'
import { typography } from '@/styles/typography'

const fieldClass =
  'w-full cursor-pointer border border-gold/30 bg-cream px-3 py-2 text-sm outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-50'

type Props = {
  value: Locale
  onChange: (locale: Locale) => void
  disabled?: boolean
  compact?: boolean
  id?: string
}

export function CustomerLocaleSelect({
  value,
  onChange,
  disabled = false,
  compact = false,
  id = 'customer-locale',
}: Props) {
  return (
    <label className="block text-left">
      <span className={`${typography.label} ${compact ? 'mb-0.5 block text-xs' : 'mb-1 block'}`}>
        Idioma del cliente
      </span>
      <p className={`${typography.caption} mb-1.5 text-charcoal-muted`}>
        Idioma de WhatsApp (citas y felicitación de cumpleaños). Cámbialo aquí si hace falta; por
        defecto español.
      </p>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'en' ? 'en' : 'es')}
        className={compact ? `${fieldClass} py-1.5` : fieldClass}
      >
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
    </label>
  )
}

export function customerLocaleLabel(locale: string | null | undefined): string {
  return locale === 'en' ? 'English' : 'Español'
}
