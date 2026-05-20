import { services } from '@/data/content'
import { Section } from '@/components/ui/Section'
import { ServiceIcon } from '@/components/ui/ServiceIcon'
import { typography } from '@/styles/typography'

export function Services() {
  return (
    <Section
      id="servicios"
      eyebrow="Lo que hacemos"
      scriptAccent="Servicios"
      title="Arte capilar a tu medida"
      subtitle="Técnicas actuales y productos de alta gama para un resultado impecable y luminoso."
    >
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((service, index) => (
          <article
            key={service.id}
            className="group flex flex-col items-center border border-gold/20 bg-cream p-8 text-center transition-all duration-500 hover:border-gold/50 hover:shadow-lg hover:shadow-gold/5"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="mb-6 rounded-full border border-gold/30 p-4 transition-colors group-hover:border-gold/60 group-hover:bg-gold/5">
              <ServiceIcon name={service.icon} />
            </div>
            <h3 className={`${typography.h3} mb-3 text-gold`}>{service.title}</h3>
            <p className={typography.body}>{service.description}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}
