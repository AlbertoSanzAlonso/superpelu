import type { Locale } from '@/i18n/types'

/** Colores de bandera mezclados con la paleta Superpelu (theme.css). */
const flag = {
  spainBand: '#a67c6d',
  gold: 'var(--color-gold)',
  cream: 'var(--color-cream)',
  charcoalMuted: 'var(--color-charcoal-muted)',
  goldDark: 'var(--color-gold-dark)',
  goldLight: 'var(--color-gold-light)',
} as const

type Props = {
  locale: Locale
  className?: string
}

function SpainFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      preserveAspectRatio="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="4" fill={flag.spainBand} />
      <rect y="4" width="24" height="8" fill={flag.gold} />
      <rect y="12" width="24" height="4" fill={flag.spainBand} />
    </svg>
  )
}

function UkFlag({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      preserveAspectRatio="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="24" height="16" fill={flag.charcoalMuted} />
      <path
        d="M0 0 L24 16 M24 0 L0 16"
        stroke={flag.cream}
        strokeWidth="3"
        strokeLinecap="square"
      />
      <path d="M10 0 H14 V16 H10 Z M0 6 H24 V10 H0 Z" fill={flag.cream} />
      <path
        d="M0 0 L24 16 M24 0 L0 16"
        stroke={flag.goldDark}
        strokeWidth="1.25"
        strokeLinecap="square"
      />
      <path d="M11 0 H13 V16 H11 Z M0 7 H24 V9 H0 Z" fill={flag.goldDark} />
      <path
        d="M0 0 L24 16 M24 0 L0 16"
        stroke={flag.goldLight}
        strokeWidth="0.75"
        strokeLinecap="square"
        opacity="0.85"
      />
    </svg>
  )
}

export function LocaleFlagIcon({ locale, className = 'block size-full' }: Props) {
  return locale === 'es' ? <SpainFlag className={className} /> : <UkFlag className={className} />
}
