import { brand, footerLegal, navLinks } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { Divider } from '@/components/ui/Divider'
import { typography } from '@/styles/typography'

const socialLinks = [
  { href: brand.instagram, label: 'Instagram' },
  { href: brand.facebook, label: 'Facebook' },
  { href: brand.tiktok, label: 'TikTok' },
] as const

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gold/15 bg-cream-dark section-padding py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center">
        <Logo size="sm" />
        <p className={`${typography.body} max-w-md`}>{brand.address}</p>
        <p className={typography.caption}>
          <a href={brand.phoneHref} className="hover:text-gold">
            {brand.phone}
          </a>
          {' · '}
          <a href={`mailto:${brand.email}`} className="hover:text-gold">
            {brand.email}
          </a>
        </p>

        <nav className="flex flex-wrap justify-center gap-6" aria-label="Enlaces del pie">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`${typography.caption} hover:text-gold`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex flex-wrap justify-center gap-6">
          {socialLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`${typography.caption} hover:text-gold`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>

        <Divider />

        <div className="flex flex-wrap justify-center gap-4">
          {footerLegal.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`${typography.caption} hover:text-gold`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>

        <p className={typography.caption}>
          © {year} {brand.name} {brand.tagline} · {brand.location}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
