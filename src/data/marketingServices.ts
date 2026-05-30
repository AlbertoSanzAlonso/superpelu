import coloracionMagenta from '@/assets/gallery/coloracion-magenta-borgona-ondas-benalmadena.webp'
import mechasBalayage from '@/assets/gallery/mechas-balayage-rubio-ondas-benalmadena.webp'
import balayageBob from '@/assets/gallery/balayage-rubio-bob-liso-benalmadena.webp'
import balayageRizos from '@/assets/gallery/balayage-rubio-rizos-melena-benalmadena.webp'

function assetUrl(url: string): string {
  return url.startsWith('/') ? url : `/${url}`
}

export type MarketingServiceId = 'color' | 'balayage' | 'corte' | 'tratamiento'

export type MarketingService = {
  id: MarketingServiceId
  title: string
  description: string
  detail: string
  icon: 'palette' | 'sun' | 'scissors' | 'sparkle'
  image: string
  imageAlt: string
}

/** Recursos estáticos; textos en src/i18n/translations.ts → marketingServices */
export const marketingServiceAssets: Record<
  MarketingServiceId,
  Pick<MarketingService, 'icon' | 'image'>
> = {
  color: {
    icon: 'palette',
    image: assetUrl(coloracionMagenta),
  },
  balayage: {
    icon: 'sun',
    image: assetUrl(mechasBalayage),
  },
  corte: {
    icon: 'scissors',
    image: assetUrl(balayageBob),
  },
  tratamiento: {
    icon: 'sparkle',
    image: assetUrl(balayageRizos),
  },
}

/** @deprecated Usar getMarketingServices(locale) desde src/i18n/helpers.ts */
export const marketingServices: MarketingService[] = Object.entries(marketingServiceAssets).map(
  ([id, assets]) => ({
    id: id as MarketingServiceId,
    ...assets,
    title: '',
    description: '',
    detail: '',
    imageAlt: '',
  }),
)
