import { brand, hero } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative flex min-h-screen items-center justify-center overflow-hidden pt-20 md:pt-[4.5rem]"
    >
      <div
        className="absolute inset-0 bg-cover bg-[58%_center] md:bg-center"
        style={{ backgroundImage: "url('/images/superpelu-hero.webp')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cream/85 via-cream/75 to-cream" aria-hidden />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-20 text-center md:px-10 md:pb-14">
        <h1 className="sr-only">
          {brand.name} {brand.tagline}
        </h1>

        <div className="animate-fade-up -mt-16 -mb-14 flex justify-center md:-mt-8 md:-mb-20">
          <Logo size="lg" variant="hero" />
        </div>

        <p className={`${typography.label} animate-fade-up-delay mb-6`}>{brand.location}</p>

        <p className={`${typography.script} animate-fade-up-delay mb-4`}>
          Tu belleza, nuestro arte
        </p>

        <p className={`${typography.body} animate-fade-up-delay mx-auto mb-10 max-w-2xl font-medium text-charcoal md:mb-4`}>
          {hero.lead}
        </p>

        <p className={`${typography.body} animate-fade-up-delay mx-auto mb-10 max-w-2xl hidden md:block`}>
          {hero.body}
        </p>

        <div className="animate-fade-up-delay flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href={brand.bookingOnline} variant="solid" size="lg">
            Reservar cita
          </Button>
          <Button href="#servicios" variant="outline" size="lg">
            Ver servicios
          </Button>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2" aria-hidden>
        <div className="h-12 w-px bg-gradient-to-b from-gold/60 to-transparent" />
      </div>
    </section>
  )
}
