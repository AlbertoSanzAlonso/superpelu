import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/i18n/useTranslation'
import { bookingAnchorProps } from '@/lib/booking/fallback'
import { typography } from '@/styles/typography'

type Props = {
  url: string
}

export function BukBookingFallback({ url }: Props) {
  const { t } = useTranslation()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const linkProps = bookingAnchorProps(url)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#2c2416', light: '#faf7f2' },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="mx-auto max-w-lg border border-gold/25 bg-cream p-8 text-center md:p-10">
      <p className={`${typography.body} mb-8`}>{t.booking.bukFallback.body}</p>

      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={t.booking.bukFallback.qrAlt}
          className="mx-auto mb-8 h-56 w-56 border border-gold/20 bg-cream"
          width={224}
          height={224}
        />
      ) : (
        <div
          className="mx-auto mb-8 flex h-56 w-56 items-center justify-center border border-gold/20 bg-cream-dark"
          aria-hidden
        >
          <span className={typography.caption}>…</span>
        </div>
      )}

      <Button {...linkProps} variant="solid" size="lg">
        {t.booking.bukFallback.openBuk}
      </Button>
    </div>
  )
}
