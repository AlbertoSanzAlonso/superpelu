---
name: superpelu
description: >-
  Superpelu Hair Studio — React + Hono + PostgreSQL (Supabase). Reservas (/reservar), agenda
  admin y profesional (/agenda), catálogo BUK, personal Susana/Mónica/Andrea/Olga.
  Usar en este repo, Coolify, ADMIN_SECRET, citas, slots, coloración en dos tramos,
  colores agenda, bloqueos con alcance, gestión de clientes (/clientes), i18n ES/EN web pública,
  WhatsApp/páginas cliente en idioma de reserva, aliases @/ y @server/, o API que devuelve HTML.
---

# Superpelu

## Arquitectura

- **Un proceso Node** (`npm start` → `tsx --tsconfig tsconfig.server.json server/index.ts`): API + `dist/` en el mismo puerto (`PORT`, default `3001`).
- **No** desplegar solo `dist/` estático: la API debe ir en el mismo contenedor.
- **PostgreSQL (Supabase):** `DATABASE_URL` (connection string del proyecto). El servidor aplica `server/pg/schema.sql` y sincroniza catálogo al arrancar.
- **Zona horaria:** `Europe/Madrid` — `src/data/schedule.ts`, `src/lib/dates.ts`, `TZ=Europe/Madrid` en Docker.
- **Horario salón:** mar–sáb 10:00–20:00, slots cada 30 min (`salonSchedule.slotMinutes`).

Al arrancar, `server/db.ts` sincroniza (upsert) categorías, servicios, personal y enlaces `staff_services` (todo el personal ↔ todos los servicios activos).

## Datos maestros (fuente de verdad en código)

| Archivo | Contenido |
|---------|-----------|
| `src/data/serviceCategories.ts` | 12 categorías (ES + EN), precios «desde» |
| `src/data/salonServices.ts` | ~70 servicios: `categoryId`, duración, `bookableOnline` |
| `src/data/salonStaff.ts` | Susana, Mónica, Andrea, Olga + contraseñas iniciales |
| `src/data/schedule.ts` | Horario y timezone del salón |
| `src/data/content.ts` | Datos de marca no traducibles (teléfono, URLs, dirección) — **no** textos de UI |

**Mechas (`highlights`):** servicios con `bookableOnline: false` — reserva online solo teléfono/WhatsApp; admin/profesional sí pueden citar.

**Coloración (reserva unificada):** servicios `svc-root-color`, `svc-complete-color`, `svc-all-over-color`, `svc-color-block` — el cliente reserva **90 min** (una cita); en agenda se crean **dos filas** enlazadas (`color_group_id`): fase color 30 min + pausa 30 min libre + **lavar color** 30 min (`svc-wash-color`, `color_group_role`). El lavado puede cambiar de profesional/hora en agenda de forma independiente. Ver `src/lib/bookingOccupancy.ts`, `server/colorBooking.ts`.

**Lavar color** (`svc-wash-color`): `bookableOnline: false` (no aparece en `/reservar`); solo agenda o como pareja al reservar coloración. En catálogo 20 min; en pareja con color ocupa **30 min** en agenda.

## Base de datos (PostgreSQL / Supabase)

Tablas: `service_categories`, `services`, `staff`, `staff_services`, `staff_availability`, `customers`, `appointments`, `staff_time_blocks`, `staff_sessions`.

Esquema: `server/pg/schema.sql`. Migrar datos desde SQLite: `npm run db:migrate-sqlite` (requiere `SQLITE_PATH` y `DATABASE_URL`).

**Clientes:** `customers.phone` (PK, E.164 `+34…` vía `src/lib/phone.ts`), `first_name`, `last_name`, `email`, `notes`. Las citas guardan `customer_phone` (FK lógica) y `customer_name` como **snapshot** del nombre usado en esa cita. Al crear/editar cita: `upsertCustomer` en `server/customers.ts`.

`staff_time_blocks`: `series_id`, `scope` (`single` | `range` | `weekly`) para bloqueos en serie (admin y API staff).

Esquema versionado en `server/pg/schema.sql` (aplicado al arrancar).

**Citas — idioma:** columna `appointments.locale` (`es` | `en`, default `es`). Se guarda en reserva pública (`POST /api/appointments` con `locale`); citas desde agenda admin/profesional → siempre `es`. Afecta a WhatsApp, nombre de servicio en snapshot y páginas `/c/` · `/m/`.

## Internacionalización (ES / EN)

Sitio **público** bilingüe. **Agenda admin/profesional** sigue solo en español.

### Archivos

| Archivo | Rol |
|---------|-----|
| `src/i18n/translations.ts` | **Fuente central** de textos ES + EN (landing, reserva, legal, WhatsApp, páginas cliente) |
| `src/i18n/types.ts` | `Locale`, `normalizeLocale`, detección navegador |
| `src/i18n/LocaleProvider.tsx` | Contexto + `localStorage` (`superpelu-locale`) + `<html lang>` y meta SEO |
| `src/i18n/useTranslation.ts` | Hook `{ t, locale, setLocale }` |
| `src/i18n/localeHelpers.ts` | `serviceDisplayName`, `appointmentLocale` — **importar desde `server/`** (sin assets Vite) |
| `src/i18n/helpers.ts` | Helpers UI (nav, galería, marketing, WhatsApp URL) — solo frontend; reexporta `localeHelpers` |
| `src/i18n/whatsappAppointment.ts` | Plantillas mensajes WhatsApp al cliente |
| `server/customerPages.ts` | HTML de `/c/:code` y `/m/:code` traducido |
| `src/components/layout/LanguageSwitcher.tsx` | Toggle ES \| EN en header y `/reservar` |

### Uso en React

```tsx
const { t, locale } = useTranslation()
// t.nav.bookAppointment, t.booking.pageTitle, etc.
```

Servicios en UI: `serviceDisplayName(service, locale)` → `nameEs` / `nameEn`. Fechas: `formatDisplayDate(date, locale)`.

### WhatsApp y páginas cliente (mismo idioma que la reserva)

- Confirmación, recordatorio 24h, reprogramación y cancelación → `buildWhatsAppAppointmentMessage` + `translations.whatsappAppointment`.
- Enlaces gestionar/cancelar (`buildManageUrl`, `buildCancelUrl`) llevan `&lang=en` si `locale === 'en'`.
- **`GET/POST /c/:code`** — cancelar cita (HTML servidor).
- **`GET/POST /m/:code`** — gestionar cita (cambiar día/hora/profesional).
- **`GET /m/:code/confirm`** — confirmar cambio.
- Textos en `translations.customerPages`; shell en `server/customerPages.ts`.

### Aliases de importación

El proyecto usa **alias de rutas** en frontend y backend (no rutas relativas `../src/` ni `./` entre módulos del server).

| Alias | Resuelve a | Dónde |
|-------|------------|-------|
| `@/*` | `src/*` | React (`src/`), código compartido importado desde `server/` |
| `@server/*` | `server/*` | Imports internos del API |

**Configuración:**

| Archivo | Rol |
|---------|-----|
| `tsconfig.app.json` | Paths `@/` y `@server/` para el frontend (`tsc -b`) |
| `tsconfig.server.json` | Paths para el API; lo usa `tsx` en `dev:api` y `start` |
| `vite.config.ts` | Alias `@` y `@server` en dev/build Vite |

**Convenciones:**

| Contexto | Ejemplo |
|----------|---------|
| Frontend (`src/`) | `import { Button } from '@/components/ui/Button'` — sin extensión |
| Mismo directorio en `src/` | `./translations` (opcional; se permite) |
| Server → server | `import { sql } from '@server/db.js'` — extensión `.js` (ESM TypeScript) |
| Server → src compartido | `import { formatDisplayDate } from '@/lib/dates'` — sin extensión |
| Src → tipos server | `import type { AppointmentRow } from '@server/pg/types'` |

**Producción:** `npm start` → `tsx --tsconfig tsconfig.server.json server/index.ts`. Los alias funcionan en runtime gracias a `tsx` + `tsconfig.server.json`.

**Evitar desde `server/`:** imports de `@/i18n/helpers` (arrastra `.webp`), `@/assets/*`, componentes React (`.tsx` de UI). Usar `@/i18n/localeHelpers` para `serviceDisplayName` / `appointmentLocale`.

**Verificar antes de desplegar:** `npm run build && npm start` (no solo `npm run dev`).

## Rutas web

| Ruta | Uso |
|------|-----|
| `/` | Landing — sección servicios con modal de detalle (`Services`, `ServiceDetailModal`) |
| `/reservar` | Reserva pública — selector **especialidad → tratamiento** (`ServiceCategoryPickerPublic`); sin enlace a agenda interna |
| `/agenda` | Login dual: **profesional** o **administración** |
| `/clientes` | Listado de clientes (solo admin, mismo `ADMIN_SECRET` que agenda) |
| `/clientes/:phone` | Historial de citas del cliente (pantalla completa; `phone` URL-encoded, p. ej. `%2B34600000000`) |
| `/c/:code?t=` | Cancelar cita (HTML servidor; enlace WhatsApp) |
| `/m/:code?t=` | Gestionar cita — cambiar fecha/hora o cancelar (HTML servidor) |

**Pagos:** no implementados (sin tabla ni UI de cobros).

### Landing — servicios de marketing

- Datos: assets en `src/data/marketingServices.ts`; textos en `translations.marketingServices`.
- **`Services`:** grid de tarjetas; marca de agua SP (`BRAND_MARK_SRC`) de fondo; tarjetas `bg-cream/35` + `backdrop-blur`.
- **`ServiceDetailModal`:** imagen + descripción + CTAs (Reservar cita, WhatsApp).
- Botón cerrar (✕): `cursor-pointer`; en **móvil** sobre la imagen; en **desktop (`md+`)** en el panel de descripción (esquina superior derecha; título con `md:pr-10`).

### Gestión de clientes (admin)

- Auth: `useAdminSession` — token en `sessionStorage` (`superpelu-admin-token`); sin token → redirige a `/agenda`.
- **`CustomersPage` (`/clientes`):** tabla con búsqueda (`?q=`), columnas citas/última cita; clic en fila → historial.
- **`CustomerHistoryPage` (`/clientes/:phone`):** ficha + lista de citas a pantalla completa.
  - Filtros en cliente: fecha **desde/hasta**, **tratamiento** (select con servicios del historial), «Quitar filtros», contador «X de Y citas».
  - Clic en cita → modal solo lectura `CustomerAppointmentDetailModal`.
- Enlace desde `AdminAgendaControlBar` → «Clientes».
- Componentes: `src/components/customers/` (`CustomersWorkspaceHeader`, `CustomerAppointmentDetailModal`).
- Utilidades: `src/lib/phone.ts`, `src/lib/customerName.ts`, tipos `src/types/customers.ts`.

### UI de agenda — shell común

Ambos modos usan `AgendaWorkspaceShell` (pantalla completa, **sin** logo ni `PageShell` de marca).

### Profesional (`StaffAgendaPanel`)

- Login → `POST /api/auth/staff/login` → `/api/me/*` (`staffApi.ts`, `server/me.ts`).
- **Barra:** `StaffAgendaControlBar` — saludo, navegación de día, contador de citas, **+ Cita**, acciones de selección en grilla, Salir.
- **Grilla:** `StaffTimeGrid` — huecos 30 min, colores BUK, selección múltiple para bloquear/desbloquear/crear cita.
- **Citas:** modal `StaffAppointmentFormModal` (igual patrón que admin; **no** desplegable).
- **Lista:** `StaffAppointmentList` (desplegable «Mis citas»).
- Hook: `useStaffAgenda`.

### Administración (`AdminAgendaPage`)

- Bearer `ADMIN_SECRET` → calendario día (`AdminSalonDayCalendar`), columnas por profesional.
- **Barra:** `AdminAgendaControlBar` — fecha, profesional activo, + Cita, **Clientes**, selección, Salir.
- Bloqueos con alcance: `BlockScopeModal`, `UnblockScopeModal` (`server/staffBlocks.ts`).
- Cita: `StaffAppointmentFormModal`.
- `GET /api/schedule/day?date=` → `listStaffDaySchedules` (citas con `occupiedSlots` para coloración partida).

## Colores en agenda (BUK)

`src/lib/serviceCategoryColors.ts` — `appointmentEventClass(categoryId, serviceId)`:

| Color | Categorías / servicios |
|-------|-------------------------|
| Azul | Cortes (`gentleman-haircut`, `haircut`, `haircut-blowdry`) |
| Rojo | Color, decoloración |
| Verde agua | Peinado, manos/pies, `svc-wash-color`, `svc-toner` |
| Morado | Mechas, keratina, permanente, maquillaje, micro |
| Marrón | Tratamientos capilares, facial |

Leyenda admin: `AdminCalendarLegend`. Grilla staff: `agendaColorLegend`.

## API

### Pública

| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/api/health` | `{"ok":true}` |
| GET | `/api/services` | Solo `bookable_online = 1` |
| GET | `/api/service-categories` | Con precios |
| GET | `/api/staff?serviceId=` | Profesionales del servicio |
| GET | `/api/slots?date=&serviceId=&staffId=` | Respeta tramos de coloración |
| POST | `/api/appointments` | Crear cita; `customerName`, `customerPhone`, opcional `locale` (`es`\|`en`) |

### Admin (`Authorization: Bearer ADMIN_SECRET`)

| Método | Ruta |
|--------|------|
| GET | `/api/auth/verify` |
| GET | `/api/customers?q=` |
| GET | `/api/customers/:phone` | Ficha + historial de citas |
| GET | `/api/schedule/day?date=` |
| GET | `/api/schedule/slots?date=&serviceId=&staffId=` |
| GET/PATCH/POST | `/api/appointments`, bloqueos `/api/schedule/blocks` |
| GET | `/api/schedule/blocks/:id/series` |
| DELETE | `/api/schedule/blocks/:id?mode=single\|series` |

### Profesional (`server/me.ts` bajo `/api`)

Sesión: header `Authorization: Bearer <token>` (UUID, 14 días).

| Método | Ruta |
|--------|------|
| POST | `/api/auth/staff/login` |
| GET | `/api/me/schedule`, `/api/me/services`, `/api/me/slots` |
| CRUD | `/api/me/appointments`, `/api/me/blocks` |

## Módulos clave

| Archivo | Rol |
|---------|-----|
| `server/appointmentWhatsApp.ts` | WhatsApp al cliente (confirmación, recordatorio, cambio, cancelación) en `row.locale` |
| `server/customerPages.ts` | Páginas HTML `/c/` y `/m/` traducidas |
| `server/appointmentLinks.ts` | URLs cancelar/gestionar/calendario; `appendLocaleToCustomerUrl` |
| `server/appointments.ts` | Slots, citas; `upsertCustomer`; guarda `locale`; engancha avisos WhatsApp + email |
| `server/appointmentEmail.ts` | Email al administrador en cita nueva/cancelada (SMTP/nodemailer) |
| `src/i18n/translations.ts` | Textos ES/EN centralizados |
| `server/staffSchedule.ts` | Día por profesional, `occupiedSlots` |
| `server/staffBlocks.ts` | Series de bloqueos |
| `src/lib/bookingOccupancy.ts` | Tramos coloración, solapes, formato horario |
| `src/lib/timeGrid.ts` | Grilla staff (segmentos ocupados) |
| `src/lib/servicePicker.ts` | Labels especialidad/tratamiento; `getAllServiceCategories()` para reserva pública |
| `src/components/shared/ServiceCategoryPicker.tsx` | Staff/admin — estado local de categoría |
| `src/components/shared/ServiceCategoryPickerPublic.tsx` | Reserva pública — 12 categorías, grid 2×/4 col, tratamientos 3 col en desktop |
| `src/hooks/useAdminSession.ts` | Token admin en `sessionStorage` para `/clientes` |
| `src/hooks/useAdminAgenda.ts` | Lógica agenda admin |
| `src/hooks/useAppointmentForm.ts` | Reserva pública; `servicesError` + Reintentar si API cae |
| `src/components/booking/AppointmentForm.tsx` | Formulario `/reservar` (sin enlace a `/agenda`) |
| `src/components/booking/AddToCalendarButton.tsx` | Botón «Añadir al calendario» en la confirmación (`BookingPage`) |
| `src/lib/calendar.ts` | `.ics` cliente + URL Google Calendar; `addAppointmentToCalendar` por dispositivo |
| `src/components/sections/Services.tsx` | Grid servicios en home |
| `src/components/sections/ServiceDetailModal.tsx` | Modal detalle servicio (home) |

**Importante:** ver sección **Internacionalización → Aliases de importación**. Resumen: `@/` en `src/` y código compartido; `@server/` entre módulos del API; `npm start` con `tsx --tsconfig tsconfig.server.json`.

## Añadir al calendario (confirmación de reserva)

Tras reservar, `BookingPage` muestra `AddToCalendarButton`. Comportamiento **según resolución** (`matchMedia('(min-width: 768px)')`):

- **Móvil (`< 768px`):** botón único; detecta SO → Android abre **Google Calendar**, iPhone/iPad descarga **`.ics`** (Apple Calendar nativo).
- **Escritorio (`≥ 768px`):** menú con opciones **Google Calendar** (enlace) y **`.ics`** (Apple/Outlook, descarga). En escritorio el `.ics` se descarga: es lo esperado (no hay calendario nativo del navegador).

Lógica en `src/lib/calendar.ts`: `addAppointmentToCalendar` (móvil), `buildGoogleCalendarUrl`, `downloadAppointmentIcs`. Hora en `Europe/Madrid` (VTIMEZONE en el `.ics`, `ctz` en Google).

## Selector especialidad / tratamiento

Al cambiar especialidad se limpia el tratamiento pero la categoría elegida se guarda en estado local (`pickedCategoryId`). Sin esto el picker volvía a la primera categoría.

**Reserva pública (`ServiceCategoryPickerPublic`):**

- Muestra las **12 categorías** del catálogo (`getAllServiceCategories`), aunque no tengan servicios online.
- Categoría sin servicios reservables: subtítulo «Solo teléfono / WhatsApp» (`bookableOnline: false`, p. ej. mechas).
- Contador bajo el nombre: «N tratamiento(s)» (sin la palabra «online»).
- Móvil: tipografía pequeña en contador (`text-[10px]`, `whitespace-nowrap`) para evitar saltos de línea.
- Tarjetas categoría/tratamiento: `cursor-pointer`, `hover:border-gold/40`; títulos de tratamiento compactos (`text-sm` / `text-xs` en `md`).
- Si `GET /api/services` falla (p. ej. Vite sin API en `:3001`): mensaje + botón Reintentar (`useAppointmentForm`).
- **Sin** enlace «¿Eres del equipo? Ver agenda interna» — el personal entra por `/agenda` (navbar u URL directa).

**Formularios de cita (staff/admin):** nombre + apellidos (`StaffAppointmentFormFields`); servidor acepta también `customerName` legacy en reserva pública.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev            # Vite :5173 + API :3001 (tsx con tsconfig.server.json)
npm run build && npm start
```

Tras editar `salonServices.ts` o categorías: **reiniciar servidor** para `syncSalonServices`.

## WhatsApp (OpenWA)

Opcional. Tras crear cita, el servidor puede enviar confirmación por WhatsApp (`server/openwa.ts`, `server/appointmentWhatsApp.ts`). **Idioma del mensaje** = `appointments.locale` de la cita (reserva pública envía `locale` desde el formulario).

| Variable | Uso |
|----------|-----|
| `OPENWA_ENABLED` | `true` para activar |
| `OPENWA_API_URL` | Default `http://openwa:2785/api` (red Docker) |
| `OPENWA_API_KEY` | Clave del dashboard OpenWA |
| `OPENWA_SESSION_ID` | ID de sesión conectada (QR escaneado) |
| `OPENWA_NOTIFY_PUBLIC_ONLY` | Si `true`, solo reservas `/reservar` (no agenda) |

Diagnóstico admin: `GET /api/admin/whatsapp` (Bearer `ADMIN_SECRET`).

### Enlaces del mensaje (cancelar / calendario)

Los enlaces **❌ Cancelar la cita** y los `/c/…`·`/a/…` se generan en `server/appointmentLinks.ts` y **requieren `PUBLIC_BASE_URL`** (o, en su defecto, `CORS_ORIGIN`). Sin esa variable, `buildCancelUrl` devuelve `null` y **el enlace no aparece** en el WhatsApp (no es un bug del mensaje).

- `PUBLIC_BASE_URL` debe apuntar al **dominio de la app Superpelu** (el subdominio de Coolify con HTTPS), **no** al dominio raíz si este apunta a otra web (p. ej. Hostinger): el enlace `/c/…` lo sirve la propia app.
- Firma de los enlaces de cancelación: `CANCEL_TOKEN_SECRET` (por defecto `ADMIN_SECRET`).

### Recordatorio 24h (`server/reminderScheduler.ts`)

Temporizador interno (arranca con el servidor si OpenWA está configurado y `REMINDERS_ENABLED != false`). Cada `REMINDER_POLL_MINUTES` (def. 10) busca citas `confirmed` con `reminder_sent_at IS NULL` dentro de la ventana `REMINDER_HOURS_BEFORE` (def. 24) y envía el recordatorio (idempotente vía columna `reminder_sent_at`).

- Reservas con **< 24h** de antelación: solo confirmación, sin recordatorio.
- Forzar a mano (pruebas): `POST /api/admin/whatsapp/reminders/run` (Bearer `ADMIN_SECRET`) → `{ sent }`; solo envía las que ya están dentro de la ventana.
- Log de arranque: `Superpelu recordatorio: activo (cada N min, 24h antes)`.

Dev: `npm run openwa:up` → API `http://127.0.0.1:2785/api`, dashboard `:2886`. **Coolify:** `docs/deploy-coolify-openwa.md`. Local compose perfil: `docker compose --profile openwa`.

## Email (aviso al administrador)

En **cada cita nueva o cancelada** se envía un email al administrador del negocio (`server/appointmentEmail.ts`, SMTP vía `nodemailer`). Cubre todas las vías porque se engancha en las funciones de datos, no en las rutas:

| Función (`server/appointments.ts`) | Evento |
|-------------------------------------|--------|
| `createAppointment` | `created` (reserva pública, agenda admin y profesional) |
| `cancelAppointment` | `cancelled` (cancelación admin + enlace público `/c/:code`) |
| `deleteAppointmentForStaff` | `cancelled` (profesional elimina su cita) |

Los envíos son *fire-and-forget* (`void`, error capturado y logueado): nunca bloquean ni rompen la respuesta de la API.

**Plantilla** (`buildAppointmentAdminEmail`): cabecera con el evento (verde «Nueva cita reservada» / rojo «Cita cancelada»), luego los datos en orden **Nombre** (+ teléfono), **Fecha / hora**, **Servicio(s) y colaborador(es)** (`Servicio (Profesional)`), **Notas** (si hay), y botón **Ver agenda** (→ `PUBLIC_BASE_URL`/`CORS_ORIGIN` + `/agenda`; se omite si no hay URL pública).

| Variable | Uso |
|----------|-----|
| `EMAIL_ENABLED` | `true` para activar |
| `ADMIN_NOTIFICATION_EMAIL` | Destinatario(s) de los avisos; varios separados por comas |
| `SMTP_HOST` | Servidor SMTP (p. ej. `smtp.gmail.com`) |
| `SMTP_PORT` | Default `587`; `465` = SSL |
| `SMTP_SECURE` | `true` para puerto 465 (STARTTLS en 587) |
| `SMTP_USER` | Cuenta que envía (remitente) |
| `SMTP_PASS` | Con Gmail: **contraseña de aplicación**, no la normal |
| `EMAIL_FROM` | Remitente mostrado; por defecto `SMTP_USER` |

`getEmailConfig()` devuelve `null` si falta `EMAIL_ENABLED`, `SMTP_HOST` o `ADMIN_NOTIFICATION_EMAIL` (entonces no se envía nada).

**Gmail:** requiere verificación en 2 pasos + contraseña de aplicación (https://myaccount.google.com/apppasswords). En local el `.env` se carga solo (`process.loadEnvFile` en `server/pg/client.ts`), pero `tsx watch` **no** recarga el `.env`: tras editarlo hay que reiniciar `npm run dev`. En **producción (Coolify)** `NODE_ENV=production` no carga `.env`; las variables van en el panel de entorno.

## Despliegue Coolify

Ver [deploy-coolify.md](deploy-coolify.md).

## Diagnóstico rápido

| Síntoma | Causa habitual |
|---------|----------------|
| Login admin 401 con clave correcta | `ADMIN_SECRET` no en contenedor |
| `/api/*` devuelve HTML | `caddy_0.try_files` o deploy solo estático |
| No se puede cambiar especialidad | Bug de estado — ver `pickedCategoryId` en pickers |
| Color sin hueco de 90 min | Segundo tramo ocupado; pausa central puede tener otra cita |
| Profesional no entra | Nombre exacto; hash en `salonStaff.ts` |
| `/clientes` redirige a agenda | Falta login admin o token inválido en `sessionStorage` |
| `/reservar` sin tratamientos | API no arrancada en dev; usar `npm run dev` (no solo Vite) |
| WhatsApp sin enlace de cancelar/calendario | Falta `PUBLIC_BASE_URL` (o `CORS_ORIGIN`) en el contenedor |
| Móvil no abre la web (HTTPS) | Dominio en `http://` o `sslip.io` → certificado autofirmado; usar subdominio propio con `https://` |
| No llega recordatorio 24h | OpenWA no configurado, cita `< 24h`, o `REMINDERS_ENABLED=false` |
| No llega el email de aviso | `EMAIL_ENABLED`/`SMTP_*` ausentes en el contenedor; en local, reiniciar `npm run dev` (no recarga `.env`); con Gmail, usar contraseña de aplicación |
| Contenedor unhealthy al desplegar | Logs: `Cannot find package '@/…'` — falta `--tsconfig tsconfig.server.json` en `start`, o módulo server importa assets React/Vite; probar `npm run build && npm start` |

## Convenciones

- **Imports:** `@/` para `src/`; `@server/` para módulos del API; no usar `../src/` ni `./` entre archivos de `server/`.
- Cambios mínimos; UI crema/dorado/carbón (`typography`).
- En UI: cualquier elemento interactivo tipo **botón** debe usar `cursor-pointer` (y mantener `:focus` visible con `focus:ring`/`focus:outline-none`).
- Usar radio sutil unificado `ui-rounded` (token `--radius-subtle`) en botones y contenedores para mantener consistencia visual.
- CTAs de reserva: hover más llamativo pero elegante (micro-elevación, sombra dorada suave, sin efectos agresivos).
- Nuevos servicios en `salonServices.ts` + `categoryId`; coloración partida solo en los 4 IDs de `COLOR_SPLIT_SERVICE_IDS`.
- No commitear `.env`, `data/`, `.cursor/` salvo `skills/superpelu/`.
- Responder al usuario en **español**.
