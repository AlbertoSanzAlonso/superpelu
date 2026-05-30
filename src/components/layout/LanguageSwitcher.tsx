import { useTranslation } from '@/i18n/useTranslation'
import type { Locale } from '@/i18n/types'

type Props = {
  className?: string
  compact?: boolean
}

export function LanguageSwitcher({ className = '', compact = false }: Props) {
  const { locale, setLocale, t } = useTranslation()

  function toggle(next: Locale) {
    if (next !== locale) setLocale(next)
  }

  const btnClass = (active: boolean) =>
    [
      'cursor-pointer px-2 py-1 font-sans text-xs uppercase tracking-wide transition-colors',
      active
        ? 'text-gold'
        : 'text-charcoal-muted hover:text-gold',
    ].join(' ')

  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      role="group"
      aria-label={t.language.label}
    >
      {!compact && (
        <span className="sr-only">{t.language.label}</span>
      )}
      <button
        type="button"
        className={btnClass(locale === 'es')}
        aria-pressed={locale === 'es'}
        onClick={() => toggle('es')}
      >
        {t.language.es}
      </button>
      <span className="text-charcoal-muted/40" aria-hidden>
        |
      </span>
      <button
        type="button"
        className={btnClass(locale === 'en')}
        aria-pressed={locale === 'en'}
        onClick={() => toggle('en')}
      >
        {t.language.en}
      </button>
    </div>
  )
}
