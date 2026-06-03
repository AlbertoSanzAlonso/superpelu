import type { ReactNode } from 'react'
import { Divider } from '@/components/ui/Divider'
import { typography } from '@/styles/typography'

type SectionProps = {
  id?: string
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  scriptAccent?: string
  children: ReactNode
  className?: string
  dark?: boolean
  /** Imagen de fondo a ancho completo, fusionada con el color de la sección */
  backgroundImage?: string
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
  backgroundImage,
}: SectionProps) {
  const hasAtmosphere = Boolean(backgroundImage)

  return (
    <section
      id={id}
      className={`section-padding ${hasAtmosphere ? 'relative isolate overflow-hidden' : ''} ${dark ? 'bg-charcoal text-cream' : 'bg-cream text-charcoal'} ${className}`}
    >
      {hasAtmosphere && backgroundImage && (
        <>
          <img
            src={backgroundImage}
            alt=""
            width={1920}
            height={1080}
            decoding="async"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center"
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute inset-0 z-[1] bg-gradient-to-br ${
              dark
                ? 'from-charcoal/72 via-charcoal/58 to-charcoal/78'
                : 'from-cream-dark/88 via-cream-dark/75 to-cream/88'
            }`}
            aria-hidden
          />
        </>
      )}
      <div className={`mx-auto max-w-6xl ${hasAtmosphere ? 'relative z-10' : ''}`}>
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
