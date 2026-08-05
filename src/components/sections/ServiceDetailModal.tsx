import { useEffect } from 'react'
import type { MarketingService } from '@/data/marketingServices'
import { whatsappUrl } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { useBookingFallback } from '@/hooks/useBookingFallback'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'

type Props = {
  service: MarketingService | null
  onClose: () => void
}

export function ServiceDetailModal({ service, onClose }: Props) {
  const { t, locale } = useTranslation()
  const { linkProps } = useBookingFallback()

  useEffect(() => {
    if (!service) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [service, onClose])

  if (!service) return null

  return (
    <div
      className="fixed inset-0 z-50 flex bg-charcoal/50 p-4 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-detail-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(100dvh,52rem)] w-full max-w-lg flex-col overflow-hidden bg-cream sm:max-h-[90vh] sm:border sm:border-gold/30 sm:shadow-xl md:max-h-[min(90vh,34rem)] md:max-w-3xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-charcoal/10 md:aspect-auto md:w-[40%] md:max-w-xs md:min-h-0 md:self-stretch">
          <img
            src={service.image}
            alt={service.imageAlt}
            className="h-full min-h-[12rem] w-full object-cover opacity-70 saturate-[0.9] contrast-[1.02] sepia-[0.18] brightness-[0.97] md:min-h-full"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-cream/50 via-gold/15 to-charcoal/25 mix-blend-multiply md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-cream/30"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 cursor-pointer border border-gold/40 bg-cream/95 px-2.5 py-1.5 text-sm text-charcoal-muted backdrop-blur-sm transition-colors hover:border-gold hover:text-gold md:hidden"
            aria-label={t.common.close}
          >
            ✕
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-8 sm:py-8 md:justify-center md:overflow-visible md:px-7 md:py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 hidden cursor-pointer border border-gold/40 bg-cream/95 px-2.5 py-1.5 text-sm text-charcoal-muted backdrop-blur-sm transition-colors hover:border-gold hover:text-gold md:block"
            aria-label={t.common.close}
          >
            ✕
          </button>
          <h2
            id="service-detail-title"
            className="mb-3 font-serif text-xl uppercase tracking-wide text-gold md:mb-2 md:pr-10 md:text-lg md:leading-snug"
          >
            {service.title}
          </h2>
          <p className={`${typography.body} mb-6 text-sm leading-snug md:mb-5`}>{service.detail}</p>
          <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:justify-center md:mt-0 md:justify-start">
            <Button {...linkProps} variant="solid" size="md">
              {t.nav.bookAppointment}
            </Button>
            <Button href={whatsappUrl(locale)} variant="outline" size="md">
              {t.common.whatsapp}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
