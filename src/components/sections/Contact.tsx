import type { ReactNode } from 'react'
import { brand } from '@/data/content'
import { getBookingOptions, whatsappUrl } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export function Contact() {
  const { t, locale } = useTranslation()
  const bookingOptions = getBookingOptions(locale)

  return (
    <Section
      id="contacto"
      eyebrow={t.contactSection.eyebrow}
      scriptAccent={t.contactSection.scriptAccent}
      title={t.contactSection.title}
      subtitle={t.contactSection.subtitle}
      className="bg-cream-dark"
    >
      <div className="mb-12 grid gap-6 md:grid-cols-3">
        {bookingOptions.map((option) => (
          <article
            key={option.id}
            className="flex flex-col border border-gold/20 bg-cream p-8 text-center"
          >
            <h3 className={`${typography.h3} mb-2 text-gold`}>{option.title}</h3>
            <p className={`${typography.body} mb-6 flex-1`}>{option.description}</p>
            <Button href={option.href} variant="outline" size="md">
              {option.label}
            </Button>
          </article>
        ))}
      </div>

      <div className="mx-auto max-w-xl border border-gold/25 bg-cream p-10 text-center md:p-14">
        <div className="space-y-6">
          <ContactRow label={t.contactSection.phone}>
            <a
              href={brand.phoneHref}
              className="font-serif text-lg text-gold transition-colors hover:text-gold-dark"
            >
              {brand.phone}
            </a>
          </ContactRow>

          <ContactRow label={t.common.whatsapp}>
            <a
              href={whatsappUrl(locale)}
              className="font-serif text-lg text-gold transition-colors hover:text-gold-dark"
              target="_blank"
              rel="noopener noreferrer"
            >
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
            <p className={typography.body}>{brand.address}</p>
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
    <div>
      <p className={`${typography.label} mb-1`}>{label}</p>
      {children}
    </div>
  )
}
