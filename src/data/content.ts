/** Datos de marca no traducibles (URLs, contacto, mapas). Textos de UI en src/i18n/translations.ts */
export const brand = {
  name: 'Superpelu',
  tagline: 'Hair Studio',
  location: 'Benalmádena · Arroyo de la Miel',
  phone: '952 443 686',
  phoneHref: 'tel:+34952443686',
  email: 'info@superpelubenalmadena.com',
  address: 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena, Málaga',
  bookingOnline: '/reservar',
  /** Agenda antigua BUK — fallback de reserva pública */
  bukBooking: 'https://buk.es/superpelu',
  maps: 'https://maps.app.goo.gl/G4HwQUpCtCCbq2xaA',
  /** iframe: requiere /maps/embed?pb=… (la URL con cid no se puede incrustar) */
  mapsEmbed:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3264.886635449141!2d-4.5329705!3d36.5892695!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd72fc7cabdda42b%3A0xde943290a140976e!2sSuper%20Pelu!5e0!3m2!1ses!2ses!4v1748340000000!5m2!1ses!2ses',
  instagram: 'https://www.instagram.com/superpelu_benalmadena/',
  facebook: 'https://www.facebook.com/superpelu.benalmadena/',
  tiktok: 'https://www.tiktok.com/@superpelu.benalmadena',
  website: 'https://superpelubenalmadena.es/',
} as const
