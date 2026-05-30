import { useMemo, useState } from 'react'
import type { MarketingService } from '@/data/marketingServices'
import { getMarketingServices } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { Section } from '@/components/ui/Section'
import { BRAND_MARK_SRC } from '@/components/ui/Logo'
import { ServiceIcon } from '@/components/ui/ServiceIcon'
import { ServiceDetailModal } from '@/components/sections/ServiceDetailModal'
import { typography } from '@/styles/typography'

export function Services() {
  const { locale, t } = useTranslation()
  const marketingServices = useMemo(() => getMarketingServices(locale), [locale])
  const [selected, setSelected] = useState<MarketingService | null>(null)

  return (
    <>
      <Section
        id="servicios"
        eyebrow={t.servicesSection.eyebrow}
        scriptAccent={t.servicesSection.scriptAccent}
        title={t.servicesSection.title}
        subtitle={t.servicesSection.subtitle}
        className="relative overflow-hidden"
      >
        <img
          src={BRAND_MARK_SRC}
          alt=""
          width={384}
          height={384}
          aria-hidden
          decoding="async"
          className="pointer-events-none absolute left-1/2 top-[61%] z-0 h-auto w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.11] md:top-[66%]"
        />
        <div className="relative z-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {marketingServices.map((service, index) => (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelected(service)}
              className="group flex min-w-0 cursor-pointer flex-col items-center border border-gold/20 bg-cream/35 p-8 text-center backdrop-blur-[2px] transition-all duration-500 hover:border-gold/50 hover:bg-cream/50 hover:shadow-lg hover:shadow-gold/5"
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
