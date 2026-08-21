import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BrandWatermark } from '@/components/ui/BrandWatermark'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/i18n/useTranslation'
import {
  readCookieConsent,
  shouldShowCookieConsentBanner,
  writeCookieConsent,
  type CookieConsentChoice,
} from '@/lib/cookieConsent'
import { typography } from '@/styles/typography'

export function CookieConsentBanner() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const titleId = useId()
  const descId = useId()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!shouldShowCookieConsentBanner(pathname)) {
      setVisible(false)
      return
    }
    setVisible(readCookieConsent() === null)
  }, [pathname])

  if (!visible) return null

  const dismiss = (choice: CookieConsentChoice) => {
    writeCookieConsent(choice)
    setVisible(false)
  }

  return (
    <div
      className="cookie-consent-enter fixed inset-x-0 bottom-0 z-[80] p-3 sm:p-4"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="relative mx-auto max-w-5xl overflow-hidden border border-gold/30 bg-cream-footer/95 shadow-[0_-12px_40px_-20px_rgba(44,40,37,0.35)] backdrop-blur-md">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
          aria-hidden
        />
        <BrandWatermark variant="banner" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-7 sm:py-5">
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className={`${typography.label} mb-1`}>{t.cookieConsent.eyebrow}</p>
            <h2 id={titleId} className="font-serif text-lg uppercase tracking-wide text-charcoal sm:text-xl">
              {t.cookieConsent.title}
            </h2>
            <p id={descId} className={`${typography.body} mt-1.5 text-xs leading-relaxed sm:text-sm`}>
              {t.cookieConsent.body}{' '}
              <Link
                to="/politica-de-cookies"
                className="text-gold underline-offset-2 transition-colors hover:text-gold-dark hover:underline"
              >
                {t.cookieConsent.policyLink}
              </Link>
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="solid"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => dismiss('accepted')}
            >
              {t.cookieConsent.accept}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => dismiss('necessary')}
            >
              {t.cookieConsent.necessaryOnly}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
