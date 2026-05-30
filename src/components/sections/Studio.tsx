import { brand } from '@/data/content'
import { useTranslation } from '@/i18n/useTranslation'
import { whatsappUrl } from '@/i18n/helpers'
import { Section } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export function Studio() {
  const { t, locale } = useTranslation()

  return (
    <>
      <Section
        eyebrow={t.studioSection.eyebrow}
        scriptAccent={t.studioSection.scriptAccent}
        title={t.studioSection.title}
        subtitle={t.studioSection.subtitle}
        className="!pt-40 md:!pt-44 bg-cream-dark"
      >
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="ui-rounded relative aspect-[4/5] overflow-hidden">
            <img
              src="/images/superpelu-salon.webp"
              alt={t.studioSection.salonImageAlt}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-gold/20" aria-hidden />
          </div>

          <div className="text-center lg:text-left">
            <p className={`${typography.body} mb-6 text-charcoal-muted`}>{t.studioSection.intro}</p>
            <p className={`${typography.body} mb-8 text-charcoal-muted`}>{t.studioSection.team}</p>

            <ul className="mb-10 space-y-4">
              {t.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-center justify-center gap-3 font-sans text-sm font-light text-charcoal lg:justify-start"
                >
                  <span className="h-1 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <Button href={brand.bookingOnline} variant="solid" size="md">
                {t.nav.bookAppointment}
              </Button>
              <Button href={whatsappUrl(locale)} variant="outline" size="md">
                {t.common.whatsapp}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section title={t.studioSection.mapsTitle} subtitle={brand.address} dark>
        <div className="ui-rounded relative aspect-[4/3] w-full overflow-hidden ring-1 ring-gold/20 md:aspect-[16/9]">
          <iframe
            src={brand.mapsEmbed}
            title={t.studioSection.mapsIframeTitle}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <p className="mt-6 text-center">
          <a
            href={brand.maps}
            className={`${typography.label} text-gold-light transition-colors hover:text-gold`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.studioSection.openInMaps}
          </a>
        </p>
      </Section>
    </>
  )
}
