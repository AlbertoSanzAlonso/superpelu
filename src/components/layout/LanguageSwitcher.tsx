import { LocaleFlagIcon } from '@/components/layout/LocaleFlagIcon'
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
      'block h-5 w-7 cursor-pointer overflow-hidden rounded-sm border p-0 transition-all',
      active
        ? 'border-gold/60 shadow-sm ring-1 ring-gold/25'
        : 'border-gold/15 opacity-75 hover:border-gold/35 hover:opacity-100',
    ].join(' ')

  const locales: { id: Locale; label: string }[] = [
    { id: 'es', label: t.language.es },
    { id: 'en', label: t.language.en },
  ]

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      role="group"
      aria-label={t.language.label}
    >
      {!compact && <span className="sr-only">{t.language.label}</span>}
      {locales.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={btnClass(locale === id)}
          aria-pressed={locale === id}
          aria-label={label}
          title={label}
          onClick={() => toggle(id)}
        >
          <LocaleFlagIcon locale={id} />
        </button>
      ))}
    </div>
  )
}
