import type { ReactNode } from 'react'
import { Divider } from '@/components/ui/Divider'
import { typography } from '@/styles/typography'

type SectionProps = {
  id?: string
  eyebrow?: string
  title: string
  subtitle?: string
  scriptAccent?: string
  children: ReactNode
  className?: string
  dark?: boolean
}

export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  scriptAccent,
  children,
  className = '',
  dark = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`section-padding ${dark ? 'bg-charcoal text-cream' : 'bg-cream'} ${className}`}
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-14 text-center md:mb-20">
          {eyebrow && (
            <p className={`${typography.label} mb-4 ${dark ? 'text-gold-light' : ''}`}>
              {eyebrow}
            </p>
          )}
          {scriptAccent && (
            <p className={`${typography.script} mb-2 ${dark ? 'text-gold-light' : ''}`}>
              {scriptAccent}
            </p>
          )}
          <h2
            className={`${typography.h1} ${dark ? 'text-cream' : ''}`}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={`${typography.body} mx-auto mt-6 max-w-xl ${dark ? 'text-cream/70' : ''}`}
            >
              {subtitle}
            </p>
          )}
          <Divider className="mt-8" variant={dark ? 'light' : 'gold'} />
        </header>
        {children}
      </div>
    </section>
  )
}
