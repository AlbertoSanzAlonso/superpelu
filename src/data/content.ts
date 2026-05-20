export const brand = {
  name: 'Superpelu',
  tagline: 'Hair Studio',
  phone: '+34 600 000 000',
  email: 'hola@superpelu.com',
  address: 'Tu calle, tu ciudad',
  whatsapp: 'https://wa.me/34600000000',
} as const

export const navLinks = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#estudio', label: 'Estudio' },
  { href: '#galeria', label: 'Galería' },
  { href: '#contacto', label: 'Contacto' },
] as const

export const services = [
  {
    id: 'corte',
    title: 'Corte & Styling',
    description:
      'Cortes de precisión y acabados que realzan tu estilo personal con técnicas actuales.',
    icon: 'scissors',
  },
  {
    id: 'color',
    title: 'Coloración',
    description:
      'Desde rubios miel hasta morenos cálidos. Color personalizado con productos de alta gama.',
    icon: 'palette',
  },
  {
    id: 'balayage',
    title: 'Balayage & Mechas',
    description:
      'Degradados naturales y luminosidad suave, como en nuestras piezas de referencia.',
    icon: 'sun',
  },
  {
    id: 'tratamiento',
    title: 'Tratamientos',
    description:
      'Hidratación, brillo y reparación profunda para un cabello sano y radiante.',
    icon: 'sparkle',
  },
] as const

export const highlights = [
  'Ambiente íntimo y acogedor',
  'Productos profesionales premium',
  'Asesoramiento personalizado',
  'Reserva por WhatsApp',
] as const
