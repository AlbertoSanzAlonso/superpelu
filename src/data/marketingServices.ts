import coloracionMagenta from '@/assets/gallery/coloracion-magenta-borgona-ondas-benalmadena.webp'
import mechasBalayage from '@/assets/gallery/mechas-balayage-rubio-ondas-benalmadena.webp'
import balayageBob from '@/assets/gallery/balayage-rubio-bob-liso-benalmadena.webp'
import balayageRizos from '@/assets/gallery/balayage-rubio-rizos-melena-benalmadena.webp'

function assetUrl(url: string): string {
  return url.startsWith('/') ? url : `/${url}`
}

export type MarketingService = {
  id: string
  title: string
  description: string
  detail: string
  icon: 'palette' | 'sun' | 'scissors' | 'sparkle'
  image: string
  imageAlt: string
}

export const marketingServices: MarketingService[] = [
  {
    id: 'color',
    title: 'Coloración profesional',
    description:
      'Especialistas en color capilar: rubios, morenos cálidos, corrección de color y resultados naturales y duraderos.',
    detail:
      'Analizamos tu base, salud del cabello y el resultado que buscas para proponerte la técnica más adecuada: tonos naturales, cobertura de canas, morenos cálidos o corrección de color. Trabajamos con productos profesionales para un acabado uniforme, luminoso y duradero, siempre con asesoramiento personalizado antes y después del servicio.',
    icon: 'palette',
    image: assetUrl(coloracionMagenta),
    imageAlt: 'Coloración profesional con ondas — Superpelu Benalmádena',
  },
  {
    id: 'balayage',
    title: 'Balayage y mechas',
    description:
      'Técnicas actuales como balayage, mechas y degradados luminosos adaptados a tu cabello y estilo.',
    detail:
      'El balayage y las mechas aportan luz y dimensión sin perder naturalidad. Diseñamos el patrón según tu corte, tono de piel y mantenimiento que prefieras: rubios miel, cenizas, caramelo o contrastes más marcados. Te explicamos cómo cuidar el color en casa para que el degradado se mantenga bonito el máximo tiempo posible.',
    icon: 'sun',
    image: assetUrl(mechasBalayage),
    imageAlt: 'Balayage y mechas rubio con ondas — Superpelu Benalmádena',
  },
  {
    id: 'corte',
    title: 'Corte y styling',
    description:
      'Cortes personalizados y acabados profesionales con asesoramiento adaptado a tus necesidades.',
    detail:
      'Desde un cambio de look hasta el mantenimiento de tu estilo habitual: cortes a medida, texturizado, brushing y acabados para el día a día o eventos. Te asesoramos sobre qué forma favorece tu rostro y cómo peinarlo en casa para que el resultado dure y sea fácil de llevar.',
    icon: 'scissors',
    image: assetUrl(balayageBob),
    imageAlt: 'Corte bob con balayage rubio — Superpelu Benalmádena',
  },
  {
    id: 'tratamiento',
    title: 'Tratamientos capilares',
    description:
      'Tratamientos reparadores, hidratación y cuidado del cabello con productos profesionales de alta calidad.',
    detail:
      'Recupera suavidad, brillo y fuerza con tratamientos de hidratación, nutrición o reparación según el estado de tu melena. Ideales después de procesos químicos, exposición al sol o cuando notas el cabello apagado o quebradizo. Combinamos diagnóstico y productos profesionales para notar el cambio desde la primera visita.',
    icon: 'sparkle',
    image: assetUrl(balayageRizos),
    imageAlt: 'Tratamiento y styling en melena rizada — Superpelu Benalmádena',
  },
]
