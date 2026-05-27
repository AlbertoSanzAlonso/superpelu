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
import { getCustomer, listCustomerAppointments, listCustomers } from './customers.js'
import { initDatabase } from './db.js'

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
  console.log(`Superpelu en http://0.0.0.0:${port}${hasDist ? ' (web + API)' : ' (solo API)'}`)
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' })
}

main().catch((err) => {
  console.error('Superpelu: error al iniciar', err)
  process.exit(1)
})
