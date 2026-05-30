import { Link } from 'react-router-dom'
import { brand } from '@/data/content'
import { getNavLinks, whatsappUrl } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { Logo } from '@/components/ui/Logo'
import { Divider } from '@/components/ui/Divider'
import { SocialIcon } from '@/components/ui/SocialIcon'
import { typography } from '@/styles/typography'

export function Footer() {
  const { t, locale } = useTranslation()
  const navLinks = getNavLinks(locale)
  const socialLinks = [
    { id: 'instagram' as const, href: brand.instagram, label: 'Instagram' },
    { id: 'facebook' as const, href: brand.facebook, label: 'Facebook' },
    { id: 'tiktok' as const, href: brand.tiktok, label: 'TikTok' },
    { id: 'whatsapp' as const, href: whatsappUrl(locale), label: t.common.whatsapp },
  ]
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gold/20 bg-cream-footer section-padding py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center">
        <Logo size="sm" variant="footer" />
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

        <nav className="flex flex-wrap justify-center gap-6" aria-label={t.footer.footerNavAria}>
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

        <div className="flex justify-center gap-4" role="list" aria-label={t.footer.socialAria}>
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
          <Link
            to="/politica-de-cookies"
            className={`${typography.caption} hover:text-gold`}
          >
            {t.footer.cookiePolicy}
          </Link>
        </div>

        <p className={typography.caption}>
          © {year} {brand.name} {brand.tagline} · {brand.location}. {t.common.allRightsReserved}
        </p>
      </div>
    </footer>
  )
}
