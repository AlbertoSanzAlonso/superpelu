import type { ServiceCategoryId } from './serviceCategories'

export type SalonService = {
  id: string
  categoryId: ServiceCategoryId
  nameEs: string
  nameEn: string
  durationMinutes: number
  sortOrder: number
  /** Si es false, no aparece en reserva online (p. ej. mechas solo por teléfono). */
  bookableOnline?: boolean
  /** Si es false, no se muestra duración en /reservar (pendiente de confirmar en tarifa). */
  showDurationInBooking?: boolean
}

function s(
  id: string,
  categoryId: ServiceCategoryId,
  nameEs: string,
  nameEn: string,
  durationMinutes: number,
  sortOrder: number,
  bookableOnline = true,
  showDurationInBooking = true,
): SalonService {
  return {
    id,
    categoryId,
    nameEs,
    nameEn,
    durationMinutes,
    sortOrder,
    bookableOnline,
    showDurationInBooking,
  }
}

export const salonServices: SalonService[] = [
  // CORTE DE CABALLERO
  s('svc-gentleman-haircut', 'gentleman-haircut', 'Corte de caballero', 'Gentleman haircut', 30, 0),
  s('svc-boys-haircut', 'gentleman-haircut', 'Corte de NIÑO', 'Boys Haircut', 30, 1),

  // COLOR
  /** Solo agenda (pareja con coloración); no reservable online. */
  s('svc-wash-color', 'color', 'LAVAR COLOR', 'WASH COLOR', 20, 0, false),
  /** 90 min en agenda: 30 color + 30 pausa + 30 lavado/acabado (ver bookingOccupancy). */
  s('svc-root-color', 'color', 'Color en raíz', 'Root Color', 90, 1),
  s('svc-complete-color', 'color', 'Color completo', 'Complete Color', 90, 2),
  s(
    'svc-color-block',
    'color',
    'Color Block',
    'Color Block',
    90,
    3,
  ),
  s('svc-toner', 'color', 'Matiz', 'Toner', 30, 4),

  // MECHAS (reserva online solo teléfono/WhatsApp para paquetes; admin puede citar)
  s(
    'svc-classic-highlights',
    'highlights',
    'Mechas clásicas',
    'Classic Highlights',
    120,
    0,
    false,
  ),
  s('svc-balayage', 'highlights', 'Balayage', 'Balayage', 180, 1, false),
  s('svc-babylights', 'highlights', 'Babylights', 'Babylights', 180, 2, false),
  s('svc-cap-highlights', 'highlights', 'Mechas con gorro', 'Cap Highlights', 60, 3, false),
  s('svc-highlight-toner', 'highlights', 'Matizar mechas', 'Highlights toner', 30, 4, false),

  // DECOLORACION
  s('svc-root-bleaching', 'bleaching', 'Decoloración en raíz', 'Root Bleaching', 105, 0),
  s('svc-global-bleaching', 'bleaching', 'Decoloración global', 'Complete Bleaching', 120, 1),
  s(
    'svc-partial-bleaching',
    'bleaching',
    'Decoloración parcial',
    'Partial Bleaching (e.g. nape, sideburns)',
    90,
    2,
  ),

  // CORTE Y PEINADO
  s(
    'svc-haircut-blowdry-short',
    'haircut-blowdry',
    'Corte y peinado cabello CORTO',
    'Haircut & blowdry Short Hair (nape length)',
    60,
    0,
  ),
  s(
    'svc-haircut-blowdry-medium',
    'haircut-blowdry',
    'Corte y peinado cabello MEDIO',
    'Haircut & blowdry Medium Hair (shoulder length)',
    60,
    1,
  ),
  s(
    'svc-haircut-blowdry-long',
    'haircut-blowdry',
    'Corte y peinado cabello LARGO',
    'Haircut & blowdry Long Hair (below shoulders)',
    75,
    2,
  ),
  s(
    'svc-haircut-blowdry-diffuser',
    'haircut-blowdry',
    'Corte y peinado con difusor',
    'Haircut and diffuser styled hair (curly result)',
    50,
    3,
  ),
  s(
    'svc-haircut-blowdry-waves',
    'haircut-blowdry',
    'Corte y peinado CON ONDAS',
    'Haircut and wavy style',
    90,
    4,
  ),

  // CORTE
  s('svc-haircut-short', 'haircut', 'Corte de cabello CORTO', 'Haircut Short Hair (nape length)', 30, 0),
  s(
    'svc-haircut-medium',
    'haircut',
    'Corte de cabello MEDIO',
    'Haircut Medium Hair (shoulder length)',
    30,
    1,
  ),
  s(
    'svc-haircut-long',
    'haircut',
    'Corte de cabello LARGO',
    'Haircut Long Hair (below shoulders)',
    30,
    2,
  ),
  s(
    'svc-haircut-extra-long',
    'haircut',
    'Corte de cabello EXTRA LARGO',
    'Haircut Extra Long Hair (mid back or longer)',
    30,
    3,
  ),
  s('svc-girls-haircut', 'haircut', 'Corte de NIÑA', 'Girls Haircut', 30, 4),

  // PEINADO
  s('svc-blowdry-short', 'blowdry', 'Peinado de cabello CORTO', 'Blowdry Short Hair (nape length)', 30, 0),
  s('svc-blowdry-medium', 'blowdry', 'Peinado de cabello MEDIO', 'Blowdry Medium Hair', 30, 1),
  s(
    'svc-blowdry-long',
    'blowdry',
    'Peinado de cabello LARGO',
    'Blowdry Long Hair (below shoulders)',
    45,
    2,
  ),
  s(
    'svc-blowdry-extra-long',
    'blowdry',
    'Peinado de cabello EXTRA LARGO',
    'Blowdry Extra Long Hair (mid back or longer)',
    60,
    3,
  ),
  s('svc-blowdry-waves', 'blowdry', 'Peinado CON ONDAS', 'Wavy Hairstyle', 60, 4),
  s(
    'svc-blowdry-diffuser',
    'blowdry',
    'Peinado CON DIFUSOR',
    'Diffuser-styled hair (for curly hair)',
    30,
    5,
  ),
  s('svc-blowdry-straightener', 'blowdry', 'Peinado con PLANCHA', 'Straightening', 45, 6),
  s('svc-half-up', 'blowdry', 'Semi recogido', 'Half-up Hairstyle', 60, 7),
  s('svc-upstyle', 'blowdry', 'Recogido', 'Upstyle', 90, 8),

  // PERMANENTE
  s('svc-perm-short', 'perm', 'Permanente en cabello CORTO', 'Perm Short Hair', 90, 0),
  s('svc-perm-medium', 'perm', 'Permanente en cabello MEDIO', 'Perm Medium Hair', 120, 1),
  s('svc-perm-long', 'perm', 'Permanente en cabello LARGO', 'Perm Long Hair', 120, 2),

  // ALISADO DE KERATINA
  s(
    'svc-keratin-short',
    'keratin',
    'Alisado en cabello CORTO',
    'Keratin Treatment Short Hair',
    180,
    0,
  ),
  s(
    'svc-keratin-medium',
    'keratin',
    'Alisado en cabello MEDIO',
    'Keratin Treatment Medium Hair',
    210,
    1,
  ),
  s('svc-keratin-long', 'keratin', 'Alisado en cabello LARGO', 'Keratin Treatment Long Hair', 240, 2),

  // TRATAMIENTOS CAPILARES
  s(
    'svc-treatment-nourishing',
    'hair-treatments',
    'Tratamiento de nutrición',
    'Nourishing Treatment',
    30,
    0,
  ),
  s(
    'svc-treatment-hydrating',
    'hair-treatments',
    'Tratamiento de hidratación',
    'Hydrating Treatment',
    30,
    1,
  ),
  s(
    'svc-treatment-repair',
    'hair-treatments',
    'Tratamiento de reparación o reconstrucción',
    'Repair or Reconstruction Treatment',
    30,
    2,
  ),

  // DEPILACIÓN FACIAL Y CORPORAL
  s('svc-wax-eyebrows', 'beauty-waxing', 'Cejas', 'Eyebrows', 30, 0, true, false),
  s('svc-wax-upper-lip', 'beauty-waxing', 'Labio superior', 'Upper lip', 30, 1, true, false),
  s('svc-wax-chin', 'beauty-waxing', 'Mentón', 'Chin', 30, 2, true, false),
  s('svc-wax-underarms', 'beauty-waxing', 'Axilas', 'Underarms', 30, 3, true, false),
  s('svc-wax-arms', 'beauty-waxing', 'Brazos', 'Arms', 30, 4, true, false),
  s('svc-wax-bikini', 'beauty-waxing', 'Bikini', 'Bikini', 30, 5, true, false),
  s('svc-wax-bikini-brazilian', 'beauty-waxing', 'Bikini brasileño', 'Brazilian bikini', 30, 6, true, false),
  s('svc-wax-full-pubis', 'beauty-waxing', 'Pubis completo', 'Full pubis', 30, 7, true, false),
  s('svc-wax-half-legs', 'beauty-waxing', 'Medias piernas', 'Half legs', 30, 8, true, false),
  s('svc-wax-full-legs', 'beauty-waxing', 'Piernas completas', 'Full legs', 30, 9, true, false),

  // BELLEZA DE MANOS Y PIES
  s('svc-manicure', 'beauty-hands-feet', 'Manicura', 'Manicure', 30, 0),
  s(
    'svc-shellac-manicure',
    'beauty-hands-feet',
    'Manicura semipermanente',
    'Semi-permanent manicure',
    60,
    1,
  ),
  s('svc-gel-refill', 'beauty-hands-feet', 'Refuerzo de gel', 'Gel refill', 60, 2),
  s('svc-nail-extensions', 'beauty-hands-feet', 'Extensión de uñas', 'Nail extensions', 120, 3),
  s(
    'svc-pedicure-spa',
    'beauty-hands-feet',
    'Pedicura spa completa',
    'Full spa pedicure',
    60,
    4,
  ),
  s(
    'svc-pedicure-spa-shellac',
    'beauty-hands-feet',
    'Pedicura spa semipermanente',
    'Spa pedicure with semi-permanent polish',
    90,
    5,
  ),
  s(
    'svc-shellac-remove',
    'beauty-hands-feet',
    'Retirado esmalte semipermanente',
    'Semi-permanent polish removal',
    30,
    6,
  ),

  // TRATAMIENTOS FACIALES
  s('svc-facial-deep-cleansing', 'beauty-facial', 'Limpieza profunda', 'Deep cleansing', 30, 0, true, false),
  s(
    'svc-facial-deep-cleansing-vitamins',
    'beauty-facial',
    'Limpieza profunda con vitaminas',
    'Deep cleansing with vitamins',
    30,
    1,
    true,
    false,
  ),
  s(
    'svc-facial-deep-cleansing-rf',
    'beauty-facial',
    'Limpieza profunda con radiofrecuencia',
    'Deep cleansing with radiofrequency',
    30,
    2,
    true,
    false,
  ),

  // REJUVENECE TU MIRADA
  s('svc-eyebrow-tint', 'beauty-eyes', 'Tinte de cejas', 'Eyebrow tint', 30, 0, true, false),
  s('svc-eyelash-tint', 'beauty-eyes', 'Tinte de pestañas', 'Eyelash tint', 30, 1, true, false),
  s('svc-eyelash-lift', 'beauty-eyes', 'Lifting de pestañas', 'Eyelash lift', 30, 2, true, false),
]

export const salonServiceIds = new Set(salonServices.map((svc) => svc.id))

export const salonServiceById = new Map(salonServices.map((svc) => [svc.id, svc]))
