export const brand = {
  name: 'Superpelu',
  tagline: 'Hair Studio',
  location: 'Benalmádena · Arroyo de la Miel',
  phone: '952 443 686',
  phoneHref: 'tel:+34952443686',
  email: 'info@superpelubenalmadena.com',
  address: 'Av. las Palmeras, 8, Local 18, 29630 Benalmádena, Málaga',
  whatsapp:
    'https://wa.me/34604808312?text=Hola%2C+quiero+reservar+una+cita+en+SuperPelu+Benalm%C3%A1dena',
  bookingOnline: '/reservar',
  maps: 'https://maps.app.goo.gl/G4HwQUpCtCCbq2xaA',
  /** iframe: requiere /maps/embed?pb=… (la URL con cid no se puede incrustar) */
  mapsEmbed:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3264.886635449141!2d-4.5329705!3d36.5892695!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd72fc7cabdda42b%3A0xde943290a140976e!2sSuper%20Pelu!5e0!3m2!1ses!2ses!4v1748340000000!5m2!1ses!2ses',
  instagram: 'https://www.instagram.com/superpelu_benalmadena/',
  facebook: 'https://www.facebook.com/superpelu.benalmadena/',
  tiktok: 'https://www.tiktok.com/@superpelu.benalmadena',
  website: 'https://superpelubenalmadena.es/',
} as const

export const navLinks = [
  { href: '/#servicios', label: 'Servicios' },
  { href: '/salon', label: 'El salón' },
  { href: '/#galeria', label: 'Galería' },
  { href: '/#contacto', label: 'Contacto' },
] as const

export const hero = {
  lead:
    'Peluquería en Benalmádena especialista en color y estética. Servicios profesionales con experiencia, innovación y atención personalizada.',
  body:
    'En Super Pelu Hair Studio te ayudamos a cuidar tu imagen con tratamientos capilares, técnicas de coloración avanzada y servicios adaptados a cada cliente. Trabajamos con productos profesionales para resultados naturales, duraderos y a tu estilo.',
} as const

export const servicesSection = {
  eyebrow: 'Nuestros servicios',
  scriptAccent: 'Servicios',
  title: 'Peluquería y estética a tu medida',
  subtitle:
    'Coloración profesional, cortes personalizados y tratamientos capilares con las últimas tendencias del sector.',
} as const

export const studioSection = {
  eyebrow: 'Tu salón en Benalmádena',
  scriptAccent: 'El salón',
  title: 'Peluquería y estética en Arroyo de la Miel',
  subtitle:
    'Un ambiente moderno, cercano y profesional donde cada cliente recibe asesoramiento adaptado a sus necesidades.',
  intro:
    'Super Pelu Benalmádena es un centro especializado en el cuidado del cabello y la imagen personal. Nuestro equipo cuenta con experiencia en coloración profesional, cortes personalizados y tratamientos capilares.',
  team:
    'Profesionales con experiencia en peluquería, estética y tratamientos capilares. Nos mantenemos en constante formación para ofrecer las últimas tendencias y técnicas del sector.',
} as const

export const highlights = [
  'Profesionales especialistas en coloración capilar',
  'Técnicas actuales: balayage, mechas y corrección de color',
  'Productos profesionales de alta calidad',
  'Atención personalizada y asesoramiento estético',
  'Ambiente cómodo y moderno',
] as const

export const gallerySection = {
  eyebrow: 'Nuestra galería',
  scriptAccent: 'Galería',
  title: 'Resultados reales en coloración y cuidado capilar',
  subtitle:
    'Trabajos personalizados adaptados al estilo y las características del cabello de cada cliente. Nuestra especialidad es la coloración profesional.',
} as const

export const testimonialsSection = {
  eyebrow: 'Opiniones',
  scriptAccent: 'Clientes',
  title: 'Lo que dicen de nosotros',
  subtitle:
    'La satisfacción de nuestros clientes avala la calidad de nuestros servicios de peluquería y estética.',
} as const

export const testimonials = [
  {
    id: 'inmaculada',
    name: 'Inmaculada Fernández',
    quote:
      'No puedo estar más contenta con todo el equipo de súper pelu. El trato es buenísimo y el asesoramiento sincero: te aconsejan lo que es mejor para ti. Son cercanas y una maravilla de profesionales. Gracias Olga por dejar a mi madre tan bonita. Repetiremos siempre.',
    rating: 5,
  },
  {
    id: 'clara',
    name: 'Clara',
    quote:
      'Probé muchos lugares desde Málaga hasta Marbella antes de encontrarlos. El mejor peluquería, complementando el servicio con el mejor asesoramiento y productos. Gracias Susana por siempre hacer un excelente trabajo.',
    rating: 5,
  },
] as const

export const contactSection = {
  eyebrow: 'Reserva tu cita',
  scriptAccent: 'Contacto',
  title: 'Peluquería cerca de ti en Benalmádena',
  subtitle:
    'Reserva online, llámanos o escríbenos por WhatsApp. Estamos en Av. las Palmeras, Arroyo de la Miel.',
} as const

export const bookingOptions = [
  {
    id: 'online',
    title: 'Reserva online',
    description: 'Reserva en nuestra agenda online: elige servicio, día y hora.',
    href: brand.bookingOnline,
    label: 'Reservar cita online',
  },
  {
    id: 'phone',
    title: 'Llámanos',
    description: 'Habla con nosotros y te ayudamos a concertar tu cita.',
    href: brand.phoneHref,
    label: `Llamar al ${brand.phone}`,
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp directo',
    description: 'Escríbenos y te respondemos lo antes posible.',
    href: brand.whatsapp,
    label: 'Escribir por WhatsApp',
  },
] as const

export const footerLegal = [
  { href: '/politica-de-cookies', label: 'Política de cookies' },
] as const
