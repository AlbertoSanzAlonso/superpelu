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

export type GalleryImage = {
  src: string
  alt: string
  /** Clases Tailwind extra en la celda (p. ej. imagen destacada). */
  span?: string
}

/** Vite devuelve rutas relativas (`images/...`); forzamos absolutas para cualquier ruta de la SPA. */
function assetUrl(url: string): string {
  return url.startsWith('/') ? url : `/${url}`
}

export const galleryImages: GalleryImage[] = [
  {
    src: assetUrl(peinadoBoda),
    alt: 'Peinados de boda con orquídeas para madre e hijas — Superpelu Benalmádena',
    span: 'sm:col-span-2 lg:col-span-2 lg:row-span-2',
  },
  {
    src: assetUrl(coloracionMagenta),
    alt: 'Coloración magenta borgoña con ondas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageBob),
    alt: 'Balayage rubio en bob liso — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageMelena),
    alt: 'Balayage rubio en melena con ondas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageSalon),
    alt: 'Balayage rubio con ondas en el salón — Superpelu Benalmádena',
  },
  {
    src: assetUrl(rubioPlatino),
    alt: 'Rubio platino con ondas y raíz difuminada — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageCeniza),
    alt: 'Balayage de rubio ceniza a dorado con ondas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(mechasBalayage),
    alt: 'Mechas balayage rubio con ondas suaves — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageMedio),
    alt: 'Balayage rubio en pelo medio con ondas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageMielLarga),
    alt: 'Balayage rubio miel en melena larga — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageMielPlaya),
    alt: 'Balayage rubio miel con ondas playeras — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageCaramelo),
    alt: 'Balayage caramelo con ondas voluminosas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageDorado),
    alt: 'Balayage rubio dorado en melena con ondas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(mechasDorado),
    alt: 'Mechas rubio dorado con ondas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(rubioCenizaLiso),
    alt: 'Rubio ceniza liso en melena — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageCrema),
    alt: 'Balayage rubio crema con ondas — Superpelu Benalmádena',
  },
  {
    src: assetUrl(balayageRizos),
    alt: 'Balayage rubio con rizos en melena — Superpelu Benalmádena',
  },
]
