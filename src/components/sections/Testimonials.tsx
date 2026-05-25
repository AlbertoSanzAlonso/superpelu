import { testimonials, testimonialsSection } from '@/data/content'
import { Section } from '@/components/ui/Section'
import { typography } from '@/styles/typography'

export function Testimonials() {
  return (
    <Section
      id="opiniones"
      eyebrow={testimonialsSection.eyebrow}
      scriptAccent={testimonialsSection.scriptAccent}
      title={testimonialsSection.title}
      subtitle={testimonialsSection.subtitle}
      className="bg-cream-dark"
    >
      <div className="grid gap-8 md:grid-cols-2">
        {testimonials.map((item) => (
          <blockquote
            key={item.id}
            className="flex flex-col border border-gold/20 bg-cream p-8 text-center md:p-10"
          >
            <div className="mb-4 flex justify-center gap-1 text-gold" aria-label={`${item.rating} de 5 estrellas`}>
              {Array.from({ length: item.rating }).map((_, i) => (
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
