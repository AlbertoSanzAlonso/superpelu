import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '@/data/content'
import { useTranslation } from '@/i18n/useTranslation'
import { BrandWatermark } from '@/components/ui/BrandWatermark'
import { Logo } from '@/components/ui/Logo'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { typography } from '@/styles/typography'

type PageShellProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  titleClassName?: string
  subtitleClassName?: string
  wide?: boolean
  /** `viewport`: misma posición fija que agenda (login). `true` equivale a `page` (reserva). */
  brandWatermark?: boolean | 'viewport'
  children: ReactNode
}

export function PageShell({
  eyebrow,
  title,
  subtitle,
  titleClassName,
  subtitleClassName,
  wide = false,
  brandWatermark = false,
  children,
}: PageShellProps) {
  const { t } = useTranslation()
  const contentMax = wide ? 'max-w-[min(100%,90rem)]' : 'max-w-4xl'

  const watermarkViewport = brandWatermark === 'viewport'

  return (
    <div className="relative min-h-screen bg-cream">
      {watermarkViewport && <BrandWatermark variant="viewport" />}
      <header className="relative z-10 border-b border-gold/20 bg-cream-footer">
        <div className={`mx-auto flex h-[4.5rem] ${contentMax} items-center justify-between px-6 md:px-10`}>
          <Link to="/" className="transition-opacity hover:opacity-80" aria-label={t.nav.homeAria(brand.name)}>
            <Logo size="sm" variant="mark" />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              to="/"
              className={`${typography.caption} text-charcoal-muted transition-colors hover:text-gold`}
            >
              {t.common.backHome}
            </Link>
          </div>
        </div>
      </header>

      <main
        className={`relative mx-auto overflow-hidden ${contentMax} px-6 py-12 md:px-10 md:py-16${
          brandWatermark && !watermarkViewport ? ' min-h-[calc(100dvh-4.5rem)]' : ''
        }`}
      >
        {brandWatermark === true && <BrandWatermark variant="page" />}
        <div className="relative z-10">
          <header className="mb-10 text-center">
            {eyebrow && (
              <p className={`${typography.script} mb-2 text-gold`}>{eyebrow}</p>
            )}
            <h1 className={titleClassName ?? typography.h1}>{title}</h1>
            {subtitle && (
              <p className={`${typography.body} mx-auto mt-4 max-w-lg ${subtitleClassName ?? ''}`}>
                {subtitle}
              </p>
            )}
          </header>
          {children}
        </div>
      </main>
    </div>
  )
}
