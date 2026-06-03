import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fs from 'node:fs'
import path from 'node:path'
import { listActiveServiceCategories } from '@server/serviceCategories.js'
import { listActiveServices } from '@server/services.js'
import { listStaffForService, getStaff } from '@server/staff.js'
import { me } from '@server/me.js'
import { listStaffDaySchedules } from '@server/staffSchedule.js'
import {
  cancelAppointment,
  createAppointment,
  deleteAppointmentById,
  getAppointmentById,
  markAppointmentNoShow,
  getAvailableSlots,
  getServiceDaySlots,
  getStaffAvailableAtSlot,
  listAppointments,
  rescheduleAppointmentByCustomer,
  rowToPublic,
  updateAppointmentForAdmin,
} from '@server/appointments.js'
import {
  buildIcs,
  buildLinkPreviewMetaTags,
  buildManageUrl,
  decodeId,
  injectSpaLinkPreviewMeta,
  publicBaseUrl,
  verifyCancelToken,
} from '@server/appointmentLinks.js'
import {
  appointmentDetailHtml,
  backToManageLink,
  customerPageShell,
  customerPageUrlFromRequest,
  escapeHtml,
  manageErrorMessage,
  renderInvalidLinkPage,
  renderNotFoundPage,
  resolvePageLocale,
} from '@server/customerPages.js'
import { getTranslation } from '@/i18n/translations'
import type { Locale } from '@/i18n/types'
import {
  addDaysToDateString,
  formatDisplayDate,
  isSalonOpenDay,
  isWithinSalonBookingWindow,
  todaySalon,
} from '@/lib/dates'
import { schedule } from '@server/config.js'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { splitCustomerName } from '@/lib/customerName'
import {
  createStaffBlock,
  deleteStaffBlockById,
  getBlockSeriesMeta,
  rowBlockToPublic,
  updateStaffBlockNote,
  type BlockScope,
  type DeleteBlockMode,
  type UpdateBlockNoteMode,
} from '@server/staffBlocks.js'
import { listServicesForStaff } from '@server/staff.js'
import {
  deleteCustomer,
  getCustomer,
  listCustomerAppointments,
  listCustomers,
  updateCustomer,
} from '@server/customers.js'
import { initDatabase, sql } from '@server/db.js'
import {
  getOpenWaAdminConfig,
  isOpenWaConfigured,
  isOpenWaSessionConnected,
  logOpenWaStartup,
  openWaEnsureSession,
  openWaGetQr,
  openWaGetSessionById,
  openWaGetSessionStatus,
  openWaSessionName,
  openWaStartSession,
  startOpenWaKeepAlive,
} from '@server/openwa.js'
import { processDueReminders, startReminderScheduler } from '@server/reminderScheduler.js'
import { logEmailStartup } from '@server/appointmentEmail.js'

const app = new Hono()

app.onError((err, c) => {
  const path = c.req.path
  if (path.startsWith('/api/')) {
    console.error(`Superpelu API ${path}:`, err)
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
  throw err
})
const adminSecret = (process.env.ADMIN_SECRET ?? 'superpelu-dev-admin').trim()
const port = Number(process.env.PORT ?? 3001)

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean)

app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      if (!origin) return '*'
      if (!corsOrigins?.length) return origin
      return corsOrigins.includes(origin) ? origin : corsOrigins[0]
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

function requireAdmin(authorization: string | undefined): boolean {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  return token.length > 0 && token === adminSecret
}

app.route('/api', me)

app.get('/api/health', async (c) => {
  try {
    await sql`SELECT 1 AS ok`
    return c.json({ ok: true, db: true })
  } catch (err) {
    console.error('Superpelu: healthcheck DB falló', err)
    return c.json({ ok: false, db: false, error: 'Base de datos no disponible' }, 503)
  }
})

app.get('/api/auth/verify', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }
  return c.json({ ok: true })
})

/** Fuerza el envío de recordatorios pendientes (solo admin, para pruebas). */
app.post('/api/admin/whatsapp/reminders/run', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const sent = await processDueReminders()
  return c.json({ sent })
})

/** Estado de la sesión OpenWA (solo admin). */
app.get('/api/admin/whatsapp', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)

  if (!isOpenWaConfigured()) {
    return c.json({
      configured: false,
      enabled: false,
      message: 'OpenWA no configurado (OPENWA_ENABLED y credenciales)',
    })
  }

  const session = await openWaGetSessionStatus()
  return c.json({
    configured: true,
    enabled: true,
    session: session
      ? {
          id: session.id,
          status: session.status,
          phoneNumber: session.phone ?? session.phoneNumber,
          name: session.name,
        }
      : null,
    connected: isOpenWaSessionConnected(session?.status),
  })
})

/**
 * Alta de WhatsApp por navegador (solo admin): crea/arranca la sesión y muestra
 * el QR como imagen. Acepta el secret por header `Authorization: Bearer` o por
 * query `?secret=` (para poder abrirlo directamente en el navegador).
 */
app.get('/api/admin/whatsapp/qr', async (c) => {
  const auth = c.req.header('Authorization')
  const querySecret = c.req.query('secret') ?? ''
  const authorized = requireAdmin(auth) || (querySecret.length > 0 && querySecret === adminSecret)
  if (!authorized) {
    return c.html('<h1>No autorizado</h1><p>Añade ?secret=TU_ADMIN_SECRET a la URL.</p>', 401)
  }

  const admin = getOpenWaAdminConfig()
  if (!admin) {
    return c.html(
      '<h1>OpenWA no configurado</h1><p>Faltan OPENWA_ENABLED, OPENWA_API_URL u OPENWA_API_KEY.</p>',
      400,
    )
  }

  const name = openWaSessionName()
  const refresh = '<meta http-equiv="refresh" content="15">'
  const style =
    '<style>body{font-family:system-ui;text-align:center;padding:2rem;background:#111;color:#eee}' +
    'img{max-width:340px;background:#fff;padding:12px;border-radius:8px}code{background:#222;padding:2px 6px;border-radius:4px}</style>'

  try {
    const session = await openWaEnsureSession(name)
    const fresh = (await openWaGetSessionById(session.id)) ?? session

    if (isOpenWaSessionConnected(fresh.status)) {
      return c.html(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">${style}<title>WhatsApp Superpelu</title></head>` +
          `<body><h1>✅ WhatsApp conectado</h1>` +
          `<p>Sesión <code>${name}</code> · estado <code>${fresh.status}</code></p>` +
          `<p>Session ID:<br><code>${fresh.id}</code></p>` +
          `<p>Pon este id en <code>OPENWA_SESSION_ID</code> en Superpelu y haz Redeploy.</p></body></html>`,
      )
    }

    await openWaStartSession(session.id)
    const qr = await openWaGetQr(session.id)

    if (!qr) {
      return c.html(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">${refresh}${style}<title>WhatsApp Superpelu</title></head>` +
          `<body><h1>Generando QR…</h1><p>Estado <code>${fresh.status}</code>. La página se recarga sola.</p>` +
          `<p>Session ID: <code>${session.id}</code></p></body></html>`,
      )
    }

    return c.html(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">${refresh}${style}<title>WhatsApp Superpelu</title></head>` +
        `<body><h1>WhatsApp — Superpelu</h1>` +
        `<p>Escanea con el móvil del salón: WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>` +
        `<img src="${qr}" alt="QR">` +
        `<p style="opacity:.6">La página se recarga sola cada 15 s</p>` +
        `<p>Session ID:<br><code>${session.id}</code></p>` +
        `<p>Cuando conecte, pon ese id en <code>OPENWA_SESSION_ID</code> y haz Redeploy.</p></body></html>`,
    )
  } catch (err) {
    return c.html(`<h1>Error</h1><pre>${String(err)}</pre>`, 502)
  }
})

app.get('/api/services', async (c) =>
  c.json({ services: await listActiveServices({ onlineOnly: true }) }),
)

app.get('/api/service-categories', async (c) =>
  c.json({ categories: await listActiveServiceCategories() }),
)

app.get('/api/staff', async (c) => {
  const serviceId = c.req.query('serviceId')
  if (!serviceId) {
    return c.json({ error: 'Falta serviceId' }, 400)
  }
  const date = c.req.query('date')
  const startTime = c.req.query('startTime')
  if (date && startTime) {
    return c.json({
      staff: await getStaffAvailableAtSlot(date, serviceId, startTime),
    })
  }
  return c.json({ staff: await listStaffForService(serviceId) })
})

app.get('/api/slots', async (c) => {
  const date = c.req.query('date')
  const serviceId = c.req.query('serviceId')
  const staffId = c.req.query('staffId')

  if (!date || !serviceId) {
    return c.json({ error: 'Faltan date o serviceId' }, 400)
  }

  if (!staffId) {
    return c.json({
      date,
      serviceId,
      slots: await getServiceDaySlots(date, serviceId),
    })
  }

  return c.json({
    date,
    serviceId,
    staffId,
    slots: await getAvailableSlots(date, serviceId, staffId),
  })
})

app.post('/api/appointments', async (c) => {
  const body = await c.req.json<{
    serviceId: string
    staffId: string
    date: string
    startTime: string
    customerName: string
    customerPhone: string
    customerEmail?: string
    notes?: string
    locale?: 'es' | 'en'
  }>()

  if (
    !body.serviceId ||
    !body.staffId ||
    !body.date ||
    !body.startTime ||
    !body.customerName?.trim() ||
    !body.customerPhone?.trim()
  ) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }

  try {
    const row = await createAppointment({
      serviceId: body.serviceId,
      staffId: body.staffId,
      date: body.date,
      startTime: body.startTime,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      notes: body.notes,
      locale: body.locale,
    })
    return c.json({ appointment: rowToPublic(row) }, 201)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    const messages: Record<string, string> = {
      SERVICIO_INVALIDO: 'Servicio no válido',
      STAFF_INVALIDO: 'Profesional no válido',
      STAFF_NO_REALIZA_SERVICIO: 'Este profesional no realiza ese servicio',
      FECHA_INVALIDA: 'Fecha no disponible',
      HORARIO_NO_DISPONIBLE: 'Ese horario ya no está disponible',
      TELEFONO_INVALIDO: 'Teléfono no válido (móvil español)',
      NOMBRE_INVALIDO: 'Indica al menos el nombre',
    }
    return c.json({ error: messages[code] ?? 'No se pudo crear la cita' }, 409)
  }
})

app.get('/api/customers', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const q = c.req.query('q')
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
  return c.json({ customers: await listCustomers({ q, limit }) })
})

function customerToJson(customer: {
  phone: string
  first_name: string
  last_name: string | null
  email: string | null
  notes: string | null
  locale?: string | null
  created_at: string
  updated_at: string
}) {
  return {
    phone: customer.phone,
    firstName: customer.first_name,
    lastName: customer.last_name ?? '',
    email: customer.email,
    notes: customer.notes,
    locale: customer.locale === 'en' ? 'en' : 'es',
    createdAt: customer.created_at,
    updatedAt: customer.updated_at,
  }
}

app.get('/api/customers/:phone', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const phone = decodeURIComponent(c.req.param('phone'))
  const appointmentRows = await listCustomerAppointments(phone)
  const customer = await getCustomer(phone)
  if (!customer && appointmentRows.length === 0) {
    return c.json({ error: 'Cliente no encontrado' }, 404)
  }
  const appointments = appointmentRows.map(rowToPublic)
  if (customer) {
    return c.json({
      customer: customerToJson(customer),
      appointments,
    })
  }
  const latest = appointmentRows[0]
  const { firstName, lastName } = splitCustomerName(latest.customer_name)
  const now = new Date().toISOString()
  return c.json({
    customer: {
      phone: latest.customer_phone,
      firstName,
      lastName,
      email: latest.customer_email,
      notes: null,
      locale: latest.locale === 'en' ? 'en' : 'es',
      createdAt: now,
      updatedAt: now,
    },
    appointments,
  })
})

app.patch('/api/customers/:phone', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)

  const phone = decodeURIComponent(c.req.param('phone'))
  const body = await c.req.json<{
    firstName?: string
    lastName?: string
    email?: string | null
    notes?: string | null
    locale?: 'es' | 'en'
  }>()

  try {
    const row = await updateCustomer(phone, {
      firstName: body.firstName ?? '',
      lastName: body.lastName,
      email: body.email,
      notes: body.notes,
      locale: body.locale,
    })
    return c.json({ customer: customerToJson(row) })
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    const messages: Record<string, string> = {
      TELEFONO_INVALIDO: 'Teléfono no válido',
      CLIENTE_NO_ENCONTRADO: 'Cliente no encontrado',
      NOMBRE_INVALIDO: 'Indica al menos el nombre',
    }
    const status = code === 'CLIENTE_NO_ENCONTRADO' ? 404 : 400
    return c.json({ error: messages[code] ?? 'No se pudo actualizar el cliente' }, status)
  }
})

app.delete('/api/customers/:phone', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)

  const phone = decodeURIComponent(c.req.param('phone'))
  if (!(await deleteCustomer(phone))) {
    return c.json({ error: 'Cliente no encontrado' }, 404)
  }
  return c.json({ ok: true })
})

app.get('/api/appointments', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 10)
  const to = c.req.query('to') ?? from

  const rows = await listAppointments(from, to)
  return c.json({ appointments: rows.map(rowToPublic) })
})

/** Franja del personal + citas que la ocupan + huecos libres (admin). */
app.get('/api/schedule/day', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const date = c.req.query('date')
  if (!date) {
    return c.json({ error: 'Falta date' }, 400)
  }

  return c.json({ date, schedules: await listStaffDaySchedules(date) })
})

const adminScheduleErrors: Record<string, string> = {
  SERVICIO_INVALIDO: 'Servicio no válido',
  STAFF_INVALIDO: 'Profesional no válido',
  STAFF_NO_REALIZA_SERVICIO: 'Este profesional no realiza ese servicio',
  FECHA_INVALIDA: 'Fecha no disponible',
  HORARIO_NO_DISPONIBLE: 'Ese horario no está disponible',
  CITA_NO_ENCONTRADA: 'Cita no encontrada',
  TELEFONO_INVALIDO: 'Teléfono no válido (móvil español)',
  NOMBRE_INVALIDO: 'Indica al menos el nombre',
  RANGO_INVALIDO: 'La hora de fin debe ser posterior al inicio',
  BLOQUEO_SOLAPADO: 'Ya hay un bloqueo en ese tramo',
  FECHA_FIN_INVALIDA: 'La fecha de fin debe ser igual o posterior al inicio',
  ALCANCE_INVALIDO: 'Tipo de bloqueo no válido',
}

app.get('/api/schedule/services', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const staffId = c.req.query('staffId')
  if (!staffId) return c.json({ error: 'Falta staffId' }, 400)
  return c.json({ services: await listServicesForStaff(staffId) })
})

app.get('/api/schedule/slots', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const date = c.req.query('date')
  const serviceId = c.req.query('serviceId')
  const staffId = c.req.query('staffId')
  const exclude = c.req.query('excludeAppointmentId')
  if (!date || !serviceId || !staffId) {
    return c.json({ error: 'Faltan date, serviceId o staffId' }, 400)
  }
  return c.json({
    slots: await getAvailableSlots(date, serviceId, staffId, {
      forStaffPortal: true,
      excludeAppointmentId: exclude,
    }),
  })
})

app.post('/api/schedule/appointments', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{
    staffId: string
    serviceId: string
    date: string
    startTime: string
    customerName?: string
    customerFirstName?: string
    customerLastName?: string
    customerPhone: string
    customerEmail?: string
    customerNotes?: string
    notes?: string
    customerLocale?: 'es' | 'en'
  }>()
  const hasName = Boolean(body.customerName?.trim() || body.customerFirstName?.trim())
  if (
    !body.staffId ||
    !body.serviceId ||
    !body.date ||
    !body.startTime ||
    !hasName ||
    !body.customerPhone?.trim()
  ) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  try {
    const row = await createAppointment({
      staffId: body.staffId,
      serviceId: body.serviceId,
      date: body.date,
      startTime: body.startTime,
      customerName: body.customerName,
      customerFirstName: body.customerFirstName,
      customerLastName: body.customerLastName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      customerNotes: body.customerNotes,
      notes: body.notes,
      customerLocale: body.customerLocale,
      forStaffPortal: true,
    })
    return c.json({ appointment: rowToPublic(row) }, 201)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: adminScheduleErrors[code] ?? 'No se pudo guardar la cita' }, 409)
  }
})

app.patch('/api/schedule/appointments/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{
    staffId?: string
    serviceId?: string
    date?: string
    startTime?: string
    customerName?: string
    customerFirstName?: string
    customerLastName?: string
    customerPhone?: string
    customerEmail?: string | null
    customerNotes?: string | null
    notes?: string | null
    customerLocale?: 'es' | 'en'
    notifyCustomerWhatsApp?: boolean
  }>()
  try {
    const row = await updateAppointmentForAdmin(c.req.param('id'), body)
    return c.json({ appointment: rowToPublic(row) })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: adminScheduleErrors[code] ?? 'No se pudo actualizar' }, 409)
  }
})

app.get('/api/schedule/blocks/:id/series', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const meta = await getBlockSeriesMeta(c.req.param('id'))
  if (!meta) return c.json({ error: 'Bloqueo no encontrado' }, 404)
  return c.json({ series: meta })
})

app.post('/api/schedule/blocks', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{
    staffId: string
    date: string
    startTime: string
    endTime: string
    note?: string
    scope?: BlockScope
    endDate?: string
  }>()
  if (!body.staffId || !body.date || !body.startTime || !body.endTime) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  const scope = body.scope ?? 'single'
  if (scope !== 'single' && scope !== 'range' && scope !== 'weekly') {
    return c.json({ error: adminScheduleErrors.ALCANCE_INVALIDO }, 400)
  }
  if (scope === 'range' && !body.endDate) {
    return c.json({ error: 'Falta endDate para el rango' }, 400)
  }
  try {
    const row = await createStaffBlock({
      staffId: body.staffId,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      note: body.note,
      scope,
      endDate: body.endDate,
    })
    const meta = await getBlockSeriesMeta(row.id)
    return c.json({ block: rowBlockToPublic(row), series: meta }, 201)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: adminScheduleErrors[code] ?? 'No se pudo bloquear' }, 409)
  }
})

app.patch('/api/schedule/blocks/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{ note?: string | null; mode?: UpdateBlockNoteMode }>()
  const mode = body.mode ?? 'single'
  if (mode !== 'single' && mode !== 'series') {
    return c.json({ error: 'mode debe ser single o series' }, 400)
  }
  const row = await updateStaffBlockNote(c.req.param('id'), body.note ?? null, mode)
  if (!row) return c.json({ error: 'Bloqueo no encontrado' }, 404)
  return c.json({ block: rowBlockToPublic(row) })
})

app.delete('/api/schedule/blocks/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const mode = (c.req.query('mode') ?? 'single') as DeleteBlockMode
  if (mode !== 'single' && mode !== 'series') {
    return c.json({ error: 'mode debe ser single o series' }, 400)
  }
  if (!(await deleteStaffBlockById(c.req.param('id'), mode))) {
    return c.json({ error: 'Bloqueo no encontrado' }, 404)
  }
  return c.json({ ok: true })
})

app.patch('/api/appointments/:id/cancel', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const body = await c.req.json().catch(() => ({}))
  const notifyCustomer =
    typeof body === 'object' &&
    body !== null &&
    (body as { notifyCustomerWhatsApp?: boolean }).notifyCustomerWhatsApp === true

  const row = await cancelAppointment(c.req.param('id'), { notifyCustomer })
  if (!row) {
    return c.json({ error: 'Cita no encontrada' }, 404)
  }

  return c.json({ appointment: rowToPublic(row) })
})

app.patch('/api/appointments/:id/no-show', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const body = await c.req.json().catch(() => ({}))
  const sendWhatsApp =
    typeof body === 'object' &&
    body !== null &&
    (body as { sendWhatsApp?: boolean }).sendWhatsApp === true

  const row = await markAppointmentNoShow(c.req.param('id'), { sendWhatsApp })
  if (!row) {
    return c.json({ error: 'Cita no encontrada' }, 404)
  }

  return c.json({ appointment: rowToPublic(row) })
})

app.delete('/api/appointments/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  if (!(await deleteAppointmentById(c.req.param('id')))) {
    return c.json({ error: 'Cita no encontrada' }, 404)
  }

  return c.json({ ok: true })
})

function customerPage(
  title: string,
  bodyHtml: string,
  locale: Locale,
  options?: { pageUrl?: string; description?: string },
) {
  return customerPageShell(title, bodyHtml, locale, options)
}

type CustomerPageStatus = 200 | 400 | 404 | 409

function replyCustomerPage(
  c: { req: { url: string; path: string; query: (key: string) => string | undefined } },
  title: string,
  bodyHtml: string,
  locale: Locale,
  status?: CustomerPageStatus,
) {
  return c.html(
    customerPage(title, bodyHtml, locale, {
      pageUrl: customerPageUrlFromRequest(c.req.url, c.req.path, locale),
    }),
    status,
  )
}

function cp(locale: Locale) {
  return getTranslation(locale).customerPages
}

/** Página de confirmación de cancelación (enlace enviado por WhatsApp). */
app.get('/c/:code', async (c) => {
  const queryLang = c.req.query('lang')
  const id = decodeId(c.req.param('code'))
  const token = c.req.query('t')
  if (!id || !verifyCancelToken(id, token)) {
    const locale = resolvePageLocale(null, queryLang)
    const page = renderInvalidLinkPage(locale, 'cancel')
    return c.html(page.html, 400)
  }

  const row = await getAppointmentById(id)
  const locale = resolvePageLocale(row, queryLang)
  if (!row) {
    const page = renderNotFoundPage(locale)
    return c.html(page.html, 404)
  }

  if (row.status === 'cancelled') {
    const t = cp(locale).alreadyCancelled
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.headingDone)}</h1><p>${escapeHtml(t.bodyDone)}</p>`,
      locale,
    )
  }

  const manageUrl = buildManageUrl(row)
  const t = cp(locale).cancel

  return replyCustomerPage(
    c,
    t.title,
    `<h1>${escapeHtml(t.heading)}</h1>
     ${appointmentDetailHtml(row, locale)}
     <form method="POST" action="/c/${encodeURIComponent(c.req.param('code'))}${locale === 'en' ? '?lang=en' : ''}">
       <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
       <button class="btn btn-danger" type="submit">${escapeHtml(t.confirmButton)}</button>
     </form>
     ${backToManageLink(manageUrl, locale)}
     <p class="muted">${escapeHtml(t.hint)}</p>`,
    locale,
  )
})

app.post('/c/:code', async (c) => {
  const queryLang = c.req.query('lang')
  const id = decodeId(c.req.param('code'))
  const body = await c.req.parseBody()
  const token = typeof body.t === 'string' ? body.t : undefined
  if (!id || !verifyCancelToken(id, token)) {
    const locale = resolvePageLocale(null, queryLang)
    const page = renderInvalidLinkPage(locale, 'action')
    return c.html(page.html, 400)
  }

  const existing = await getAppointmentById(id)
  const locale = resolvePageLocale(existing, queryLang)
  if (!existing) {
    const page = renderNotFoundPage(locale)
    return c.html(page.html, 404)
  }
  if (existing.status === 'cancelled') {
    const t = cp(locale).alreadyCancelled
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.headingWas)}</h1><p>${escapeHtml(t.bodyThanks)}</p>`,
      locale,
    )
  }

  await cancelAppointment(id, { notifyCustomer: true })
  const t = cp(locale).cancel
  return replyCustomerPage(
    c,
    t.successTitle,
    `<h1>${escapeHtml(t.successHeading)}</h1><p>${escapeHtml(t.successBody)}</p><p>${escapeHtml(t.successFooter)}</p>`,
    locale,
  )
})

/** Confirmación antes de aplicar un cambio de cita (cliente). */
app.get('/m/:code/confirm', async (c) => {
  const queryLang = c.req.query('lang')
  const code = c.req.param('code')
  const token = c.req.query('t')
  const date = c.req.query('date')
  const startTime = c.req.query('startTime')
  const staffId = c.req.query('staffId')
  const id = decodeId(code)

  if (!id || !verifyCancelToken(id, token)) {
    const locale = resolvePageLocale(null, queryLang)
    const page = renderInvalidLinkPage(locale, 'confirm')
    return c.html(page.html, 400)
  }

  if (!date || !startTime || !staffId) {
    const row = await getAppointmentById(id)
    const locale = resolvePageLocale(row, queryLang)
    const t = cp(locale).incomplete
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(t.bodyStaffDayTime)}</p>`,
      locale,
      400,
    )
  }

  const row = await getAppointmentById(id)
  const locale = resolvePageLocale(row, queryLang)
  if (!row || row.status === 'cancelled') {
    const page = renderNotFoundPage(locale, true)
    return c.html(page.html, 404)
  }

  const staff = await getStaff(staffId)
  const t = cp(locale)
  const staffName = escapeHtml(staff?.name ?? row.staff_name ?? '')
  const dateLabel = escapeHtml(formatDisplayDate(date, locale))
  const timeRange = escapeHtml(
    formatAppointmentTimeRange(row.service_id, startTime, row.duration_minutes, locale, {
      colorGroupRole: row.color_group_role,
    }),
  )
  const service = escapeHtml(row.service_name)
  const langSuffix = locale === 'en' ? '&lang=en' : ''
  const backUrl = `/m/${encodeURIComponent(code)}?t=${encodeURIComponent(token ?? '')}&date=${encodeURIComponent(date)}&staffId=${encodeURIComponent(staffId)}${langSuffix}`

  return replyCustomerPage(
    c,
    t.confirmChange.title,
    `<h1>${escapeHtml(t.confirmChange.heading)}</h1>
     <p>${escapeHtml(t.confirmChange.intro)}</p>
     <div class="detail">
       <p>💇 ${service}</p>
       <p>${escapeHtml(t.withStaff(staff?.name ?? row.staff_name ?? 'Superpelu'))}</p>
       <p>📅 ${dateLabel}</p>
       <p>🕐 ${timeRange}</p>
     </div>
     <form method="POST" action="/m/${encodeURIComponent(code)}${locale === 'en' ? '?lang=en' : ''}">
       <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
       <input type="hidden" name="date" value="${escapeHtml(date)}">
       <input type="hidden" name="startTime" value="${escapeHtml(startTime)}">
       <input type="hidden" name="staffId" value="${escapeHtml(staffId)}">
       <button class="btn btn-primary" type="submit">${escapeHtml(t.confirmChange.submit)}</button>
     </form>
     <p style="margin-top:1rem"><a class="btn btn-secondary" href="${escapeHtml(backUrl)}">${escapeHtml(t.confirmChange.back)}</a></p>`,
    locale,
  )
})

/** Página para que el cliente cambie la fecha/hora o vaya a cancelar (enlace en WhatsApp). */
app.get('/m/:code', async (c) => {
  const queryLang = c.req.query('lang')
  const code = c.req.param('code')
  const token = c.req.query('t')
  const id = decodeId(code)
  if (!id || !verifyCancelToken(id, token)) {
    const locale = resolvePageLocale(null, queryLang)
    const page = renderInvalidLinkPage(locale, 'manage')
    return c.html(page.html, 400)
  }

  const row = await getAppointmentById(id)
  const locale = resolvePageLocale(row, queryLang)
  if (!row) {
    const page = renderNotFoundPage(locale)
    return c.html(page.html, 404)
  }

  if (row.status === 'cancelled') {
    const t = cp(locale).alreadyCancelled
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.headingIs)}</h1><p>${escapeHtml(t.bodyBookAgain)}</p>`,
      locale,
    )
  }

  const langSuffix = locale === 'en' ? '&lang=en' : ''
  const cancelUrl = `${publicBaseUrl() || ''}/c/${encodeURIComponent(code)}?t=${encodeURIComponent(token ?? '')}${langSuffix}`
  const t = cp(locale).manage
  const staffOptions = await listStaffForService(row.service_id)
  let selectedStaffId = (c.req.query('staffId') ?? row.staff_id ?? '').trim()
  if (!staffOptions.some((s) => s.id === selectedStaffId)) {
    selectedStaffId = row.staff_id ?? staffOptions[0]?.id ?? ''
  }
  const selectedStaffRaw =
    staffOptions.find((s) => s.id === selectedStaffId)?.name ?? row.staff_name ?? ''

  const today = todaySalon()
  const maxDate = addDaysToDateString(today, schedule.maxDaysAhead)
  let selectedDate = (c.req.query('date') ?? row.appointment_date).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) selectedDate = row.appointment_date
  if (selectedDate < today) selectedDate = today
  if (selectedDate > maxDate) selectedDate = maxDate

  const staffSelectHtml =
    staffOptions.length > 0
      ? `<p class="section-label">${escapeHtml(t.staffSection)}</p>
       <form method="GET" action="/m/${encodeURIComponent(code)}" class="staff-form">
         <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
         <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
         ${locale === 'en' ? '<input type="hidden" name="lang" value="en">' : ''}
         <select name="staffId" aria-label="${escapeHtml(t.staffAria)}" onchange="this.form.submit()">
           ${staffOptions
             .map(
               (s) =>
                 `<option value="${escapeHtml(s.id)}"${s.id === selectedStaffId ? ' selected' : ''}>${escapeHtml(s.name)}</option>`,
             )
             .join('')}
         </select>
       </form>`
      : ''

  let slotsHtml = ''
  if (!isSalonOpenDay(selectedDate) || !isWithinSalonBookingWindow(selectedDate)) {
    slotsHtml = `<p class="muted">${escapeHtml(t.salonClosed)}</p>`
  } else if (selectedStaffId) {
    const slots = await getAvailableSlots(selectedDate, row.service_id, selectedStaffId, {
      excludeAppointmentId: row.id,
    })
    if (slots.length === 0) {
      slotsHtml = `<p class="muted">${escapeHtml(t.noSlots)}</p>`
    } else {
      slotsHtml =
        `<p class="section-label">${escapeHtml(t.hourSection)}</p><div class="slots">` +
        slots
          .map(
            (slot) =>
              `<form method="GET" action="/m/${encodeURIComponent(code)}/confirm" class="slot-form">
                 <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
                 <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
                 <input type="hidden" name="staffId" value="${escapeHtml(selectedStaffId)}">
                 ${locale === 'en' ? '<input type="hidden" name="lang" value="en">' : ''}
                 <button class="slot-btn" type="submit" name="startTime" value="${escapeHtml(slot)}">${escapeHtml(slot)}</button>
               </form>`,
          )
          .join('') +
        '</div>'
    }
  }

  const dateLabel = escapeHtml(formatDisplayDate(row.appointment_date, locale))
  const timeRange = escapeHtml(
    formatAppointmentTimeRange(row.service_id, row.start_time, row.duration_minutes, locale, {
      colorGroupRole: row.color_group_role,
    }),
  )
  const service = escapeHtml(row.service_name)

  return replyCustomerPage(
    c,
    cp(locale).manage.title,
    `<h1>${escapeHtml(t.heading)}</h1>
     <div class="detail">
       <p>💇 ${service}</p>
       <p>${escapeHtml(cp(locale).withStaff(selectedStaffRaw))}</p>
       <p>📅 ${dateLabel}</p>
       <p>🕐 ${timeRange}</p>
     </div>
     <p class="section-label">${escapeHtml(t.modifySection)}</p>
     ${staffSelectHtml}
     <p class="section-label">${escapeHtml(t.daySection)}</p>
     <form method="GET" action="/m/${encodeURIComponent(code)}" class="date-form">
       <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
       <input type="hidden" name="staffId" value="${escapeHtml(selectedStaffId)}">
       ${locale === 'en' ? '<input type="hidden" name="lang" value="en">' : ''}
       <input type="date" name="date" value="${escapeHtml(selectedDate)}" min="${today}" max="${maxDate}" onchange="this.form.submit()">
     </form>
     ${slotsHtml}
     <p class="section-label">${escapeHtml(t.cancelSection)}</p>
     <a class="btn btn-danger" href="${escapeHtml(cancelUrl)}">${escapeHtml(t.cancelButton)}</a>
     <p class="muted">${escapeHtml(t.callSalon)}</p>`,
    locale,
  )
})

app.post('/m/:code', async (c) => {
  const queryLang = c.req.query('lang')
  const code = c.req.param('code')
  const id = decodeId(code)
  const body = await c.req.parseBody()
  const token = typeof body.t === 'string' ? body.t : undefined
  const date = typeof body.date === 'string' ? body.date : undefined
  const startTime = typeof body.startTime === 'string' ? body.startTime : undefined
  const staffId = typeof body.staffId === 'string' ? body.staffId : undefined

  if (!id || !verifyCancelToken(id, token)) {
    const locale = resolvePageLocale(null, queryLang)
    const page = renderInvalidLinkPage(locale, 'action')
    return c.html(page.html, 400)
  }

  if (!date || !startTime) {
    const existing = await getAppointmentById(id)
    const locale = resolvePageLocale(existing, queryLang)
    const t = cp(locale).incomplete
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(t.bodyDateTime)}</p>`,
      locale,
      400,
    )
  }

  const existing = await getAppointmentById(id)
  const locale = resolvePageLocale(existing, queryLang)

  try {
    const row = await rescheduleAppointmentByCustomer(id, { date, startTime, staffId })
    const manageUrl = buildManageUrl(row)
    const t = cp(locale).updated
    const dateLabel = escapeHtml(formatDisplayDate(row.appointment_date, locale))
    const timeRange = escapeHtml(
      formatAppointmentTimeRange(row.service_id, row.start_time, row.duration_minutes, locale, {
        colorGroupRole: row.color_group_role,
      }),
    )

    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1>
       <p>${escapeHtml(t.intro)}</p>
       <div class="detail">
         <p>📅 ${dateLabel}</p>
         <p>🕐 ${timeRange}</p>
         <p>💇 ${escapeHtml(row.service_name)}</p>
         ${row.staff_name ? `<p>${escapeHtml(cp(locale).withStaff(row.staff_name))}</p>` : ''}
       </div>
       ${backToManageLink(manageUrl, locale)}
       <p class="muted">${escapeHtml(t.closing)}</p>`,
      locale,
    )
  } catch (err) {
    const codeErr = err instanceof Error ? err.message : 'ERROR'
    const message = manageErrorMessage(codeErr, locale)
    const langSuffix = locale === 'en' ? '&lang=en' : ''
    const backUrl = `/m/${encodeURIComponent(code)}?t=${encodeURIComponent(token ?? '')}&date=${encodeURIComponent(date)}${staffId ? `&staffId=${encodeURIComponent(staffId)}` : ''}${langSuffix}`
    const t = cp(locale).changeFailed
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(message)}</p>
         <p style="margin-top:1rem"><a class="btn btn-secondary" href="${escapeHtml(backUrl)}">${escapeHtml(t.back)}</a></p>`,
      locale,
      409,
    )
  }
})

/** Archivo .ics para añadir la cita al calendario nativo del móvil. */
app.get('/a/:code', async (c) => {
  const id = decodeId(c.req.param('code'))
  if (!id) return c.text('Enlace no válido', 400)

  const row = await getAppointmentById(id)
  if (!row) return c.text('Cita no encontrada', 404)

  c.header('Content-Type', 'text/calendar; charset=utf-8')
  c.header('Content-Disposition', 'attachment; filename="cita-superpelu.ics"')
  return c.body(buildIcs(row))
})

const distPath = path.resolve(process.cwd(), 'dist')
const hasDist = fs.existsSync(path.join(distPath, 'index.html'))

const staticMime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

function resolveDistFile(urlPath: string): string | null {
  const relative = urlPath.replace(/^\//, '')
  if (!relative || relative.includes('..')) {
    return null
  }
  const filePath = path.join(distPath, relative)
  if (!filePath.startsWith(distPath)) {
    return null
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return filePath
  }
  return null
}

if (hasDist) {
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Ruta API no encontrada' }, 404)
    }
    const filePath = resolveDistFile(c.req.path)
    if (filePath) {
      const ext = path.extname(filePath).toLowerCase()
      const type = staticMime[ext] ?? 'application/octet-stream'
      return c.body(fs.readFileSync(filePath), 200, { 'Content-Type': type })
    }
    const html = injectSpaLinkPreviewMeta(
      fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8'),
      c.req.path,
    )
    return c.html(html)
  })
} else {
  console.warn('Superpelu: dist/index.html no encontrado — solo API disponible')
}

async function main() {
  await initDatabase()
  logOpenWaStartup()
  logEmailStartup()
  console.log(`Superpelu en http://0.0.0.0:${port}${hasDist ? ' (web + API)' : ' (solo API)'}`)
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
  startOpenWaKeepAlive()
  startReminderScheduler()
}

main().catch((err) => {
  console.error('Superpelu: error al iniciar', err)
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
  if (code === '28P01') {
    console.error(`
Supabase rechazó la contraseña (usuario en logs arriba).
  1. Supabase → Project Settings → Database → Reset database password
  2. Connect → Session → copia la URI (usuario postgres.[ref], puerto 5432)
  3. Coolify → DATABASE_URL = esa URI, sin comillas, variable de runtime
  4. Redeploy (no solo Restart)
`)
  }
  process.exit(1)
})
