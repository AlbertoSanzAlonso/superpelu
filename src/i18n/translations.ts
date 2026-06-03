import type { Locale } from './types'

const es = {
  meta: {
    title: 'Superpelu Hair Studio | Peluquería en Benalmádena',
    description:
      'Superpelu Hair Studio — peluquería en Benalmádena especialista en color y estética. Balayage, mechas, cortes y tratamientos en Arroyo de la Miel.',
  },
  common: {
    close: 'Cerrar',
    backHome: 'Volver al inicio',
    home: 'Inicio',
    whatsapp: 'WhatsApp',
    retry: 'Reintentar',
    agendaEyebrow: 'Agenda',
    legalInfo: 'Información legal',
    lastUpdated: 'Última actualización:',
    allRightsReserved: 'Todos los derechos reservados.',
    of: 'de',
    and: 'y',
  },
  language: {
    label: 'Idioma',
    es: 'ES',
    en: 'EN',
  },
  nav: {
    services: 'Servicios',
    salon: 'El salón',
    gallery: 'Galería',
    contact: 'Contacto',
    book: 'Reservar',
    bookAppointment: 'Reservar cita',
    bookAppointmentOnline: 'Reserva cita',
    viewServices: 'Ver servicios',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    homeAria: (brand: string) => `${brand} — inicio`,
  },
  hero: {
    tagline: 'Tu belleza, nuestro arte',
    lead:
      'Peluquería en Benalmádena especialista en color y estética. Servicios profesionales con experiencia, innovación y atención personalizada.',
    body:
      'En Super Pelu Hair Studio te ayudamos a cuidar tu imagen con tratamientos capilares, técnicas de coloración avanzada y servicios adaptados a cada cliente. Trabajamos con productos profesionales para resultados naturales, duraderos y a tu estilo.',
  },
  servicesSection: {
    eyebrow: 'Coloración · Cortes · Tratamientos',
    scriptAccent: 'Servicios',
    title: 'Peluquería y estética a tu medida',
    subtitle:
      'Coloración profesional, cortes personalizados y tratamientos capilares con las últimas tendencias del sector.',
  },
  studioSection: {
    eyebrow: 'Tu salón en Benalmádena',
    scriptAccent: 'El salón',
    title: 'Peluquería y estética en Arroyo de la Miel',
    subtitle:
      'Un ambiente moderno, cercano y profesional donde cada cliente recibe asesoramiento adaptado a sus necesidades.',
    intro:
      'Super Pelu Benalmádena es un centro especializado en el cuidado del cabello y la imagen personal. Nuestro equipo cuenta con experiencia en coloración profesional, cortes personalizados y tratamientos capilares.',
    team:
      'Profesionales con experiencia en peluquería, estética y tratamientos capilares. Nos mantenemos en constante formación para ofrecer las últimas tendencias y técnicas del sector.',
    salonImageAlt: 'Superpelu Hair Studio — peluquería en Benalmádena',
    mapsTitle: 'Cómo llegar',
    mapsIframeTitle: 'Ubicación de Superpelu Hair Studio en Google Maps',
    openInMaps: 'Abrir en Google Maps',
    viewOnMaps: 'Ver en Google Maps',
  },
  highlights: [
    'Profesionales especialistas en coloración capilar',
    'Técnicas actuales: balayage, mechas y corrección de color',
    'Productos profesionales de alta calidad',
    'Atención personalizada y asesoramiento estético',
    'Ambiente cómodo y moderno',
  ],
  gallerySection: {
    eyebrow: 'Nuestro trabajo',
    scriptAccent: 'Galería',
    title: 'Resultados reales en coloración y cuidado capilar',
    subtitle:
      'Trabajos personalizados adaptados al estilo y las características del cabello de cada cliente. Nuestra especialidad es la coloración profesional.',
  },
  gallery: {
    swipeHint: 'Desliza para ver más fotos',
    ariaGallery: 'Galería de imágenes',
    ariaGroup: (current: number, total: number) => `Galería, grupo ${current} de ${total}`,
    ariaPrevGroup: 'Grupo anterior de la galería',
    ariaNextGroup: 'Grupo siguiente de la galería',
    ariaGroupsTablist: 'Grupos de la galería',
    ariaGroupTab: (n: number) => `Grupo ${n}`,
    ariaExpand: (alt: string) => `Ampliar imagen: ${alt}`,
    counter: (current: number, total: number) => `${current} de ${total}`,
    alts: {
      peinadoBoda: 'Peinados de boda con orquídeas para madre e hijas — Superpelu Benalmádena',
      coloracionMagenta: 'Coloración magenta borgoña con ondas — Superpelu Benalmádena',
      balayageBob: 'Balayage rubio en bob liso — Superpelu Benalmádena',
      balayageMelena: 'Balayage rubio en melena con ondas — Superpelu Benalmádena',
      balayageSalon: 'Balayage rubio con ondas en el salón — Superpelu Benalmádena',
      rubioPlatino: 'Rubio platino con ondas y raíz difuminada — Superpelu Benalmádena',
      balayageCeniza: 'Balayage de rubio ceniza a dorado con ondas — Superpelu Benalmádena',
      mechasBalayage: 'Mechas balayage rubio con ondas suaves — Superpelu Benalmádena',
      balayageMedio: 'Balayage rubio en pelo medio con ondas — Superpelu Benalmádena',
      balayageMielLarga: 'Balayage rubio miel en melena larga — Superpelu Benalmádena',
      balayageMielPlaya: 'Balayage rubio miel con ondas playeras — Superpelu Benalmádena',
      balayageCaramelo: 'Balayage caramelo con ondas voluminosas — Superpelu Benalmádena',
      balayageDorado: 'Balayage rubio dorado en melena con ondas — Superpelu Benalmádena',
      mechasDorado: 'Mechas rubio dorado con ondas — Superpelu Benalmádena',
      rubioCenizaLiso: 'Rubio ceniza liso en melena — Superpelu Benalmádena',
      balayageCrema: 'Balayage rubio crema con ondas — Superpelu Benalmádena',
      balayageRizos: 'Balayage rubio con rizos en melena — Superpelu Benalmádena',
    },
  },
  lightbox: {
    enlarged: 'Imagen ampliada',
    close: 'Cerrar imagen ampliada',
    prev: 'Imagen anterior',
    next: 'Imagen siguiente',
    zoom: 'Ampliar imagen',
  },
  testimonialsSection: {
    eyebrow: 'Opiniones',
    scriptAccent: 'Clientes',
    title: 'Lo que dicen de nosotros',
    subtitle:
      'La satisfacción de nuestros clientes avala la calidad de nuestros servicios de peluquería y estética.',
    starsAria: (rating: number) => `${rating} de 5 estrellas`,
  },
  testimonials: [
    {
      id: 'inmaculada',
      name: 'Inmaculada Fernández',
      quote:
        'No puedo estar más contenta con todo el equipo de súper pelu. El trato es buenísimo y el asesoramiento sincero: te aconsejan lo que es mejor para ti. Son cercanas y una maravilla de profesionales. Gracias Olga por dejar a mi madre tan bonita. Repetiremos siempre.',
    },
    {
      id: 'clara',
      name: 'Clara',
      quote:
        'Probé muchos lugares desde Málaga hasta Marbella antes de encontrarlos. El mejor peluquería, complementando el servicio con el mejor asesoramiento y productos. Gracias Susana por siempre hacer un excelente trabajo.',
    },
  ],
  contactSection: {
    eyebrow: 'Reserva tu cita',
    scriptAccent: 'Contacto',
    title: 'Peluquería cerca de ti en Benalmádena',
    subtitle:
      'Reserva online, llámanos o escríbenos por WhatsApp. Estamos en Av. las Palmeras, Arroyo de la Miel.',
    phone: 'Teléfono',
    email: 'Email',
    location: 'Ubicación',
  },
  bookingOptions: [
    {
      id: 'online',
      title: 'Reserva online',
      description: 'Reserva en nuestra agenda online: elige servicio, día y hora.',
      label: 'Reservar cita online',
    },
    {
      id: 'phone',
      title: 'Llámanos',
      description: 'Habla con nosotros y te ayudamos a concertar tu cita.',
      label: (phone: string) => `Llamar al ${phone}`,
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp directo',
      description: 'Escríbenos y te respondemos lo antes posible.',
      label: 'Escribir por WhatsApp',
    },
  ],
  footer: {
    cookiePolicy: 'Política de cookies',
    footerNavAria: 'Enlaces del pie',
    socialAria: 'Redes sociales',
  },
  marketingServices: {
    color: {
      title: 'Coloración profesional',
      description:
        'Especialistas en color capilar: rubios, morenos cálidos, corrección de color y resultados naturales y duraderos.',
      detail:
        'Analizamos tu base, salud del cabello y el resultado que buscas para proponerte la técnica más adecuada: tonos naturales, cobertura de canas, morenos cálidos o corrección de color. Trabajamos con productos profesionales para un acabado uniforme, luminoso y duradero, siempre con asesoramiento personalizado antes y después del servicio.',
      imageAlt: 'Coloración profesional con ondas — Superpelu Benalmádena',
    },
    balayage: {
      title: 'Balayage y mechas',
      description:
        'Técnicas actuales como balayage, mechas y degradados luminosos adaptados a tu cabello y estilo.',
      detail:
        'El balayage y las mechas aportan luz y dimensión sin perder naturalidad. Diseñamos el patrón según tu corte, tono de piel y mantenimiento que prefieras: rubios miel, cenizas, caramelo o contrastes más marcados. Te explicamos cómo cuidar el color en casa para que el degradado se mantenga bonito el máximo tiempo posible.',
      imageAlt: 'Balayage y mechas rubio con ondas — Superpelu Benalmádena',
    },
    corte: {
      title: 'Corte y styling',
      description:
        'Cortes personalizados y acabados profesionales con asesoramiento adaptado a tus necesidades.',
      detail:
        'Desde un cambio de look hasta el mantenimiento de tu estilo habitual: cortes a medida, texturizado, brushing y acabados para el día a día o eventos. Te asesoramos sobre qué forma favorece tu rostro y cómo peinarlo en casa para que el resultado dure y sea fácil de llevar.',
      imageAlt: 'Corte bob con balayage rubio — Superpelu Benalmádena',
    },
    tratamiento: {
      title: 'Tratamientos capilares',
      description:
        'Tratamientos reparadores, hidratación y cuidado del cabello con productos profesionales de alta calidad.',
      detail:
        'Recupera suavidad, brillo y fuerza con tratamientos de hidratación, nutrición o reparación según el estado de tu melena. Ideales después de procesos químicos, exposición al sol o cuando notas el cabello apagado o quebradizo. Combinamos diagnóstico y productos profesionales para notar el cambio desde la primera visita.',
      imageAlt: 'Tratamiento capilar con brillo — Superpelu Benalmádena',
    },
  },
  salonCategories: {
    'gentleman-haircut': 'Corte caballero y niño',
    color: 'Coloración',
    highlights: 'Mechas y balayage',
    bleaching: 'Decoloración',
    'haircut-blowdry': 'Corte y brushing',
    haircut: 'Corte',
    blowdry: 'Peinado y brushing',
    perm: 'Permanente',
    keratin: 'Alisado de keratina',
    'hair-treatments': 'Tratamientos capilares',
    'beauty-hands-feet': 'Manos y pies',
    'beauty-facial': 'Estética facial',
    other: 'Otros',
  },
  servicePicker: {
    public: {
      category: '¿Qué te apetece hoy?',
      service: 'Tu tratamiento',
      loading: 'Cargando tratamientos…',
      emptyCategory: 'Reserva este tipo de cita por teléfono o WhatsApp.',
      phoneOnly: 'Solo teléfono / WhatsApp',
      oneTreatment: '1 tratamiento',
      treatments: (n: number) => `${n} tratamientos`,
      noServices: (phone: string) =>
        `No hay tratamientos disponibles. Llámanos al ${phone}.`,
      callPhone: (phone: string) => `Llamar al ${phone}`,
      writeWhatsApp: 'Escribir por WhatsApp',
      minutes: (n: number) => `${n} min`,
    },
  },
  booking: {
    pageTitle: 'Reserva tu cita',
    pageSubtitle: 'Elige servicio, día, hora y profesional. Martes a sábado de 10:00 a 20:00.',
    confirmedTitle: '¡Cita confirmada!',
    confirmedSubtitle: 'Te esperamos en Superpelu Hair Studio',
    confirmedBody:
      'Hemos registrado tu cita. Si necesitas cambiarla, llámanos o escríbenos por WhatsApp.',
    newAppointment: 'Nueva cita',
    steps: [
      '¿Qué te apetece hoy?',
      'Tu tratamiento',
      'Día y hora',
      'Datos y confirmación',
    ],
    stepProgress: (current: number, total: number) => `Paso ${current} de ${total}`,
    prevStep: 'Paso anterior',
    staff: 'Profesional',
    day: 'Día',
    hour: 'Hora',
    changeDay: 'Cambiar día',
    changeTime: 'Cambiar hora',
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    chooseServiceFirst: 'Primero elige tu tratamiento',
    chooseStaffForSlot: 'Elige un profesional para continuar',
    loadingStaff: 'Cargando equipo…',
    noStaffAtSlot: 'No hay profesionales libres a esa hora.',
    selectDay: 'Selecciona un día en el calendario',
    loadingSlots: 'Cargando horarios…',
    noSlots: 'No hay huecos ese día.',
    confirm: 'Confirmar cita',
    saving: 'Guardando…',
    fullName: 'Nombre completo',
    phone: 'Teléfono',
    emailOptional: 'Email (opcional)',
    notesOptional: 'Observaciones de la cita (opcional)',
    notesPlaceholder: 'Mechas, alergias, preferencias para esta visita…',
    summaryLabels: {
      service: 'Servicio',
      staff: 'Profesional',
      date: 'Fecha',
      schedule: 'Horario',
      name: 'Nombre',
    },
    errors: {
      noServicesOnline: 'No hay tratamientos disponibles online en este momento.',
      serverConnection:
        'No se pudo conectar con el servidor. Si estás en local, ejecuta npm run dev y recarga.',
      noStaff: 'No hay profesionales para este servicio.',
      loadStaff: 'No se pudo cargar el equipo.',
      noSlots: 'No quedan huecos libres ese día.',
      noStaffAtSlot: 'No hay profesionales libres a esa hora.',
      loadSlots: 'No se pudieron cargar horarios.',
      createFailed: 'No se pudo crear la cita',
      nameRequired: 'Indica tu nombre completo.',
      phoneRequired: 'Indica un teléfono móvil para contactarte.',
      phoneInvalid: 'El teléfono debe ser un móvil español (9 dígitos, empieza por 6, 7, 8 o 9).',
    },
  },
  calendar: {
    add: 'Añadir al calendario',
    google: 'Google Calendar',
    ics: 'Apple Calendar / Outlook (.ics)',
    eventTitle: (service: string) => `Cita Superpelu — ${service}`,
    eventDetails: (staff: string, phone: string) => `Cita con ${staff}. Tel: ${phone}`,
    fileName: 'cita-superpelu.ics',
  },
  whatsapp: {
    default:
      'Hola, quiero reservar una cita en SuperPelu Benalmádena',
    highlights:
      'Hola, quiero reservar mechas o balayage en SuperPelu Benalmádena',
  },
  whatsappAppointment: {
    greeting: (name: string) => `Hola ${name}, 👋`,
    confirmationHeading: 'Tu cita en *Superpelu* está confirmada:',
    rescheduledHeading: 'Tu cita en *Superpelu* ha sido *reprogramada*:',
    reminderHeading: 'Te recordamos tu cita de mañana en *Superpelu*:',
    cancelledHeading: 'Tu cita en *Superpelu* ha sido *cancelada*:',
    noShowHeading:
      'Tenías una cita en *Superpelu* y no hemos podido verte. Te echamos de menos y nos preocupa por si te hubiera pasado algo:',
    withStaff: (name: string) => `👤 Con ${name}`,
    manageLinkLabel: '📋 Cancelar / modificar cita:',
    bookAgainLabel: 'Reservar otra cita:',
    noShowRebookLabel: 'Si quieres reservar de nuevo:',
    closingConfirmed: '¡Te esperamos!',
    closingThanks: '¡Gracias!',
    closingNoShow: 'Cuídate. Estamos aquí cuando quieras.',
    reviewRequestHeading:
      '¡Esperamos que hayas disfrutado tu visita en *Superpelu*! Si te ha gustado el servicio, nos ayudaría mucho que nos dejaras una valoración en Google:',
    reviewRequestLinkLabel: '⭐ Valorar en Google Maps',
    reviewRequestClosing: '¡Mil gracias por tu confianza!',
  },
  customerPages: {
    metaDescription: 'Gestiona o cancela tu cita en Superpelu Hair Studio.',
    goToWebsite: 'Ir a la web',
    backToManage: 'Volver a gestionar',
    withStaff: (name: string) => `👤 Con ${name}`,
    invalidLink: {
      title: 'Enlace no válido',
      heading: 'Enlace no válido',
      bodyCancel:
        'Este enlace de cancelación no es correcto o ha caducado. Llama al salón si necesitas ayuda.',
      bodyManage:
        'Este enlace no es correcto o ha caducado. Llama al salón si necesitas ayuda.',
      bodyAction: 'No se pudo completar la acción.',
      bodyConfirm: 'No se pudo confirmar el cambio.',
    },
    notFound: {
      title: 'Cita no encontrada',
      heading: 'Cita no encontrada',
      body: 'No hemos encontrado esta cita.',
      bodyInactive: 'Esta cita ya no está activa.',
    },
    alreadyCancelled: {
      title: 'Cita cancelada',
      headingDone: 'Esta cita ya está cancelada',
      bodyDone: 'No hay nada más que hacer. ¡Gracias!',
      headingWas: 'Esta cita ya estaba cancelada',
      bodyThanks: '¡Gracias!',
      headingIs: 'Esta cita está cancelada',
      bodyBookAgain: 'Si quieres, puedes reservar otra cita en nuestra web.',
    },
    cancel: {
      title: 'Cancelar cita',
      heading: '¿Cancelar tu cita?',
      confirmButton: 'Sí, cancelar la cita',
      hint: 'Si fue un error, cierra esta página y tu cita seguirá activa.',
      successTitle: 'Cita cancelada',
      successHeading: '✅ Cita cancelada',
      successBody: 'Tu cita ha sido cancelada correctamente.',
      successFooter: 'Si quieres, puedes reservar otra cuando quieras. ¡Gracias!',
    },
    manage: {
      title: 'Gestionar cita',
      heading: 'Gestionar tu cita',
      modifySection: 'Modificar cita',
      staffSection: 'Profesional',
      staffAria: 'Profesional',
      daySection: 'Día',
      hourSection: 'Hora',
      cancelSection: 'Cancelar',
      cancelButton: 'Cancelar la cita',
      salonClosed:
        'El salón no abre ese día o está fuera del plazo de reserva. Elige otra fecha.',
      noSlots: 'No hay huecos libres ese día. Prueba otra fecha u otro profesional.',
      callSalon: 'Para cambiar el servicio, llama al salón: 952 443 686',
    },
    confirmChange: {
      title: 'Confirmar cambio',
      heading: '¿Confirmar el cambio?',
      intro: 'Tu cita quedará así:',
      submit: 'Sí, confirmar cambio',
      back: 'No, volver',
    },
    updated: {
      title: 'Cita actualizada',
      heading: '✅ Cita actualizada',
      intro: 'Tu cita ha quedado así:',
      closing: '¡Te esperamos!',
    },
    changeFailed: {
      title: 'No se pudo cambiar',
      heading: 'No se pudo cambiar',
      defaultError: 'No se pudo cambiar la cita. Inténtalo de nuevo.',
      back: 'Volver',
    },
    incomplete: {
      title: 'Datos incompletos',
      heading: 'Faltan datos',
      bodyStaffDayTime: 'Elige profesional, día y hora.',
      bodyDateTime: 'Elige una fecha y una hora.',
    },
    errors: {
      CITA_NO_ENCONTRADA: 'No hemos encontrado esta cita.',
      FECHA_INVALIDA:
        'La fecha elegida no está disponible. Elige otro día (mar–sáb, dentro del plazo de reserva).',
      HORARIO_NO_DISPONIBLE: 'Ese horario ya no está libre. Elige otra hora.',
      STAFF_NO_REALIZA_SERVICIO: 'Ese profesional no realiza este servicio.',
      STAFF_INVALIDO: 'Profesional no disponible.',
      SERVICIO_INVALIDO: 'Servicio no válido.',
    },
  },
  cookiePolicy: {
    title: 'Política de cookies',
    updatedAt: '27 de mayo de 2026',
    sections: [
      {
        id: 'responsable',
        title: '1. Responsable',
        paragraphs: [
          (brand: string, tagline: string, address: string) =>
            `El responsable del tratamiento es ${brand} ${tagline} (${address}).`,
          (email: string, phone: string) =>
            `Puede contactarnos en ${email} o en el teléfono ${phone}.`,
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
    ],
  },
} as const

const en = {
  meta: {
    title: 'Superpelu Hair Studio | Hair Salon in Benalmádena',
    description:
      'Superpelu Hair Studio — hair salon in Benalmádena specialising in colour and beauty. Balayage, highlights, cuts and treatments in Arroyo de la Miel.',
  },
  common: {
    close: 'Close',
    backHome: 'Back to home',
    home: 'Home',
    whatsapp: 'WhatsApp',
    retry: 'Retry',
    agendaEyebrow: 'Booking',
    legalInfo: 'Legal information',
    lastUpdated: 'Last updated:',
    allRightsReserved: 'All rights reserved.',
    of: 'of',
    and: 'and',
  },
  language: {
    label: 'Language',
    es: 'ES',
    en: 'EN',
  },
  nav: {
    services: 'Services',
    salon: 'The salon',
    gallery: 'Gallery',
    contact: 'Contact',
    book: 'Book',
    bookAppointment: 'Book appointment',
    bookAppointmentOnline: 'Book appointment',
    viewServices: 'View services',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    homeAria: (brand: string) => `${brand} — home`,
  },
  hero: {
    tagline: 'Your beauty, our craft',
    lead:
      'Hair salon in Benalmádena specialising in colour and beauty. Professional services with experience, innovation and personalised care.',
    body:
      'At Super Pelu Hair Studio we help you look after your image with hair treatments, advanced colouring techniques and services tailored to each client. We work with professional products for natural, long-lasting results that suit your style.',
  },
  servicesSection: {
    eyebrow: 'Colour · Cuts · Treatments',
    scriptAccent: 'Services',
    title: 'Hair and beauty tailored to you',
    subtitle:
      'Professional colour, personalised cuts and hair treatments following the latest industry trends.',
  },
  studioSection: {
    eyebrow: 'Your salon in Benalmádena',
    scriptAccent: 'The salon',
    title: 'Hair and beauty in Arroyo de la Miel',
    subtitle:
      'A modern, welcoming and professional space where every client receives advice adapted to their needs.',
    intro:
      'Super Pelu Benalmádena is a centre specialising in hair care and personal image. Our team has experience in professional colour, personalised cuts and hair treatments.',
    team:
      'Professionals with experience in hairdressing, beauty and hair treatments. We keep training to offer the latest trends and techniques in the industry.',
    salonImageAlt: 'Superpelu Hair Studio — hair salon in Benalmádena',
    mapsTitle: 'How to find us',
    mapsIframeTitle: 'Superpelu Hair Studio location on Google Maps',
    openInMaps: 'Open in Google Maps',
    viewOnMaps: 'View on Google Maps',
  },
  highlights: [
    'Specialists in professional hair colour',
    'Current techniques: balayage, highlights and colour correction',
    'High-quality professional products',
    'Personalised care and beauty advice',
    'Comfortable, modern atmosphere',
  ],
  gallerySection: {
    eyebrow: 'Our work',
    scriptAccent: 'Gallery',
    title: 'Real results in colour and hair care',
    subtitle:
      'Personalised work adapted to each client\'s style and hair. Our speciality is professional colour.',
  },
  gallery: {
    swipeHint: 'Swipe to see more photos',
    ariaGallery: 'Image gallery',
    ariaGroup: (current: number, total: number) => `Gallery, group ${current} of ${total}`,
    ariaPrevGroup: 'Previous gallery group',
    ariaNextGroup: 'Next gallery group',
    ariaGroupsTablist: 'Gallery groups',
    ariaGroupTab: (n: number) => `Group ${n}`,
    ariaExpand: (alt: string) => `Enlarge image: ${alt}`,
    counter: (current: number, total: number) => `${current} of ${total}`,
    alts: {
      peinadoBoda: 'Wedding updos with orchids for mother and daughters — Superpelu Benalmádena',
      coloracionMagenta: 'Magenta burgundy colour with waves — Superpelu Benalmádena',
      balayageBob: 'Blonde balayage on sleek bob — Superpelu Benalmádena',
      balayageMelena: 'Blonde balayage on long wavy hair — Superpelu Benalmádena',
      balayageSalon: 'Blonde balayage with waves in the salon — Superpelu Benalmádena',
      rubioPlatino: 'Platinum blonde with waves and blended roots — Superpelu Benalmádena',
      balayageCeniza: 'Ash to golden blonde balayage with waves — Superpelu Benalmádena',
      mechasBalayage: 'Soft blonde balayage highlights with waves — Superpelu Benalmádena',
      balayageMedio: 'Blonde balayage on medium-length wavy hair — Superpelu Benalmádena',
      balayageMielLarga: 'Honey blonde balayage on long hair — Superpelu Benalmádena',
      balayageMielPlaya: 'Honey blonde balayage with beach waves — Superpelu Benalmádena',
      balayageCaramelo: 'Caramel balayage with voluminous waves — Superpelu Benalmádena',
      balayageDorado: 'Golden blonde balayage on long wavy hair — Superpelu Benalmádena',
      mechasDorado: 'Golden blonde highlights with waves — Superpelu Benalmádena',
      rubioCenizaLiso: 'Sleek ash blonde on long hair — Superpelu Benalmádena',
      balayageCrema: 'Cream blonde balayage with waves — Superpelu Benalmádena',
      balayageRizos: 'Blonde balayage with curls on long hair — Superpelu Benalmádena',
    },
  },
  lightbox: {
    enlarged: 'Enlarged image',
    close: 'Close enlarged image',
    prev: 'Previous image',
    next: 'Next image',
    zoom: 'Enlarge image',
  },
  testimonialsSection: {
    eyebrow: 'Reviews',
    scriptAccent: 'Clients',
    title: 'What our clients say',
    subtitle:
      'Our clients\' satisfaction reflects the quality of our hairdressing and beauty services.',
    starsAria: (rating: number) => `${rating} out of 5 stars`,
  },
  testimonials: [
    {
      id: 'inmaculada',
      name: 'Inmaculada Fernández',
      quote:
        'I couldn\'t be happier with the whole Super Pelu team. The service is wonderful and the advice is honest: they tell you what works best for you. They\'re warm and truly skilled professionals. Thank you Olga for making my mother look so beautiful. We\'ll always come back.',
    },
    {
      id: 'clara',
      name: 'Clara',
      quote:
        'I tried many places from Málaga to Marbella before finding them. The best salon, with excellent advice and products. Thank you Susana for always doing an outstanding job.',
    },
  ],
  contactSection: {
    eyebrow: 'Book your appointment',
    scriptAccent: 'Contact',
    title: 'A hair salon near you in Benalmádena',
    subtitle:
      'Book online, call us or message us on WhatsApp. We\'re on Av. las Palmeras, Arroyo de la Miel.',
    phone: 'Phone',
    email: 'Email',
    location: 'Location',
  },
  bookingOptions: [
    {
      id: 'online',
      title: 'Book online',
      description: 'Book through our online calendar: choose service, day and time.',
      label: 'Book online',
    },
    {
      id: 'phone',
      title: 'Call us',
      description: 'Speak with us and we\'ll help you schedule your appointment.',
      label: (phone: string) => `Call ${phone}`,
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      description: 'Message us and we\'ll reply as soon as possible.',
      label: 'Message on WhatsApp',
    },
  ],
  footer: {
    cookiePolicy: 'Cookie policy',
    footerNavAria: 'Footer links',
    socialAria: 'Social media',
  },
  marketingServices: {
    color: {
      title: 'Professional colour',
      description:
        'Hair colour specialists: blondes, warm brunettes, colour correction and natural, long-lasting results.',
      detail:
        'We assess your base, hair health and desired result to recommend the best technique: natural tones, grey coverage, warm brunettes or colour correction. We use professional products for an even, luminous and long-lasting finish, with personalised advice before and after your service.',
      imageAlt: 'Professional colour with waves — Superpelu Benalmádena',
    },
    balayage: {
      title: 'Balayage and highlights',
      description:
        'Current techniques such as balayage, highlights and luminous gradients adapted to your hair and style.',
      detail:
        'Balayage and highlights add light and dimension without losing a natural look. We design the pattern according to your cut, skin tone and preferred maintenance: honey blondes, ash tones, caramel or bolder contrasts. We explain how to care for your colour at home so the gradient stays beautiful for as long as possible.',
      imageAlt: 'Blonde balayage and highlights with waves — Superpelu Benalmádena',
    },
    corte: {
      title: 'Cut and styling',
      description:
        'Personalised cuts and professional finishes with advice adapted to your needs.',
      detail:
        'From a full makeover to maintaining your usual style: bespoke cuts, texturising, blow-dries and finishes for everyday wear or special events. We advise on what shape suits your face and how to style it at home so the result lasts and is easy to maintain.',
      imageAlt: 'Bob cut with blonde balayage — Superpelu Benalmádena',
    },
    tratamiento: {
      title: 'Hair treatments',
      description:
        'Repairing treatments, hydration and hair care with high-quality professional products.',
      detail:
        'Restore softness, shine and strength with hydration, nourishment or repair treatments according to your hair\'s condition. Ideal after chemical processes, sun exposure or when your hair feels dull or brittle. We combine diagnosis and professional products so you notice the difference from the first visit.',
      imageAlt: 'Hair treatment with shine — Superpelu Benalmádena',
    },
  },
  salonCategories: {
    'gentleman-haircut': 'Gentlemen\'s and children\'s cut',
    color: 'Colour',
    highlights: 'Highlights and balayage',
    bleaching: 'Bleaching',
    'haircut-blowdry': 'Cut and blow-dry',
    haircut: 'Haircut',
    blowdry: 'Styling and blow-dry',
    perm: 'Perm',
    keratin: 'Keratin straightening',
    'hair-treatments': 'Hair treatments',
    'beauty-hands-feet': 'Hands and feet',
    'beauty-facial': 'Facial beauty',
    other: 'Other',
  },
  servicePicker: {
    public: {
      category: 'What would you like today?',
      service: 'Your treatment',
      loading: 'Loading treatments…',
      emptyCategory: 'Book this type of appointment by phone or WhatsApp.',
      phoneOnly: 'Phone / WhatsApp only',
      oneTreatment: '1 treatment',
      treatments: (n: number) => `${n} treatments`,
      noServices: (phone: string) =>
        `No treatments available. Call us on ${phone}.`,
      callPhone: (phone: string) => `Call ${phone}`,
      writeWhatsApp: 'Message on WhatsApp',
      minutes: (n: number) => `${n} min`,
    },
  },
  booking: {
    pageTitle: 'Book your appointment',
    pageSubtitle: 'Choose service, day, time and stylist. Tuesday to Saturday, 10:00–20:00.',
    confirmedTitle: 'Appointment confirmed!',
    confirmedSubtitle: 'We look forward to seeing you at Superpelu Hair Studio',
    confirmedBody:
      'Your appointment has been registered. If you need to change it, call us or message us on WhatsApp.',
    newAppointment: 'New appointment',
    steps: [
      'What would you like today?',
      'Your treatment',
      'Day and time',
      'Details and confirmation',
    ],
    stepProgress: (current: number, total: number) => `Step ${current} of ${total}`,
    prevStep: 'Previous step',
    staff: 'Stylist',
    day: 'Day',
    hour: 'Time',
    changeDay: 'Change day',
    changeTime: 'Change time',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    chooseServiceFirst: 'Choose your treatment first',
    chooseStaffForSlot: 'Choose a stylist to continue',
    loadingStaff: 'Loading team…',
    noStaffAtSlot: 'No stylists available at that time.',
    selectDay: 'Select a day on the calendar',
    loadingSlots: 'Loading times…',
    noSlots: 'No slots available that day.',
    confirm: 'Confirm appointment',
    saving: 'Saving…',
    fullName: 'Full name',
    phone: 'Phone',
    emailOptional: 'Email (optional)',
    notesOptional: 'Appointment notes (optional)',
    notesPlaceholder: 'Highlights, allergies, preferences for this visit…',
    summaryLabels: {
      service: 'Service',
      staff: 'Stylist',
      date: 'Date',
      schedule: 'Time',
      name: 'Name',
    },
    errors: {
      noServicesOnline: 'No treatments available online at the moment.',
      serverConnection:
        'Could not connect to the server. If running locally, start npm run dev and reload.',
      noStaff: 'No stylists available for this service.',
      loadStaff: 'Could not load the team.',
      noSlots: 'No free slots left that day.',
      noStaffAtSlot: 'No stylists available at that time.',
      loadSlots: 'Could not load available times.',
      createFailed: 'Could not create the appointment',
      nameRequired: 'Please enter your full name.',
      phoneRequired: 'Please enter a mobile number so we can reach you.',
      phoneInvalid: 'Enter a valid Spanish mobile (9 digits, starting with 6, 7, 8 or 9).',
    },
  },
  calendar: {
    add: 'Add to calendar',
    google: 'Google Calendar',
    ics: 'Apple Calendar / Outlook (.ics)',
    eventTitle: (service: string) => `Superpelu appointment — ${service}`,
    eventDetails: (staff: string, phone: string) => `Appointment with ${staff}. Tel: ${phone}`,
    fileName: 'superpelu-appointment.ics',
  },
  whatsapp: {
    default:
      'Hello, I would like to book an appointment at SuperPelu Benalmádena',
    highlights:
      'Hello, I would like to book highlights or balayage at SuperPelu Benalmádena',
  },
  whatsappAppointment: {
    greeting: (name: string) => `Hello ${name}, 👋`,
    confirmationHeading: 'Your appointment at *Superpelu* is confirmed:',
    rescheduledHeading: 'Your appointment at *Superpelu* has been *rescheduled*:',
    reminderHeading: 'Reminder: your appointment tomorrow at *Superpelu*:',
    cancelledHeading: 'Your appointment at *Superpelu* has been *cancelled*:',
    noShowHeading:
      'You had an appointment at *Superpelu* and we missed you. We are worried in case something happened:',
    withStaff: (name: string) => `👤 With ${name}`,
    manageLinkLabel: '📋 Cancel or change appointment:',
    bookAgainLabel: 'Book another appointment:',
    noShowRebookLabel: 'To book again:',
    closingConfirmed: 'We look forward to seeing you!',
    closingThanks: 'Thank you!',
    closingNoShow: 'Take care. We are here whenever you need us.',
    reviewRequestHeading:
      'We hope you enjoyed your visit at *Superpelu*! If you liked our service, a Google review would mean a lot to us:',
    reviewRequestLinkLabel: '⭐ Leave a review on Google Maps',
    reviewRequestClosing: 'Thank you so much for your trust!',
  },
  customerPages: {
    metaDescription: 'Manage or cancel your appointment at Superpelu Hair Studio.',
    goToWebsite: 'Go to website',
    backToManage: 'Back to manage',
    withStaff: (name: string) => `👤 With ${name}`,
    invalidLink: {
      title: 'Invalid link',
      heading: 'Invalid link',
      bodyCancel:
        'This cancellation link is incorrect or has expired. Call the salon if you need help.',
      bodyManage:
        'This link is incorrect or has expired. Call the salon if you need help.',
      bodyAction: 'The action could not be completed.',
      bodyConfirm: 'The change could not be confirmed.',
    },
    notFound: {
      title: 'Appointment not found',
      heading: 'Appointment not found',
      body: 'We could not find this appointment.',
      bodyInactive: 'This appointment is no longer active.',
    },
    alreadyCancelled: {
      title: 'Appointment cancelled',
      headingDone: 'This appointment is already cancelled',
      bodyDone: 'Nothing else to do. Thank you!',
      headingWas: 'This appointment was already cancelled',
      bodyThanks: 'Thank you!',
      headingIs: 'This appointment is cancelled',
      bodyBookAgain: 'If you like, you can book another appointment on our website.',
    },
    cancel: {
      title: 'Cancel appointment',
      heading: 'Cancel your appointment?',
      confirmButton: 'Yes, cancel appointment',
      hint: 'If this was a mistake, close this page and your appointment will remain active.',
      successTitle: 'Appointment cancelled',
      successHeading: '✅ Appointment cancelled',
      successBody: 'Your appointment has been cancelled successfully.',
      successFooter: 'If you like, you can book another whenever you want. Thank you!',
    },
    manage: {
      title: 'Manage appointment',
      heading: 'Manage your appointment',
      modifySection: 'Modify appointment',
      staffSection: 'Stylist',
      staffAria: 'Stylist',
      daySection: 'Day',
      hourSection: 'Time',
      cancelSection: 'Cancel',
      cancelButton: 'Cancel appointment',
      salonClosed:
        'The salon is closed that day or the date is outside the booking window. Choose another date.',
      noSlots: 'No free slots that day. Try another date or stylist.',
      callSalon: 'To change the service, call the salon: 952 443 686',
    },
    confirmChange: {
      title: 'Confirm change',
      heading: 'Confirm the change?',
      intro: 'Your appointment will be:',
      submit: 'Yes, confirm change',
      back: 'No, go back',
    },
    updated: {
      title: 'Appointment updated',
      heading: '✅ Appointment updated',
      intro: 'Your appointment is now:',
      closing: 'We look forward to seeing you!',
    },
    changeFailed: {
      title: 'Could not change',
      heading: 'Could not change',
      defaultError: 'The appointment could not be changed. Please try again.',
      back: 'Back',
    },
    incomplete: {
      title: 'Incomplete data',
      heading: 'Missing information',
      bodyStaffDayTime: 'Choose stylist, day and time.',
      bodyDateTime: 'Choose a date and time.',
    },
    errors: {
      CITA_NO_ENCONTRADA: 'We could not find this appointment.',
      FECHA_INVALIDA:
        'The chosen date is not available. Pick another day (Tue–Sat, within the booking window).',
      HORARIO_NO_DISPONIBLE: 'That time is no longer available. Choose another slot.',
      STAFF_NO_REALIZA_SERVICIO: 'That stylist does not perform this service.',
      STAFF_INVALIDO: 'Stylist not available.',
      SERVICIO_INVALIDO: 'Invalid service.',
    },
  },
  cookiePolicy: {
    title: 'Cookie policy',
    updatedAt: '27 May 2026',
    sections: [
      {
        id: 'responsable',
        title: '1. Data controller',
        paragraphs: [
          (brand: string, tagline: string, address: string) =>
            `The data controller is ${brand} ${tagline} (${address}).`,
          (email: string, phone: string) =>
            `You can contact us at ${email} or by phone on ${phone}.`,
        ],
      },
      {
        id: 'que-son',
        title: '2. What are cookies?',
        paragraphs: [
          'Cookies are small files that a website may store on your device (computer, mobile or tablet) when you visit it. Similar technologies may also be used, such as browser local storage.',
          'They help the site work properly, remember preferences or, in some cases, analyse how the site is used.',
        ],
      },
      {
        id: 'que-usamos',
        title: '3. Cookies and technologies we use on this site',
        paragraphs: [
          'On superpelubenalmadena.es we use cookies and local storage strictly necessary for the site to function, as well as third-party content that may install its own cookies:',
        ],
        list: [
          'Technical cookies / session storage: in the private schedule and admin areas, a session identifier is stored in the browser (sessionStorage) to maintain access during your visit. They are not used for advertising purposes.',
          'Google Maps: on the salon page we display an embedded Google map that may install its own cookies (for example, NID, CONSENT) to show the location and improve the maps service.',
          'Google Fonts: the site\'s typefaces are loaded from Google\'s servers, which may record technical access data (IP address, browser, etc.).',
        ],
      },
      {
        id: 'terceros',
        title: '4. Third-party cookies',
        paragraphs: [
          'External providers (Google LLC and its associated services) may process your data according to their own policies. We recommend reading Google\'s privacy policy: https://policies.google.com/privacy',
          'As of the last update of this text, this site does not use its own analytics cookies or behavioural advertising managed directly by Superpelu.',
        ],
      },
      {
        id: 'gestion',
        title: '5. How to manage or delete cookies',
        paragraphs: [
          'You can allow, block or delete cookies from your browser settings. If you block technical cookies, some site features (for example, staff schedule access) may become unavailable.',
          'To manage Google cookies in maps and other services, visit https://adssettings.google.com or your browser\'s privacy settings.',
        ],
      },
      {
        id: 'base-legal',
        title: '6. Legal basis',
        paragraphs: [
          'Technical cookies and storage necessary for the site to function or for services requested by the user are used on the basis of legitimate interest and the performance of pre-contractual measures or a contract (Art. 6.1.b and 6.1.f GDPR and Art. 22.2 LSSI).',
          'Third-party cookies associated with maps or external resources are loaded when those contents are displayed; you can avoid them by not visiting pages that include them or by configuring your browser.',
        ],
      },
      {
        id: 'cambios',
        title: '7. Changes to this policy',
        paragraphs: [
          'We may update this cookie policy to reflect legal or technical changes to the site. The date of the last revision appears at the top of this document.',
        ],
      },
    ],
  },
} as const

export const translations = { es, en } as const

export type Translation = (typeof translations)[Locale]

export function getTranslation(locale: Locale): Translation {
  return translations[locale]
}
