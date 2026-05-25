import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fs from 'node:fs'
import path from 'node:path'
import { bookableServices } from './config.js'
import {
  cancelAppointment,
  createAppointment,
  getAvailableSlots,
  listAppointments,
  rowToPublic,
} from './appointments.js'

const app = new Hono()
const adminSecret = process.env.ADMIN_SECRET ?? 'superpelu-dev-admin'
const port = Number(process.env.PORT ?? 3001)

app.use(
  '/api/*',
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

function requireAdmin(authorization: string | undefined): boolean {
  return authorization === `Bearer ${adminSecret}`
}

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/services', (c) => c.json({ services: bookableServices }))

app.get('/api/slots', (c) => {
  const date = c.req.query('date')
  const serviceId = c.req.query('serviceId')

  if (!date || !serviceId) {
    return c.json({ error: 'Faltan date o serviceId' }, 400)
  }

  return c.json({ date, serviceId, slots: getAvailableSlots(date, serviceId) })
})

app.post('/api/appointments', async (c) => {
  const body = await c.req.json<{
    serviceId: string
    date: string
    startTime: string
    customerName: string
    customerPhone: string
    customerEmail?: string
    notes?: string
  }>()

  if (
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
      serviceId: body.serviceId as 'color',
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
