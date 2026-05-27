import { useEffect, useState } from 'react'
import { brand, navLinks } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'

const SCROLL_THRESHOLD = 12

export function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shellClass = scrolled
    ? 'border-b border-gold/15 bg-white/72 shadow-sm shadow-charcoal/5 backdrop-blur-md'
    : 'border-b border-gold/20 bg-cream-footer'

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-premium ${shellClass}`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between px-6 md:px-10">
        <a href="/#inicio" className="transition-opacity hover:opacity-80" aria-label={`${brand.name} — inicio`}>
          <Logo size="sm" variant="mark" />
        </a>

        <nav className="hidden items-center gap-10 md:flex" aria-label="Principal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-sans text-xs uppercase tracking-wide text-charcoal-muted transition-colors hover:text-gold"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button href={brand.bookingOnline} variant="outline" size="sm">
            Reservar
          </Button>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
          aria-expanded={open}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen(!open)}
        >
          <span className={`h-px w-6 bg-gold transition-transform ${open ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`h-px w-6 bg-gold transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`h-px w-6 bg-gold transition-transform ${open ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {open && (
        <nav
          className={`border-t px-6 py-6 backdrop-blur-md md:hidden ${
            scrolled ? 'border-gold/15 bg-white/72' : 'border-gold/20 bg-cream-footer'
          }`}
          aria-label="Menú móvil"
        >
          <ul className="flex flex-col items-center gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="font-sans text-sm uppercase tracking-wide text-charcoal"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Button href={brand.bookingOnline} variant="solid" size="md">
                Reservar cita
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
