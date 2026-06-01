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
}

function s(
  id: string,
  categoryId: ServiceCategoryId,
  nameEs: string,
  nameEn: string,
  durationMinutes: number,
  sortOrder: number,
  bookableOnline = true,
): SalonService {
  return { id, categoryId, nameEs, nameEn, durationMinutes, sortOrder, bookableOnline }
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
  s('svc-all-over-color', 'color', 'Color en todo el cabello', 'All-over hair color', 90, 3),
  s(
    'svc-color-block',
    'color',
    'Color Block',
    'Example: Nape in one color, rest of hair in another color',
    90,
    4,
  ),
  s('svc-toner', 'color', 'Matiz', 'Toner', 30, 5),

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
    'svc-all-over-bleaching',
    'bleaching',
    'Decoloración en todo el cabello',
    'All-over hair bleaching',
    120,
    2,
  ),
  s(
    'svc-partial-bleaching',
    'bleaching',
    'Decoloración parcial',
    'Partial Bleaching (e.g. nape, sideburns)',
    90,
    3,
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

  // ESTÉTICA MANOS Y PIES
  s('svc-manicure', 'beauty-hands-feet', 'Manicura', 'Manicure', 30, 0),
  s('svc-french-manicure', 'beauty-hands-feet', 'Manicura francesa', 'French Manicure', 40, 1),
  s(
    'svc-shellac-manicure',
    'beauty-hands-feet',
    'Manicura esmalte semipermanente',
    'Shellac Manicure',
    60,
    2,
  ),
  s(
    'svc-shellac-manicure-remove',
    'beauty-hands-feet',
    'Manicura semipermanente + retirado',
    'Shellac manicure with removal',
    90,
    3,
  ),
  s(
    'svc-regular-polish-hands',
    'beauty-hands-feet',
    'Pintar manos esmalte normal',
    'Regular nail polish — hands',
    15,
    4,
  ),
  s(
    'svc-shellac-remove',
    'beauty-hands-feet',
    'Retirado esmalte semipermanente',
    'Shellac Remove',
    20,
    5,
  ),
  s('svc-nails-decoration', 'beauty-hands-feet', 'Decoración de uñas', 'Nails Decoration', 15, 6),
  s(
    'svc-polygel-extensions',
    'beauty-hands-feet',
    'Extensión de uñas con POLYGEL',
    'POLYGEL nails extensions',
    150,
    7,
  ),
  s('svc-polygel-refill', 'beauty-hands-feet', 'Relleno de POLYGEL', 'POLYGEL refill', 120, 8),
  s(
    'svc-acrylic-polygel-remove',
    'beauty-hands-feet',
    'Retirado acrílico o POLYGEL',
    'Acrylic or POLYGEL remove',
    30,
    9,
  ),
  s('svc-pedicure', 'beauty-hands-feet', 'Pedicura tradicional', 'Pedicure', 60, 10),
  s(
    'svc-shellac-pedicure',
    'beauty-hands-feet',
    'Pedicura esmalte semipermanente',
    'Shellac Pedicure',
    90,
    11,
  ),
  s(
    'svc-regular-polish-feet',
    'beauty-hands-feet',
    'Pintar pies esmalte normal',
    'Regular nail polish — feet',
    15,
    12,
  ),
  s(
    'svc-regular-polish-hands-feet',
    'beauty-hands-feet',
    'Pintar manos y pies esmalte normal',
    'Regular nail polish — hands and feet',
    30,
    13,
  ),

  // ESTÉTICA FACIAL
  s('svc-eyebrow-wax', 'beauty-facial', 'Depilación de cejas', 'Eyebrow Waxing', 15, 0),
  s('svc-upper-lip-wax', 'beauty-facial', 'Depilación labio superior', 'Upper Lip Waxing', 10, 1),
  s('svc-eyebrow-tint', 'beauty-facial', 'Tinte de cejas', 'Eyebrow Tint', 20, 2),
  s('svc-eyelash-tint', 'beauty-facial', 'Tinte de pestañas', 'Eyelash Tint', 30, 3),
  s(
    'svc-eyelash-lift',
    'beauty-facial',
    'Lifting de pestañas',
    'Eyelash Lift (eyelash tint included)',
    90,
    4,
  ),
  s('svc-eyebrow-lamination', 'beauty-facial', 'Laminado de cejas', 'Eyebrow Lamination', 60, 5),
  s(
    'svc-facial-cleansing',
    'beauty-facial',
    'Ritual limpieza de cutis profunda',
    'Facial Cleansing',
    90,
    6,
  ),
  s(
    'svc-antiage-galvanic',
    'beauty-facial',
    'Limpieza de cutis ANTIAGE con GALVÁNICA',
    'ANTIAGE complexion cleansing with Galvanic spa',
    60,
    7,
  ),
  s(
    'svc-dermapen-antioxidant',
    'beauty-facial',
    'Tratamiento antioxidante con DERMAPEN',
    'Antioxidant Treatment with DERMAPEN',
    90,
    8,
  ),
  s('svc-event-makeup', 'beauty-facial', 'Maquillaje de eventos', 'Event Makeup', 90, 9),
  s('svc-micropigmentation', 'beauty-facial', 'Micropigmentación', 'Micropigmentation', 150, 10),
  s(
    'svc-micropigmentation-retouch',
    'beauty-facial',
    'Retoque micro',
    'Micropigmentation retouch',
    90,
    11,
  ),
  s('svc-antifrizz-treatment', 'beauty-facial', 'Tratamiento AntiFRIZZ', 'Anti-frizz Treatment', 90, 12),
]

export const salonServiceIds = new Set(salonServices.map((svc) => svc.id))
