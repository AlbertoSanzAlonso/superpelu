import type { ReactNode } from 'react'
import { brand } from '@/data/content'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export function Contact() {
  return (
    <Section
      id="contacto"
      eyebrow="Estamos aquí"
      scriptAccent="Contacto"
      title="Reserva tu cita"
      subtitle="Escríbenos por WhatsApp o llámanos. Te responderemos lo antes posible."
      className="bg-cream-dark"
    >
      <div className="mx-auto max-w-xl border border-gold/25 bg-cream p-10 text-center md:p-14">
        <div className="space-y-6">
          <ContactRow label="WhatsApp">
            <a
              href={brand.whatsapp}
              className="font-serif text-lg text-gold transition-colors hover:text-gold-dark"
            >
              {brand.phone}
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
          </ContactRow>
        </div>

        <div className="mt-10">
          <Button href={brand.whatsapp} variant="solid" size="lg">
            Reservar por WhatsApp
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
