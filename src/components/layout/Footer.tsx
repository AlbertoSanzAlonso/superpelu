import { Link } from 'react-router-dom'
import { brand } from '@/data/content'
import { getNavLinks, whatsappUrl } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { Logo } from '@/components/ui/Logo'
import { Divider } from '@/components/ui/Divider'
import { SocialIcon } from '@/components/ui/SocialIcon'
import { typography } from '@/styles/typography'
import { PhoneIcon, MailIcon } from '@/components/ui/Icons'

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
        
        <div className="flex flex-col items-center gap-3">
          <a
            href={brand.maps}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-xs sm:text-sm font-light tracking-wide text-charcoal-muted hover:text-gold transition-colors text-center max-w-md px-4"
          >
            {brand.address}
          </a>
          
          <div className="flex flex-col items-center gap-1.5">
            <a
              href={brand.phoneHref}
              className="inline-flex items-center gap-1.5 font-sans text-xs sm:text-sm font-light tracking-wide text-charcoal-muted hover:text-gold transition-colors uppercase whitespace-nowrap"
            >
              <PhoneIcon className="h-3.5 w-3.5 text-gold shrink-0" />
              <span>{brand.phone}</span>
            </a>
            <a
              href={`mailto:${brand.email}`}
              className="inline-flex items-center gap-1.5 font-sans text-xs sm:text-sm font-light tracking-wide text-charcoal-muted hover:text-gold transition-colors uppercase whitespace-nowrap"
            >
              <MailIcon className="h-3.5 w-3.5 text-gold shrink-0" />
              <span>{brand.email}</span>
            </a>
          </div>
        </div>

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
