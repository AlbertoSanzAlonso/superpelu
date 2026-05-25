import type { ReactNode } from 'react'
import { bookingOptions, brand, contactSection } from '@/data/content'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export function Contact() {
  return (
    <Section
      id="contacto"
      eyebrow={contactSection.eyebrow}
      scriptAccent={contactSection.scriptAccent}
      title={contactSection.title}
      subtitle={contactSection.subtitle}
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
          <ContactRow label="Teléfono">
            <a
              href={brand.phoneHref}
              className="font-serif text-lg text-gold transition-colors hover:text-gold-dark"
            >
              {brand.phone}
            </a>
          </ContactRow>

          <ContactRow label="WhatsApp">
            <a
              href={brand.whatsapp}
              className="font-serif text-lg text-gold transition-colors hover:text-gold-dark"
              target="_blank"
              rel="noopener noreferrer"
            >
              604 808 312
            </a>
          </ContactRow>

          <ContactRow label="Email">
            <a
              href={`mailto:${brand.email}`}
              className={`${typography.body} hover:text-gold`}
            >
              {brand.email}
            </a>
          </ContactRow>

          <ContactRow label="Ubicación">
            <p className={typography.body}>{brand.address}</p>
            <a
              href={brand.maps}
              className={`${typography.label} mt-3 inline-block hover:text-gold-dark`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver en Google Maps
            </a>
          </ContactRow>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button href={brand.bookingOnline} variant="solid" size="lg">
            Reservar cita online
          </Button>
          <Button href={brand.whatsapp} variant="outline" size="lg">
            WhatsApp
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
