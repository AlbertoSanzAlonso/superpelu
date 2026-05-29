import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fs from 'node:fs'
import path from 'node:path'
import { listActiveServiceCategories } from './serviceCategories.js'
import { listActiveServices } from './services.js'
import { listStaffForService } from './staff.js'
import { me } from './me.js'
import { listStaffDaySchedules } from './staffSchedule.js'
import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  getAvailableSlots,
  listAppointments,
  rowToPublic,
  updateAppointmentForAdmin,
} from './appointments.js'
import { buildIcs, decodeId, verifyCancelToken } from './appointmentLinks.js'
import { formatDisplayDate } from '../src/lib/dates.ts'
import { formatAppointmentTimeRange } from '../src/lib/bookingOccupancy.ts'
import {
  createStaffBlock,
  deleteStaffBlockById,
  getBlockSeriesMeta,
  rowBlockToPublic,
  type BlockScope,
  type DeleteBlockMode,
} from './staffBlocks.js'
import { listServicesForStaff } from './staff.js'
import { getCustomer, listCustomerAppointments, listCustomers } from './customers.js'
import { initDatabase, sql } from './db.js'
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
} from './openwa.js'
import { processDueReminders, startReminderScheduler } from './reminderScheduler.js'
import { logEmailStartup } from './appointmentEmail.js'

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
  return c.json({ staff: await listStaffForService(serviceId) })
})

app.get('/api/slots', async (c) => {
  const date = c.req.query('date')
  const serviceId = c.req.query('serviceId')
  const staffId = c.req.query('staffId')

  if (!date || !serviceId || !staffId) {
    return c.json({ error: 'Faltan date, serviceId o staffId' }, 400)
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

app.get('/api/customers/:phone', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const phone = decodeURIComponent(c.req.param('phone'))
  const customer = await getCustomer(phone)
  if (!customer) return c.json({ error: 'Cliente no encontrado' }, 404)
  const appointmentRows = await listCustomerAppointments(phone)
  const appointments = appointmentRows.map(rowToPublic)
  return c.json({
    customer: {
      phone: customer.phone,
      firstName: customer.first_name,
      lastName: customer.last_name ?? '',
      email: customer.email,
      notes: customer.notes,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
    },
    appointments,
  })
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
    notes?: string
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
      notes: body.notes,
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
    serviceId?: string
    date?: string
    startTime?: string
    customerName?: string
    customerFirstName?: string
    customerLastName?: string
    customerPhone?: string
    customerEmail?: string | null
    notes?: string | null
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

  const row = await cancelAppointment(c.req.param('id'))
  if (!row) {
    return c.json({ error: 'Cita no encontrada' }, 404)
  }

  return c.json({ appointment: rowToPublic(row) })
})

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cancelPage(title: string, bodyHtml: string, status: 200 | 400 | 404 = 200) {
  return [
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title} · Superpelu</title>`,
    '<style>',
    'body{font-family:system-ui,-apple-system,sans-serif;background:#faf7f5;color:#2b2b2b;',
    'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}',
    '.card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);max-width:420px;width:100%;padding:2rem;text-align:center}',
    'h1{font-size:1.4rem;margin:0 0 1rem}p{line-height:1.5;margin:.5rem 0}',
    '.detail{background:#f4efec;border-radius:10px;padding:1rem;margin:1rem 0;text-align:left}',
    '.btn{display:inline-block;border:0;border-radius:10px;padding:.85rem 1.4rem;font-size:1rem;',
    'font-weight:600;cursor:pointer;text-decoration:none;margin-top:.5rem}',
    '.btn-danger{background:#c0392b;color:#fff}.btn-secondary{background:#e7e0db;color:#2b2b2b}',
    '.muted{color:#888;font-size:.9rem}',
    '</style></head><body><div class="card">',
    bodyHtml,
    '</div></body></html>',
  ].join('')
}

/** Página de confirmación de cancelación (enlace enviado por WhatsApp). */
app.get('/c/:code', async (c) => {
  const id = decodeId(c.req.param('code'))
  const token = c.req.query('t')
  if (!id || !verifyCancelToken(id, token)) {
    return c.html(
      cancelPage('Enlace no válido', '<h1>Enlace no válido</h1><p>Este enlace de cancelación no es correcto o ha caducado. Llama al salón si necesitas ayuda.</p>'),
      400,
    )
  }

  const row = await getAppointmentById(id)
  if (!row) {
    return c.html(cancelPage('Cita no encontrada', '<h1>Cita no encontrada</h1><p>No hemos encontrado esta cita.</p>'), 404)
  }

  if (row.status === 'cancelled') {
    return c.html(
      cancelPage('Cita cancelada', '<h1>Esta cita ya está cancelada</h1><p>No hay nada más que hacer. ¡Gracias!</p>'),
    )
  }

  const dateLabel = escapeHtml(formatDisplayDate(row.appointment_date))
  const timeRange = escapeHtml(
    formatAppointmentTimeRange(row.service_id, row.start_time, row.duration_minutes),
  )
  const service = escapeHtml(row.service_name)
  const staff = escapeHtml(row.staff_name ?? '')

  return c.html(
    cancelPage(
      'Cancelar cita',
      `<h1>¿Cancelar tu cita?</h1>
       <div class="detail">
         <p>📅 ${dateLabel}</p>
         <p>🕐 ${timeRange}</p>
         <p>💇 ${service}</p>
         ${staff ? `<p>👤 Con ${staff}</p>` : ''}
       </div>
       <form method="POST" action="/c/${encodeURIComponent(c.req.param('code'))}">
         <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
         <button class="btn btn-danger" type="submit">Sí, cancelar la cita</button>
       </form>
       <p class="muted">Si fue un error, cierra esta página y tu cita seguirá activa.</p>`,
    ),
  )
})

app.post('/c/:code', async (c) => {
  const id = decodeId(c.req.param('code'))
  const body = await c.req.parseBody()
  const token = typeof body.t === 'string' ? body.t : undefined
  if (!id || !verifyCancelToken(id, token)) {
    return c.html(cancelPage('Enlace no válido', '<h1>Enlace no válido</h1><p>No se pudo cancelar.</p>'), 400)
  }

  const existing = await getAppointmentById(id)
  if (!existing) {
    return c.html(cancelPage('Cita no encontrada', '<h1>Cita no encontrada</h1>'), 404)
  }
  if (existing.status === 'cancelled') {
    return c.html(cancelPage('Cita cancelada', '<h1>Esta cita ya estaba cancelada</h1><p>¡Gracias!</p>'))
  }

  await cancelAppointment(id)
  return c.html(
    cancelPage(
      'Cita cancelada',
      '<h1>✅ Cita cancelada</h1><p>Tu cita ha sido cancelada correctamente.</p><p>Si quieres, puedes reservar otra cuando quieras. ¡Gracias!</p>',
    ),
  )
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
    const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8')
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
