import { useState } from 'react'
import { brand, navLinks } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'

export function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-gold/10 bg-cream/90 backdrop-blur-md">
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
          className="border-t border-gold/10 bg-cream px-6 py-6 md:hidden"
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
