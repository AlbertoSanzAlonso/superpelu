import { brand, highlights } from '@/data/content'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export function Studio() {
  return (
    <Section
      id="estudio"
      eyebrow="Nuestro espacio"
      scriptAccent="El estudio"
      title="Donde nace tu mejor versión"
      subtitle="Un ambiente cálido, elegante y acogedor. La misma estética que define nuestra marca: dorado, crema y luz suave."
      dark
    >
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-[4/5] overflow-hidden">
          <img
            src="/images/brand-identity.jpeg"
            alt="Identidad visual Superpelu Hair Studio"
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-gold/20" aria-hidden />
        </div>

        <div className="text-center lg:text-left">
          <p className={`${typography.body} mb-8 text-cream/80`}>
            En Superpelu creemos que ir a la peluquería debe sentirse como un ritual de
            cuidado. Cada visita es personalizada: escuchamos, asesoramos y cuidamos tu
            cabello con la dedicación que mereces.
          </p>

          <ul className="mb-10 space-y-4">
            {highlights.map((item) => (
              <li
                key={item}
                className="flex items-center justify-center gap-3 font-sans text-sm font-light text-cream/90 lg:justify-start"
              >
                <span className="h-1 w-1 shrink-0 rounded-full bg-gold-light" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <Button href={brand.whatsapp} variant="solid" size="md">
            Hablar por WhatsApp
          </Button>
        </div>
      </div>
    </Section>
  )
}
