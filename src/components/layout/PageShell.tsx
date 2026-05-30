import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '@/data/content'
import { useTranslation } from '@/i18n/useTranslation'
import { Logo } from '@/components/ui/Logo'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { typography } from '@/styles/typography'

type PageShellProps = {
  title: string
  subtitle?: string
  titleClassName?: string
  subtitleClassName?: string
  wide?: boolean
  children: ReactNode
}

export function PageShell({
  title,
  subtitle,
  titleClassName,
  subtitleClassName,
  wide = false,
  children,
}: PageShellProps) {
  const { t } = useTranslation()
  const contentMax = wide ? 'max-w-[min(100%,90rem)]' : 'max-w-4xl'

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-gold/20 bg-cream-footer">
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

      <main className={`mx-auto ${contentMax} px-6 py-12 md:px-10 md:py-16`}>
        <header className="mb-10 text-center">
          <p className={`${typography.script} mb-2 text-gold`}>{t.common.agendaEyebrow}</p>
          <h1 className={titleClassName ?? typography.h1}>{title}</h1>
          {subtitle && (
            <p className={`${typography.body} mx-auto mt-4 max-w-lg ${subtitleClassName ?? ''}`}>
              {subtitle}
            </p>
          )}
        </header>
        {children}
      </main>
    </div>
  )
}
