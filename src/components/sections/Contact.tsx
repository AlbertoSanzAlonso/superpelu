import type { ReactNode } from 'react'
import { brand } from '@/data/content'
import { getBookingOptions, whatsappUrl } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'
import { PhoneIcon, WhatsAppIcon, CalendarIcon } from '@/components/ui/Icons'

function isExternalHref(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://')
}

export function Contact() {
  const { t, locale } = useTranslation()
  const bookingOptions = getBookingOptions(locale)

  return (
    <Section
      id="contacto"
      eyebrow={t.contactSection.eyebrow}
      scriptAccent={t.contactSection.scriptAccent}
      title={t.contactSection.title}
      subtitle={
        locale === 'es' ? (
          <>
            Reserva online, llámanos o escríbenos por WhatsApp. Estamos en{' '}
            <a
              href={brand.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gold transition-colors"
            >
              Av. las Palmeras, Arroyo de la Miel
            </a>
            .
          </>
        ) : (
          <>
            Book online, call us or message us on WhatsApp. We're on{' '}
            <a
              href={brand.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-gold transition-colors"
            >
              Av. las Palmeras, Arroyo de la Miel
            </a>
            .
          </>
        )
      }
      className="bg-cream-dark"
    >
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        {bookingOptions.map((option) => {
          const optionLink = isExternalHref(option.href)
            ? { href: option.href, target: '_blank' as const, rel: 'noopener noreferrer' }
            : { href: option.href }
          return (
            <article
              key={option.id}
              className="flex flex-col border border-gold/20 bg-cream p-8 text-center"
            >
              <div className="mb-4 flex justify-center text-gold">
                {option.id === 'online' && <CalendarIcon className="h-8 w-8" />}
                {option.id === 'phone' && <PhoneIcon className="h-8 w-8" />}
                {option.id === 'whatsapp' && <WhatsAppIcon className="h-8 w-8" />}
              </div>
              <h3 className={`${typography.h3} mb-2 text-gold`}>{option.title}</h3>
              <p className={`${typography.body} mb-6 flex-1`}>{option.description}</p>
              <Button {...optionLink} variant="outline" size="md">
                {option.label}
              </Button>
            </article>
          )
        })}
      </div>

      <div className="mx-auto max-w-xl border border-gold/25 bg-cream p-10 text-center md:p-14">
        <div className="space-y-6">
          <ContactRow label={t.contactSection.phone}>
            <a
              href={brand.phoneHref}
              className="inline-flex items-center gap-2 font-serif text-lg text-gold transition-colors hover:text-gold-dark"
            >
              <PhoneIcon className="h-5 w-5 text-gold/80" />
              {brand.phone}
            </a>
          </ContactRow>

          <ContactRow label={t.common.whatsapp}>
            <a
              href={whatsappUrl(locale)}
              className="inline-flex items-center gap-2 font-serif text-lg text-gold transition-colors hover:text-gold-dark"
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon className="h-5 w-5 text-gold/80" />
              604 808 312
            </a>
          </ContactRow>

          <ContactRow label={t.contactSection.email}>
            <a
              href={`mailto:${brand.email}`}
              className={`${typography.body} hover:text-gold`}
            >
              {brand.email}
            </a>
          </ContactRow>

          <ContactRow label={t.contactSection.location}>
            <a
              href={brand.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-xs sm:text-sm font-light leading-relaxed text-charcoal-muted hover:text-gold transition-colors whitespace-normal sm:whitespace-nowrap text-center max-w-full px-4 min-w-0"
            >
              {brand.address}
            </a>
            <a
              href={brand.maps}
              className={`${typography.label} mt-3 inline-block hover:text-gold-dark`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.studioSection.viewOnMaps}
            </a>
          </ContactRow>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button href={brand.bookingOnline} variant="solid" size="lg">
            {t.nav.bookAppointmentOnline}
          </Button>
          <Button href={whatsappUrl(locale)} variant="outline" size="lg">
            <WhatsAppIcon className="mr-2 h-5 w-5" />
            {t.common.whatsapp}
          </Button>
        </div>
      </div>
    </Section>
  )
}

function ContactRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center">
      <p className={`${typography.label} mb-1`}>{label}</p>
      {children}
    </div>
  )
}
