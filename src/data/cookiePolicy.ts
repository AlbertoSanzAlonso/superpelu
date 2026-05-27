import { brand } from './content'

export const cookiePolicyMeta = {
  title: 'Política de cookies',
  updatedAt: '27 de mayo de 2026',
} as const

export const cookiePolicySections = [
  {
    id: 'responsable',
    title: '1. Responsable',
    paragraphs: [
      `El responsable del tratamiento es ${brand.name} ${brand.tagline} (${brand.address}).`,
      `Puede contactarnos en ${brand.email} o en el teléfono ${brand.phone}.`,
    ],
  },
  {
    id: 'que-son',
    title: '2. ¿Qué son las cookies?',
    paragraphs: [
      'Las cookies son pequeños archivos que un sitio web puede guardar en su dispositivo (ordenador, móvil o tablet) cuando lo visita. También pueden utilizarse tecnologías similares, como el almacenamiento local del navegador.',
      'Sirven para que el sitio funcione correctamente, recordar preferencias o, en algunos casos, analizar el uso del sitio.',
    ],
  },
  {
    id: 'que-usamos',
    title: '3. Cookies y tecnologías que utilizamos en este sitio',
    paragraphs: [
      'En superpelubenalmadena.es utilizamos cookies y almacenamiento local estrictamente necesarios para el funcionamiento del sitio, así como contenidos de terceros que pueden instalar sus propias cookies:',
    ],
    list: [
      'Cookies técnicas / almacenamiento de sesión: en las áreas privadas de agenda y administración se guarda un identificador de sesión en el navegador (sessionStorage) para mantener el acceso mientras dura la visita. No se utilizan con fines publicitarios.',
      'Google Maps: en la página del salón mostramos un mapa incrustado de Google que puede instalar cookies propias (por ejemplo, NID, CONSENT) para mostrar la ubicación y mejorar el servicio de mapas.',
      'Google Fonts: las tipografías del sitio se cargan desde los servidores de Google, que pueden registrar datos técnicos de acceso (dirección IP, navegador, etc.).',
    ],
  },
  {
    id: 'terceros',
    title: '4. Cookies de terceros',
    paragraphs: [
      'Los proveedores externos (Google LLC y sus servicios asociados) pueden tratar sus datos según sus propias políticas. Le recomendamos consultar la política de privacidad de Google: https://policies.google.com/privacy',
      'Este sitio no utiliza, en la fecha de la última actualización de este texto, cookies de analítica propias ni publicidad comportamental gestionadas directamente por Superpelu.',
    ],
  },
  {
    id: 'gestion',
    title: '5. Cómo gestionar o eliminar cookies',
    paragraphs: [
      'Puede permitir, bloquear o eliminar las cookies desde la configuración de su navegador. Si bloquea las cookies técnicas, es posible que algunas funciones del sitio (por ejemplo, el acceso a la agenda del personal) dejen de estar disponibles.',
      'Para gestionar las cookies de Google en mapas y otros servicios, puede visitar https://adssettings.google.com o la configuración de privacidad de su navegador.',
    ],
  },
  {
    id: 'base-legal',
    title: '6. Base legal',
    paragraphs: [
      'Las cookies técnicas y el almacenamiento necesario para el funcionamiento del sitio o servicios solicitados por el usuario se utilizan en base al interés legítimo y a la ejecución de medidas precontractuales o del contrato (art. 6.1.b y 6.1.f del RGPD y art. 22.2 de la LSSI).',
      'Las cookies de terceros asociadas a mapas o fuentes externas se cargan al mostrar esos contenidos; puede evitarlas no visitando las páginas que los incorporan o configurando su navegador.',
    ],
  },
  {
    id: 'cambios',
    title: '7. Cambios en esta política',
    paragraphs: [
      'Podemos actualizar esta política de cookies para adaptarla a cambios legales o técnicos en el sitio. La fecha de la última revisión figura al inicio del documento.',
    ],
  },
] as const
