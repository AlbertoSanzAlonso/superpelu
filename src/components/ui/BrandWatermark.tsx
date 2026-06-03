import { BRAND_MARK_SRC } from '@/components/ui/Logo'

type Props = {
  /** `section`: home servicios. `page`: reserva (contenedor). `viewport`: agenda login y workspace (misma posición en pantalla). */
  variant?: 'section' | 'page' | 'viewport'
  className?: string
}

const variantClass: Record<NonNullable<Props['variant']>, string> = {
  section:
    'absolute left-1/2 top-[61%] w-[min(92vw,36rem)] -translate-x-1/2 -translate-y-1/2 md:top-[66%]',
  page:
    'absolute left-1/2 top-1/2 w-[min(98vw,52rem)] -translate-x-1/2 -translate-y-1/2 md:top-[58%]',
  viewport:
    'fixed left-1/2 top-1/2 z-0 w-[min(98vw,52rem)] -translate-x-1/2 -translate-y-1/2 md:top-[58%]',
}

export function BrandWatermark({ variant = 'section', className = '' }: Props) {
  return (
    <img
      src={BRAND_MARK_SRC}
      alt=""
      width={384}
      height={384}
      aria-hidden
      decoding="async"
      className={`pointer-events-none h-auto select-none opacity-[0.11] ${variantClass[variant]} ${className}`}
    />
  )
}
