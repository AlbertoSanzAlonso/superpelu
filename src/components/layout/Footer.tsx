import { Link } from 'react-router-dom'
import { brand, footerLegal, navLinks } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { Divider } from '@/components/ui/Divider'
import { SocialIcon } from '@/components/ui/SocialIcon'
import { typography } from '@/styles/typography'

const socialLinks = [
  { id: 'instagram' as const, href: brand.instagram, label: 'Instagram' },
  { id: 'facebook' as const, href: brand.facebook, label: 'Facebook' },
  { id: 'tiktok' as const, href: brand.tiktok, label: 'TikTok' },
  { id: 'whatsapp' as const, href: brand.whatsapp, label: 'WhatsApp' },
]

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

        <div className="flex justify-center gap-4" role="list" aria-label="Redes sociales">
          {socialLinks.map((link) => (
            <a
              key={link.id}
              href={link.href}
              role="listitem"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/25 text-charcoal-muted transition-colors hover:border-gold hover:text-gold"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
            >
              <SocialIcon name={link.id} />
            </a>
          ))}
        </div>

        <Divider />

        <div className="flex flex-wrap justify-center gap-4">
          {footerLegal.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`${typography.caption} hover:text-gold`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <p className={typography.caption}>
          © {year} {brand.name} {brand.tagline} · {brand.location}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  )
}
