import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { typography } from '@/styles/typography'

type PageShellProps = {
  title: string
  subtitle?: string
  wide?: boolean
  children: ReactNode
}

export function PageShell({ title, subtitle, wide = false, children }: PageShellProps) {
  const contentMax = wide ? 'max-w-[min(100%,90rem)]' : 'max-w-4xl'

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-gold/20 bg-cream-footer">
        <div className={`mx-auto flex h-[4.5rem] ${contentMax} items-center justify-between px-6 md:px-10`}>
          <Link to="/" className="transition-opacity hover:opacity-80" aria-label={`${brand.name} — inicio`}>
            <Logo size="sm" variant="mark" />
          </Link>
          <Link
            to="/"
            className={`${typography.caption} text-charcoal-muted transition-colors hover:text-gold`}
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className={`mx-auto ${contentMax} px-6 py-12 md:px-10 md:py-16`}>
        <header className="mb-10 text-center">
          <p className={`${typography.script} mb-2 text-gold`}>Agenda</p>
          <h1 className={typography.h1}>{title}</h1>
          {subtitle && <p className={`${typography.body} mx-auto mt-4 max-w-lg`}>{subtitle}</p>}
        </header>
        {children}
      </main>
    </div>
  )
}
