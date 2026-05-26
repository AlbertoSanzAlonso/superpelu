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
  getAvailableSlots,
  listAppointments,
  rowToPublic,
  updateAppointmentForAdmin,
} from './appointments.js'
import {
  createStaffBlock,
  deleteStaffBlockById,
  getBlockSeriesMeta,
  rowBlockToPublic,
  type BlockScope,
  type DeleteBlockMode,
} from './staffBlocks.js'
import { listServicesForStaff } from './staff.js'

const app = new Hono()
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

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/auth/verify', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }
  return c.json({ ok: true })
})

app.get('/api/services', (c) => c.json({ services: listActiveServices({ onlineOnly: true }) }))

app.get('/api/service-categories', (c) =>
  c.json({ categories: listActiveServiceCategories() }),
)

app.get('/api/staff', (c) => {
  const serviceId = c.req.query('serviceId')
  if (!serviceId) {
    return c.json({ error: 'Falta serviceId' }, 400)
  }
  return c.json({ staff: listStaffForService(serviceId) })
})

app.get('/api/slots', (c) => {
  const date = c.req.query('date')
  const serviceId = c.req.query('serviceId')
  const staffId = c.req.query('staffId')

  if (!date || !serviceId || !staffId) {
    return c.json({ error: 'Faltan date, serviceId o staffId' }, 400)
  }

  return c.json({ date, serviceId, staffId, slots: getAvailableSlots(date, serviceId, staffId) })
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
    const row = createAppointment({
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
    }
    return c.json({ error: messages[code] ?? 'No se pudo crear la cita' }, 409)
  }
})

app.get('/api/appointments', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 10)
  const to = c.req.query('to') ?? from

  const appointments = listAppointments(from, to).map(rowToPublic)
  return c.json({ appointments })
})

/** Franja del personal + citas que la ocupan + huecos libres (admin). */
app.get('/api/schedule/day', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const date = c.req.query('date')
  if (!date) {
    return c.json({ error: 'Falta date' }, 400)
  }

  return c.json({ date, schedules: listStaffDaySchedules(date) })
})

const adminScheduleErrors: Record<string, string> = {
  SERVICIO_INVALIDO: 'Servicio no válido',
  STAFF_INVALIDO: 'Profesional no válido',
  STAFF_NO_REALIZA_SERVICIO: 'Este profesional no realiza ese servicio',
  FECHA_INVALIDA: 'Fecha no disponible',
  HORARIO_NO_DISPONIBLE: 'Ese horario no está disponible',
  CITA_NO_ENCONTRADA: 'Cita no encontrada',
  RANGO_INVALIDO: 'La hora de fin debe ser posterior al inicio',
  BLOQUEO_SOLAPADO: 'Ya hay un bloqueo en ese tramo',
  FECHA_FIN_INVALIDA: 'La fecha de fin debe ser igual o posterior al inicio',
  ALCANCE_INVALIDO: 'Tipo de bloqueo no válido',
}

app.get('/api/schedule/services', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const staffId = c.req.query('staffId')
  if (!staffId) return c.json({ error: 'Falta staffId' }, 400)
  return c.json({ services: listServicesForStaff(staffId) })
})

app.get('/api/schedule/slots', (c) => {
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
    slots: getAvailableSlots(date, serviceId, staffId, {
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
    customerName: string
    customerPhone: string
    customerEmail?: string
    notes?: string
  }>()
  if (
    !body.staffId ||
    !body.serviceId ||
    !body.date ||
    !body.startTime ||
    !body.customerName?.trim() ||
    !body.customerPhone?.trim()
  ) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  try {
    const row = createAppointment({
      staffId: body.staffId,
      serviceId: body.serviceId,
      date: body.date,
      startTime: body.startTime,
      customerName: body.customerName,
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
    customerPhone?: string
    customerEmail?: string | null
    notes?: string | null
  }>()
  try {
    const row = updateAppointmentForAdmin(c.req.param('id'), body)
    return c.json({ appointment: rowToPublic(row) })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: adminScheduleErrors[code] ?? 'No se pudo actualizar' }, 409)
  }
})

app.get('/api/schedule/blocks/:id/series', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const meta = getBlockSeriesMeta(c.req.param('id'))
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
    const row = createStaffBlock({
      staffId: body.staffId,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      note: body.note,
      scope,
      endDate: body.endDate,
    })
    const meta = getBlockSeriesMeta(row.id)
    return c.json({ block: rowBlockToPublic(row), series: meta }, 201)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: adminScheduleErrors[code] ?? 'No se pudo bloquear' }, 409)
  }
})

app.delete('/api/schedule/blocks/:id', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const mode = (c.req.query('mode') ?? 'single') as DeleteBlockMode
  if (mode !== 'single' && mode !== 'series') {
    return c.json({ error: 'mode debe ser single o series' }, 400)
  }
  if (!deleteStaffBlockById(c.req.param('id'), mode)) {
    return c.json({ error: 'Bloqueo no encontrado' }, 404)
  }
  return c.json({ ok: true })
})

app.patch('/api/appointments/:id/cancel', (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) {
    return c.json({ error: 'No autorizado' }, 401)
  }

  const row = cancelAppointment(c.req.param('id'))
  if (!row) {
    return c.json({ error: 'Cita no encontrada' }, 404)
  }

  return c.json({ appointment: rowToPublic(row) })
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

console.log(`Superpelu en http://0.0.0.0:${port}${hasDist ? ' (web + API)' : ' (solo API)'}`)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
