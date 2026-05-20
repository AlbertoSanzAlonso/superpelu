import { brand } from '@/data/content'
import { typography } from '@/styles/typography'

type LogoProps = {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
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

export function Logo({ size = 'md', showTagline = true, className = '' }: LogoProps) {
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
