---
name: superpelu
description: >-
  Superpelu Hair Studio — React + Hono + SQLite. Reservas (/reservar), agenda
  admin y profesional (/agenda), catálogo BUK, personal Susana/Mónica/Andrea/Olga.
  Usar en este repo, Coolify, ADMIN_SECRET, citas, slots, coloración en dos tramos,
  colores agenda, bloqueos con alcance, gestión de clientes (/clientes),
  o API que devuelve HTML.
---

# Superpelu

## Arquitectura

- **Un proceso Node** (`npm start` → `server/index.ts`): API + `dist/` en el mismo puerto (`PORT`, default `3001`).
- **No** desplegar solo `dist/` estático: la API debe ir en el mismo contenedor.
- **SQLite:** `DATABASE_PATH` (prod: `/app/data/appointments.sqlite` + volumen en `/app/data`).
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
| `src/data/content.ts` | Textos de marca (landing) |

**Mechas (`highlights`):** servicios con `bookableOnline: false` — reserva online solo teléfono/WhatsApp; admin/profesional sí pueden citar.

**Coloración (reserva de franjas):** servicios `svc-root-color`, `svc-complete-color`, `svc-all-over-color`, `svc-color-block` usan patrón **30 min ocupado + 30 min pausa (libre en agenda) + 30 min lavado/acabado** — ver `src/lib/bookingOccupancy.ts` (`COLOR_SPLIT_SERVICE_IDS`). Duración en catálogo: 90 min. Una sola cita, no dos reservas separadas.

**Lavar color** (`svc-wash-color`): cita normal de 20 min (verde agua en agenda).

## Base de datos (SQLite)

Tablas: `service_categories`, `services`, `staff`, `staff_services`, `staff_availability`, `customers`, `appointments`, `staff_time_blocks`, `staff_sessions`.

**Clientes:** `customers.phone` (PK, E.164 `+34…` vía `src/lib/phone.ts`), `first_name`, `last_name`, `email`, `notes`. Las citas guardan `customer_phone` (FK lógica) y `customer_name` como **snapshot** del nombre usado en esa cita. Al crear/editar cita: `upsertCustomer` en `server/customers.ts`.

`staff_time_blocks`: `series_id`, `scope` (`single` | `range` | `weekly`) para bloqueos en serie (admin y API staff).

Migraciones en `server/db.ts` (`columnExists` + `ALTER`).

## Rutas web

| Ruta | Uso |
|------|-----|
| `/` | Landing |
| `/reservar` | Reserva pública — selector **especialidad → tratamiento** (`ServiceCategoryPickerPublic`) |
| `/agenda` | Login dual: **profesional** o **administración** |
| `/clientes` | Listado de clientes (solo admin, mismo `ADMIN_SECRET` que agenda) |
| `/clientes/:phone` | Historial de citas del cliente (pantalla completa; `phone` URL-encoded, p. ej. `%2B34600000000`) |

**Pagos:** no implementados (sin tabla ni UI de cobros).

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
| POST | `/api/appointments` | Crear cita; `customerName` o `customerFirstName` + `customerLastName` + `customerPhone` |

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
| `server/appointments.ts` | Slots, citas; `upsertCustomer` al crear/editar |
| `server/customers.ts` | `listCustomers`, `getCustomer`, `listCustomerAppointments`, `upsertCustomer` |
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

**Importante:** código importado desde `server/` debe usar rutas relativas en utilidades compartidas (sin alias `@/`), p. ej. `../src/lib/dates.ts`.

## Selector especialidad / tratamiento

Al cambiar especialidad se limpia el tratamiento pero la categoría elegida se guarda en estado local (`pickedCategoryId`). Sin esto el picker volvía a la primera categoría.

**Reserva pública (`ServiceCategoryPickerPublic`):**

- Muestra las **12 categorías** del catálogo (`getAllServiceCategories`), aunque no tengan servicios online.
- Categoría sin servicios reservables: subtítulo «Solo teléfono / WhatsApp» (`bookableOnline: false`, p. ej. mechas).
- Contador bajo el nombre: «N tratamiento(s)» (sin la palabra «online»).
- Móvil: tipografía pequeña en contador (`text-[10px]`, `whitespace-nowrap`) para evitar saltos de línea.
- Tarjetas categoría/tratamiento: `cursor-pointer`, `hover:border-gold/40`; títulos de tratamiento compactos (`text-sm` / `text-xs` en `md`).
- Si `GET /api/services` falla (p. ej. Vite sin API en `:3001`): mensaje + botón Reintentar (`useAppointmentForm`).

**Formularios de cita (staff/admin):** nombre + apellidos (`StaffAppointmentFormFields`); servidor acepta también `customerName` legacy en reserva pública.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev            # Vite :5173 + API :3001
npm run build && npm start
```

Tras editar `salonServices.ts` o categorías: **reiniciar servidor** para `syncSalonServices`.

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

## Convenciones

- Cambios mínimos; UI crema/dorado/carbón (`typography`).
- En UI: cualquier elemento interactivo tipo **botón** debe usar `cursor-pointer` (y mantener `:focus` visible con `focus:ring`/`focus:outline-none`).
- Usar radio sutil unificado `ui-rounded` (token `--radius-subtle`) en botones y contenedores para mantener consistencia visual.
- CTAs de reserva: hover más llamativo pero elegante (micro-elevación, sombra dorada suave, sin efectos agresivos).
- Nuevos servicios en `salonServices.ts` + `categoryId`; coloración partida solo en los 4 IDs de `COLOR_SPLIT_SERVICE_IDS`.
- No commitear `.env`, `data/`, `.cursor/` salvo `skills/superpelu/`.
- Responder al usuario en **español**.
