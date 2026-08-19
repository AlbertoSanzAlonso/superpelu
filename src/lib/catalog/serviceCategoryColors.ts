import {
  isColorGroupWashRow,
  WASH_COLOR_SERVICE_ID,
} from '@/lib/booking/occupancy'
import { APPOINTMENT_STATUS_NO_SHOW } from '@/lib/agenda/noShow'

/**
 * Colores de citas en agenda — alineados con la app anterior (BUK).
 *
 * Azul: cortes · Rojo: coloración/decoloración · Verde agua: peinado, lavado suelto, manos/pies, matiz
 * Morado: mechas, keratina, permanente, maquillaje/micro · Marrón: tratamientos capilares y facial
 *
 * Lavado enlazado a coloración (color_group_role wash): mismo rojo que la color, borde discontinuo + icono.
 */

export type AgendaColorKey = 'blue' | 'red' | 'teal' | 'purple' | 'brown' | 'maroon'

type Palette = {
  event: string
  swatch: string
}

const palettes: Record<AgendaColorKey, Palette> = {
  // Azul rey — cortes
  blue: {
    event: 'bg-[#1A6FBF]/20 border-[#1A6FBF]/50 border-l-4 border-l-[#1A6FBF] text-charcoal',
    swatch: 'bg-[#1A6FBF]/85 border-[#1A6FBF]',
  },
  // Rojo vivo — color / decoloración
  red: {
    event: 'bg-[#E8232A]/18 border-[#E8232A]/45 border-l-4 border-l-[#E8232A] text-charcoal',
    swatch: 'bg-[#E8232A]/85 border-[#E8232A]',
  },
  // Verde esmeralda — peinado / manos-pies / lavado
  teal: {
    event: 'bg-[#00A86B]/18 border-[#00A86B]/45 border-l-4 border-l-[#00A86B] text-charcoal',
    swatch: 'bg-[#00A86B]/85 border-[#00A86B]',
  },
  // Violeta oscuro — mechas / keratina / mirada
  purple: {
    event: 'bg-[#6B21A8]/20 border-[#6B21A8]/50 border-l-4 border-l-[#6B21A8] text-charcoal',
    swatch: 'bg-[#6B21A8]/85 border-[#6B21A8]',
  },
  // Naranja — tratamientos / depilación
  brown: {
    event: 'bg-[#D35400]/16 border-[#D35400]/45 border-l-4 border-l-[#D35400] text-charcoal',
    swatch: 'bg-[#D35400]/85 border-[#D35400]',
  },
  // Granate — variante oscura (heredada)
  maroon: {
    event: 'bg-[#922B21]/18 border-[#922B21]/45 border-l-4 border-l-[#922B21] text-charcoal',
    swatch: 'bg-[#922B21]/85 border-[#922B21]',
  },
}

const categoryColorKey: Record<string, AgendaColorKey> = {
  'gentleman-haircut': 'blue',
  haircut: 'blue',
  'haircut-blowdry': 'blue',
  color: 'red',
  bleaching: 'red',
  highlights: 'purple',
  blowdry: 'teal',
  perm: 'purple',
  keratin: 'purple',
  'hair-treatments': 'brown',
  'beauty-waxing': 'brown',
  'beauty-hands-feet': 'teal',
  'beauty-facial': 'brown',
  'beauty-eyes': 'purple',
}

/** Excepciones por servicio (p. ej. matiz, maquillaje). */
const serviceColorKey: Record<string, AgendaColorKey> = {
  'svc-toner': 'teal',
  'svc-highlight-toner': 'purple',
}

const defaultKey: AgendaColorKey = 'teal'
const blockStyle = 'bg-charcoal/5 border-charcoal/20 border-l-4 border-l-charcoal/30 text-charcoal-muted'

export function resolveAgendaColorKey(
  categoryId: string | null | undefined,
  serviceId?: string | null,
  colorGroupRole?: string | null,
): AgendaColorKey {
  if (serviceId === WASH_COLOR_SERVICE_ID) {
    if (isColorGroupWashRow(colorGroupRole)) {
      return categoryColorKey.color ?? 'red'
    }
    return 'teal'
  }
  if (serviceId && serviceColorKey[serviceId]) {
    return serviceColorKey[serviceId]
  }
  if (categoryId && categoryColorKey[categoryId]) {
    return categoryColorKey[categoryId]
  }
  return defaultKey
}

export function appointmentNoShowModifier(status?: string | null): string {
  return status === APPOINTMENT_STATUS_NO_SHOW ? ' opacity-55 ring-1 ring-inset ring-charcoal/25' : ''
}

export function appointmentEventClass(
  categoryId: string | null | undefined,
  serviceId?: string | null,
  colorGroupRole?: string | null,
  appointmentStatus?: string | null,
): string {
  const key = resolveAgendaColorKey(categoryId, serviceId, colorGroupRole)
  const washAccent = isColorGroupWashRow(colorGroupRole) ? ' border-dashed' : ''
  return palettes[key].event + washAccent + appointmentNoShowModifier(appointmentStatus)
}

/** Barra sólida en modal de detalle de cita (estilo BUK). */
export function appointmentBlockBarClass(
  categoryId: string | null | undefined,
  serviceId?: string | null,
  colorGroupRole?: string | null,
): string {
  const key = resolveAgendaColorKey(categoryId, serviceId, colorGroupRole)
  const bar: Record<AgendaColorKey, string> = {
    blue: 'bg-[#1A6FBF] text-white',
    red: 'bg-[#E8232A] text-white',
    teal: 'bg-[#00A86B] text-white',
    purple: 'bg-[#6B21A8] text-white',
    brown: 'bg-[#D35400] text-white',
    maroon: 'bg-[#922B21] text-white',
  }
  return bar[key]
}

/** @deprecated Usar appointmentEventClass con serviceId cuando exista. */
export function categoryEventClass(categoryId: string | null | undefined): string {
  return appointmentEventClass(categoryId)
}

export function blockEventClass(): string {
  return blockStyle
}

export function agendaLegendSwatchClass(
  categoryId: string | null | undefined,
  serviceId?: string | null,
  colorGroupRole?: string | null,
): string {
  const key = resolveAgendaColorKey(categoryId, serviceId, colorGroupRole)
  return palettes[key].swatch
}

/** Leyenda admin: una muestra por categoría del catálogo. */
export const categoryLegendSwatch: Record<string, string> = {
  'gentleman-haircut': palettes.blue.swatch,
  color: palettes.red.swatch,
  highlights: palettes.purple.swatch,
  bleaching: palettes.red.swatch,
  'haircut-blowdry': palettes.blue.swatch,
  haircut: palettes.blue.swatch,
  blowdry: palettes.teal.swatch,
  perm: palettes.purple.swatch,
  keratin: palettes.purple.swatch,
  'hair-treatments': palettes.brown.swatch,
  'beauty-waxing': palettes.brown.swatch,
  'beauty-hands-feet': palettes.teal.swatch,
  'beauty-facial': palettes.brown.swatch,
  'beauty-eyes': palettes.purple.swatch,
}

/** Leyenda compacta (grilla profesional). */
export const agendaColorLegend: { key: AgendaColorKey; label: string }[] = [
  { key: 'blue', label: 'Cortes' },
  { key: 'red', label: 'Color / decoloración' },
  { key: 'teal', label: 'Peinado · manos/pies · lavado' },
  { key: 'purple', label: 'Mechas · keratina · mirada' },
  { key: 'brown', label: 'Tratamientos · depilación' },
]

export function agendaColorLegendSwatch(key: AgendaColorKey): string {
  return palettes[key].swatch
}
