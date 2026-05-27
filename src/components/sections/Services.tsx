import { useState } from 'react'
import { marketingServices } from '@/data/marketingServices'
import { servicesSection } from '@/data/content'
import { Section } from '@/components/ui/Section'
import { ServiceIcon } from '@/components/ui/ServiceIcon'
import { ServiceDetailModal } from '@/components/sections/ServiceDetailModal'
import { typography } from '@/styles/typography'

export function Services() {
  const [selected, setSelected] = useState<(typeof marketingServices)[number] | null>(null)

  return (
    <>
      <Section
        id="servicios"
        eyebrow={servicesSection.eyebrow}
        scriptAccent={servicesSection.scriptAccent}
        title={servicesSection.title}
        subtitle={servicesSection.subtitle}
      >
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {marketingServices.map((service, index) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelected(service)}
              className="group flex min-w-0 cursor-pointer flex-col items-center border border-gold/20 bg-cream p-8 text-center transition-all duration-500 hover:border-gold/50 hover:shadow-lg hover:shadow-gold/5"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mb-6 rounded-full border border-gold/30 p-4 transition-colors group-hover:border-gold/60 group-hover:bg-gold/5">
                <ServiceIcon name={service.icon} />
              </div>
              <span
                className={`${typography.h3} mb-3 block min-w-0 max-w-full break-words text-balance text-gold transition-colors group-hover:text-gold-dark lg:text-base lg:leading-snug xl:text-lg`}
              >
                {service.title}
              </span>
              <p className={typography.body}>{service.description}</p>
            </button>
          ))}
        </div>
      </Section>

      <ServiceDetailModal service={selected} onClose={() => setSelected(null)} />
    </>
  )
}
