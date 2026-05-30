import peinadoBoda from '@/assets/gallery/peinado-boda-orquideas-madre-hijas-benalmadena.webp'
import coloracionMagenta from '@/assets/gallery/coloracion-magenta-borgona-ondas-benalmadena.webp'
import balayageBob from '@/assets/gallery/balayage-rubio-bob-liso-benalmadena.webp'
import balayageMelena from '@/assets/gallery/balayage-rubio-melena-ondas-benalmadena.webp'
import balayageSalon from '@/assets/gallery/balayage-rubio-ondas-salon-benalmadena.webp'
import rubioPlatino from '@/assets/gallery/rubio-platino-ondas-raiz-difuminada-benalmadena.webp'
import balayageCeniza from '@/assets/gallery/balayage-rubio-ceniza-ondas-benalmadena.webp'
import mechasBalayage from '@/assets/gallery/mechas-balayage-rubio-ondas-benalmadena.webp'
import balayageMedio from '@/assets/gallery/balayage-rubio-medio-ondas-benalmadena.webp'
import balayageMielLarga from '@/assets/gallery/balayage-rubio-miel-melena-larga-benalmadena.webp'
import balayageMielPlaya from '@/assets/gallery/balayage-rubio-miel-ondas-playa-benalmadena.webp'
import balayageCaramelo from '@/assets/gallery/balayage-caramelo-ondas-benalmadena.webp'
import balayageDorado from '@/assets/gallery/balayage-rubio-dorado-melena-ondas-benalmadena.webp'
import mechasDorado from '@/assets/gallery/mechas-rubio-dorado-ondas-benalmadena.webp'
import rubioCenizaLiso from '@/assets/gallery/rubio-ceniza-liso-melena-benalmadena.webp'
import balayageCrema from '@/assets/gallery/balayage-rubio-crema-ondas-benalmadena.webp'
import balayageRizos from '@/assets/gallery/balayage-rubio-rizos-melena-benalmadena.webp'

export type GalleryImageId =
  | 'peinadoBoda'
  | 'coloracionMagenta'
  | 'balayageBob'
  | 'balayageMelena'
  | 'balayageSalon'
  | 'rubioPlatino'
  | 'balayageCeniza'
  | 'mechasBalayage'
  | 'balayageMedio'
  | 'balayageMielLarga'
  | 'balayageMielPlaya'
  | 'balayageCaramelo'
  | 'balayageDorado'
  | 'mechasDorado'
  | 'rubioCenizaLiso'
  | 'balayageCrema'
  | 'balayageRizos'

export type GalleryImage = {
  id: GalleryImageId
  src: string
  alt: string
  /** Clases Tailwind extra en la celda (p. ej. imagen destacada). */
  span?: string
}

/** Vite devuelve rutas relativas (`images/...`); forzamos absolutas para cualquier ruta de la SPA. */
function assetUrl(url: string): string {
  return url.startsWith('/') ? url : `/${url}`
}

/** Recursos estáticos; textos alt en src/i18n/translations.ts → gallery.alts */
export const galleryImageAssets: Omit<GalleryImage, 'alt'>[] = [
  {
    id: 'peinadoBoda',
    src: assetUrl(peinadoBoda),
    span: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
  },
  { id: 'coloracionMagenta', src: assetUrl(coloracionMagenta) },
  { id: 'balayageBob', src: assetUrl(balayageBob) },
  { id: 'balayageMelena', src: assetUrl(balayageMelena) },
  { id: 'balayageSalon', src: assetUrl(balayageSalon) },
  { id: 'rubioPlatino', src: assetUrl(rubioPlatino) },
  { id: 'balayageCeniza', src: assetUrl(balayageCeniza) },
  { id: 'mechasBalayage', src: assetUrl(mechasBalayage) },
  { id: 'balayageMedio', src: assetUrl(balayageMedio) },
  { id: 'balayageMielLarga', src: assetUrl(balayageMielLarga) },
  { id: 'balayageMielPlaya', src: assetUrl(balayageMielPlaya) },
  { id: 'balayageCaramelo', src: assetUrl(balayageCaramelo) },
  { id: 'balayageDorado', src: assetUrl(balayageDorado) },
  { id: 'mechasDorado', src: assetUrl(mechasDorado) },
  { id: 'rubioCenizaLiso', src: assetUrl(rubioCenizaLiso) },
  { id: 'balayageCrema', src: assetUrl(balayageCrema) },
  { id: 'balayageRizos', src: assetUrl(balayageRizos) },
]

/** @deprecated Usar getGalleryImages(locale) desde src/i18n/helpers.ts */
export const galleryImages: GalleryImage[] = galleryImageAssets.map((item) => ({
  ...item,
  alt: '',
}))
