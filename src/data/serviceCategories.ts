/**
 * Categorías de servicios del salón (español + inglés).
 * Precios «desde» según tarifa del salón (mayo 2026).
 */
export const serviceCategories = [
  {
    id: 'gentleman-haircut',
    nameEs: 'CORTE DE CABALLERO',
    nameEn: 'GENTLEMAN HAIRCUT',
    sortOrder: 0,
    priceFromEur: 14,
  },
  {
    id: 'color',
    nameEs: 'COLOR',
    nameEn: 'COLOR',
    sortOrder: 1,
    priceFromEur: 29,
    priceNote:
      'Una reserva: 30 min color, 30 min pausa y 30 min lavado. Color completo desde 35€',
  },
  {
    id: 'highlights',
    nameEs: 'MECHAS',
    nameEn: 'HIGHLIGHTS',
    sortOrder: 2,
    priceFromEur: 60,
    priceNote: 'Mechas clásicas · Babylights desde 80€ · Balayage desde 90€ (matiz no incluido)',
  },
  {
    id: 'bleaching',
    nameEs: 'DECOLORACION',
    nameEn: 'BLEACHING',
    sortOrder: 3,
  },
  {
    id: 'haircut-blowdry',
    nameEs: 'CORTE Y PEINADO',
    nameEn: 'HAIRCUT & BLOWDRY / BRUSHING',
    sortOrder: 4,
    priceFromEur: 18,
    priceNote: 'Lavar y cortar',
  },
  {
    id: 'haircut',
    nameEs: 'CORTE',
    nameEn: 'HAIRCUT',
    sortOrder: 5,
  },
  {
    id: 'blowdry',
    nameEs: 'PEINADO',
    nameEn: 'BLOWDRY / BRUSHING',
    sortOrder: 6,
    priceFromEur: 17,
    priceNote: 'Lavar y peinar: cabello medio 20€ · largo 24€',
  },
  {
    id: 'perm',
    nameEs: 'PERMANENTE',
    nameEn: 'PERM',
    sortOrder: 7,
    priceFromEur: 60,
  },
  {
    id: 'keratin',
    nameEs: 'ALISADO DE KERATINA',
    nameEn: 'KERATIN TREATMENT',
    sortOrder: 8,
    priceNote: 'Consultar precio (alisado brasileño)',
  },
  {
    id: 'hair-treatments',
    nameEs: 'TRATAMIENTOS CAPILARES',
    nameEn: 'HAIR TREATMENTS',
    sortOrder: 9,
  },
  {
    id: 'beauty-waxing',
    nameEs: 'DEPILACIÓN FACIAL Y CORPORAL',
    nameEn: 'FACIAL AND BODY WAXING',
    sortOrder: 10,
  },
  {
    id: 'beauty-hands-feet',
    nameEs: 'BELLEZA DE MANOS Y PIES',
    nameEn: 'HANDS AND FEET BEAUTY',
    sortOrder: 11,
  },
  {
    id: 'beauty-facial',
    nameEs: 'TRATAMIENTOS FACIALES',
    nameEn: 'FACIAL TREATMENTS',
    sortOrder: 12,
  },
  {
    id: 'beauty-eyes',
    nameEs: 'REJUVENECE TU MIRADA',
    nameEn: 'REJUVENATE YOUR GAZE',
    sortOrder: 13,
  },
] as const

export type ServiceCategoryId = (typeof serviceCategories)[number]['id']

export type ServiceCategorySeed = (typeof serviceCategories)[number]

/** Convierte euros enteros a céntimos para SQLite (null si no hay precio). */
export function priceEurToCents(eur: number | undefined): number | null {
  if (eur === undefined) return null
  return Math.round(eur * 100)
}
