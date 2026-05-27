import { brand } from '@/data/content'
import { typography } from '@/styles/typography'

/** Marca circular SP (WebP, fondo transparente). */
export const BRAND_MARK_SRC = '/images/superpelu-logo-sp-benalmadena.webp'

/** Logotipo horizontal para el pie (WebP, fondo transparente). */
export const BRAND_FOOTER_LOGO_SRC = '/images/superpelu-hair-studio-footer-logo.webp'

/** Logotipo vertical para el hero (WebP, fondo transparente). */
export const BRAND_HERO_LOGO_SRC = '/images/superpelu-hair-studio-hero-logo.webp'

type LogoProps = {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  variant?: 'default' | 'mark' | 'footer' | 'hero'
  className?: string
}

const heroLogoSizes = {
  sm: 'h-48 w-auto max-w-[min(100%,14rem)]',
  md: 'h-60 w-auto max-w-[min(100%,16rem)]',
  lg: 'h-80 w-auto max-w-[min(100%,22rem)] md:h-96 md:max-w-[min(100%,24rem)]',
}

const footerLogoSizes = {
  sm: 'h-24 w-auto max-w-[min(100%,28rem)]',
  md: 'h-28 w-auto max-w-[min(100%,32rem)]',
  lg: 'h-32 w-auto max-w-[min(100%,36rem)]',
}

const markSizes = {
  sm: 'h-14 w-14',
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
}

const monogramSizes = {
  sm: 'h-12 w-12 text-lg',
  md: 'h-16 w-16 text-xl',
  lg: 'h-24 w-24 text-3xl',
}

const nameSizes = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
}

export function Logo({
  size = 'md',
  showTagline = true,
  variant = 'default',
  className = '',
}: LogoProps) {
  if (variant === 'mark') {
    return (
      <img
        src={BRAND_MARK_SRC}
        alt={`${brand.name} — ${brand.tagline}`}
        width={384}
        height={384}
        className={`object-contain ${markSizes[size]} ${className}`}
        decoding="async"
      />
    )
  }

  if (variant === 'footer') {
    return (
      <img
        src={BRAND_FOOTER_LOGO_SRC}
        alt={`${brand.name} ${brand.tagline} — peluquería en Benalmádena`}
        width={640}
        height={213}
        className={`object-contain ${footerLogoSizes[size]} ${className}`}
        decoding="async"
      />
    )
  }

  if (variant === 'hero') {
    return (
      <img
        src={BRAND_HERO_LOGO_SRC}
        alt={`${brand.name} ${brand.tagline} — peluquería en Benalmádena`}
        width={512}
        height={341}
        className={`object-contain ${heroLogoSizes[size]} ${className}`}
        decoding="async"
        fetchPriority="high"
      />
    )
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`flex items-center justify-center rounded-full border border-gold/50 font-serif text-gold ${monogramSizes[size]}`}
        aria-hidden
      >
        <span className="tracking-tight">SP</span>
      </div>
      <div className="text-center">
        <p className={`${typography.h3} ${nameSizes[size]} text-gold`}>
          {brand.name}
        </p>
        {showTagline && (
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-gold/50" aria-hidden />
            <p className={`${typography.caption} text-gold/80`}>{brand.tagline}</p>
            <span className="h-px w-8 bg-gold/50" aria-hidden />
          </div>
        )}
      </div>
    </div>
  )
}
