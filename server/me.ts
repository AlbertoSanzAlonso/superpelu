import { Hono } from 'hono'
import {
  createAppointment,
  deleteAppointmentForStaff,
  getAvailableSlots,
  listAppointmentsForStaff,
  rowToPublic,
  updateAppointmentForStaff,
} from './appointments.js'
import { getStaffDaySchedule } from './staffSchedule.js'
import { listServicesForStaff } from './staff.js'
import {
  createStaffBlock,
  deleteStaffBlock,
  getBlockSeriesMeta,
  getBlocksForStaffBetween,
  rowBlockToPublic,
  type BlockScope,
  type DeleteBlockMode,
} from './staffBlocks.js'
import { loginStaff, logoutStaff, resolveStaffSession } from './staffAuth.js'
import type { StaffRow } from './db.js'

const me = new Hono()

function getBearer(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  const auth = c.req.header('Authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined
}

async function requireStaff(c: Parameters<Parameters<typeof me.get>[1]>[0]) {
  const staff = await resolveStaffSession(getBearer(c))
  if (!staff) {
    return { error: c.json({ error: 'No autorizado' }, 401) as Response, staff: null as StaffRow | null }
  }
  return { error: null, staff }
}

const errorMessages: Record<string, string> = {
  TELEFONO_INVALIDO: 'Teléfono no válido (móvil español)',
  NOMBRE_INVALIDO: 'Indica al menos el nombre',
  CREDENCIALES_INVALIDAS: 'Nombre o contraseña incorrectos',
  SERVICIO_INVALIDO: 'Servicio no válido',
  STAFF_NO_REALIZA_SERVICIO: 'No realizas ese servicio',
  FECHA_INVALIDA: 'Fecha no disponible',
  HORARIO_NO_DISPONIBLE: 'Ese horario no está disponible',
  CITA_NO_ENCONTRADA: 'Cita no encontrada',
  RANGO_INVALIDO: 'La hora de fin debe ser posterior al inicio',
  BLOQUEO_SOLAPADO: 'Ya hay un bloqueo en ese tramo',
  FECHA_FIN_INVALIDA: 'La fecha de fin debe ser igual o posterior al inicio',
}

me.post('/auth/staff/login', async (c) => {
  const body = await c.req.json<{ name?: string; password?: string }>()
  if (!body.name?.trim() || !body.password) {
    return c.json({ error: 'Introduce nombre y contraseña' }, 400)
  }
  try {
    const result = await loginStaff(body.name, body.password)
    return c.json(result)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: errorMessages[code] ?? 'No se pudo iniciar sesión' }, 401)
  }
})

me.post('/auth/staff/logout', async (c) => {
  const token = getBearer(c)
  if (token) await logoutStaff(token)
  return c.json({ ok: true })
})

me.get('/me/verify', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  return c.json({ ok: true, staff: { id: staff!.id, name: staff!.name, role: staff!.role } })
})

me.get('/me/services', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  return c.json({ services: await listServicesForStaff(staff!.id) })
})

me.get('/me/schedule', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const date = c.req.query('date')
  if (!date) return c.json({ error: 'Falta date' }, 400)
  const schedule = await getStaffDaySchedule(staff!.id, date)
  return c.json({ date, schedule })
})

me.get('/me/slots', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const date = c.req.query('date')
  const serviceId = c.req.query('serviceId')
  const exclude = c.req.query('excludeAppointmentId')
  if (!date || !serviceId) return c.json({ error: 'Faltan date o serviceId' }, 400)
  return c.json({
    slots: await getAvailableSlots(date, serviceId, staff!.id, {
      forStaffPortal: true,
      excludeAppointmentId: exclude,
    }),
  })
})

me.get('/me/appointments', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 10)
  const to = c.req.query('to') ?? from
  const rows = await listAppointmentsForStaff(staff!.id, from, to)
  return c.json({ appointments: rows.map(rowToPublic) })
})

me.post('/me/appointments', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const body = await c.req.json<{
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
  if (!body.serviceId || !body.date || !body.startTime || !hasName || !body.customerPhone?.trim()) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  try {
    const row = await createAppointment({
      ...body,
      staffId: staff!.id,
      customerPhone: body.customerPhone ?? '',
      forStaffPortal: true,
    })
    return c.json({ appointment: rowToPublic(row) }, 201)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: errorMessages[code] ?? 'No se pudo crear la cita' }, 409)
  }
})

me.patch('/me/appointments/:id', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
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
    const row = await updateAppointmentForStaff(c.req.param('id'), staff!.id, body)
    return c.json({ appointment: rowToPublic(row) })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: errorMessages[code] ?? 'No se pudo actualizar' }, 409)
  }
})

me.delete('/me/appointments/:id', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const ok = await deleteAppointmentForStaff(c.req.param('id'), staff!.id)
  if (!ok) return c.json({ error: 'Cita no encontrada' }, 404)
  return c.json({ ok: true })
})

me.get('/me/blocks', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 10)
  const to = c.req.query('to') ?? from
  const blocks = (await getBlocksForStaffBetween(staff!.id, from, to)).map(rowBlockToPublic)
  return c.json({ blocks })
})

me.get('/me/blocks/:id/series', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const meta = await getBlockSeriesMeta(c.req.param('id'), staff!.id)
  if (!meta) return c.json({ error: 'Bloqueo no encontrado' }, 404)
  return c.json({ series: meta })
})

me.post('/me/blocks', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const body = await c.req.json<{
    date: string
    startTime: string
    endTime: string
    note?: string
    scope?: BlockScope
    endDate?: string
  }>()
  if (!body.date || !body.startTime || !body.endTime) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  const scope = body.scope ?? 'single'
  try {
    const row = await createStaffBlock({
      staffId: staff!.id,
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      note: body.note,
      scope,
      endDate: body.endDate,
    })
    const meta = await getBlockSeriesMeta(row.id, staff!.id)
    return c.json({ block: rowBlockToPublic(row), series: meta }, 201)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: errorMessages[code] ?? 'No se pudo bloquear' }, 409)
  }
})

me.delete('/me/blocks/:id', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const mode = (c.req.query('mode') ?? 'single') as DeleteBlockMode
  const ok = await deleteStaffBlock(c.req.param('id'), staff!.id, mode)
  if (!ok) return c.json({ error: 'Bloqueo no encontrado' }, 404)
  return c.json({ ok: true })
})

export { me }
