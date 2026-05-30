import { useTranslation } from '@/i18n/useTranslation'
import { Section } from '@/components/ui/Section'
import { typography } from '@/styles/typography'

export function Testimonials() {
  const { t } = useTranslation()

  return (
    <Section
      id="opiniones"
      eyebrow={t.testimonialsSection.eyebrow}
      scriptAccent={t.testimonialsSection.scriptAccent}
      title={t.testimonialsSection.title}
      subtitle={t.testimonialsSection.subtitle}
      dark
    >
      <div className="grid gap-8 md:grid-cols-2">
        {t.testimonials.map((item) => (
          <blockquote
            key={item.id}
            className="flex flex-col border border-gold/20 bg-cream p-8 text-center md:p-10"
          >
            <div className="mb-4 flex justify-center gap-1 text-gold" aria-label={t.testimonialsSection.starsAria(5)}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} aria-hidden>
                  ★
                </span>
              ))}
            </div>
            <p className={`${typography.body} mb-6 flex-1 italic`}>&ldquo;{item.quote}&rdquo;</p>
            <footer>
              <cite className={`${typography.h3} not-italic text-gold`}>{item.name}</cite>
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  )
}
