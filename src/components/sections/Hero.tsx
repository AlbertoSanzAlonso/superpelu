import { brand } from '@/data/content'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

export function Hero() {
  return (
    <section
      id="inicio"
      className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/hero-salon.jpeg')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cream/85 via-cream/75 to-cream" aria-hidden />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-20 text-center md:px-10">
        <div className="animate-fade-up mb-10 flex justify-center">
          <Logo size="lg" />
        </div>

        <p className={`${typography.script} animate-fade-up-delay mb-4`}>
          Tu belleza, nuestro arte
        </p>

        <h1 className={`${typography.display} animate-fade-up-delay mb-6`}>
          Superpelu
          <br />
          <span className="text-gradient-gold">Hair Studio</span>
        </h1>

        <p className={`${typography.body} animate-fade-up-delay mx-auto mb-10 max-w-lg`}>
          Color, corte y tratamientos de autor en un espacio íntimo donde cada detalle
          está pensado para ti.
        </p>

        <div className="animate-fade-up-delay flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button href={brand.whatsapp} variant="solid" size="lg">
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
