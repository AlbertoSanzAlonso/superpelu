import {
  isColorGroupWashRow,
  WASH_COLOR_SERVICE_ID,
} from '@/lib/bookingOccupancy'

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
  blue: {
    event: 'bg-[#3498DB]/20 border-[#3498DB]/50 border-l-4 border-l-[#3498DB] text-charcoal',
    swatch: 'bg-[#3498DB]/85 border-[#3498DB]',
  },
  red: {
    event: 'bg-[#C0392B]/18 border-[#C0392B]/45 border-l-4 border-l-[#C0392B] text-charcoal',
    swatch: 'bg-[#C0392B]/85 border-[#C0392B]',
  },
  teal: {
    event: 'bg-[#1ABC9C]/18 border-[#1ABC9C]/45 border-l-4 border-l-[#1ABC9C] text-charcoal',
    swatch: 'bg-[#1ABC9C]/85 border-[#1ABC9C]',
  },
  purple: {
    event: 'bg-[#9B59B6]/20 border-[#9B59B6]/50 border-l-4 border-l-[#9B59B6] text-charcoal',
    swatch: 'bg-[#9B59B6]/85 border-[#9B59B6]',
  },
  brown: {
    event: 'bg-[#D35400]/16 border-[#D35400]/45 border-l-4 border-l-[#D35400] text-charcoal',
    swatch: 'bg-[#D35400]/85 border-[#D35400]',
  },
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
  'beauty-hands-feet': 'teal',
  'beauty-facial': 'brown',
}

/** Excepciones por servicio (p. ej. matiz, maquillaje). */
const serviceColorKey: Record<string, AgendaColorKey> = {
  'svc-toner': 'teal',
  'svc-highlight-toner': 'purple',
  'svc-event-makeup': 'purple',
  'svc-micropigmentation': 'purple',
  'svc-micropigmentation-retouch': 'purple',
  'svc-antifrizz-treatment': 'brown',
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

export function appointmentEventClass(
  categoryId: string | null | undefined,
  serviceId?: string | null,
  colorGroupRole?: string | null,
): string {
  const key = resolveAgendaColorKey(categoryId, serviceId, colorGroupRole)
  const washAccent = isColorGroupWashRow(colorGroupRole) ? ' border-dashed' : ''
  return palettes[key].event + washAccent
}

/** Barra sólida en modal de detalle de cita (estilo BUK). */
export function appointmentBlockBarClass(
  categoryId: string | null | undefined,
  serviceId?: string | null,
  colorGroupRole?: string | null,
): string {
  const key = resolveAgendaColorKey(categoryId, serviceId, colorGroupRole)
  const bar: Record<AgendaColorKey, string> = {
    blue: 'bg-[#3498DB] text-white',
    red: 'bg-[#C0392B] text-white',
    teal: 'bg-[#1ABC9C] text-white',
    purple: 'bg-[#9B59B6] text-white',
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
  'beauty-hands-feet': palettes.teal.swatch,
  'beauty-facial': palettes.brown.swatch,
}

/** Leyenda compacta (grilla profesional). */
export const agendaColorLegend: { key: AgendaColorKey; label: string }[] = [
  { key: 'blue', label: 'Cortes' },
  { key: 'red', label: 'Color / decoloración' },
  { key: 'teal', label: 'Peinado · manos/pies · lavado' },
  { key: 'purple', label: 'Mechas · keratina · maquillaje' },
  { key: 'brown', label: 'Tratamientos · facial' },
]

export function agendaColorLegendSwatch(key: AgendaColorKey): string {
  return palettes[key].swatch
}
