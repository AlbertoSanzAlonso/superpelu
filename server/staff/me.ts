import { Hono } from 'hono'
import {
  createAppointment,
  deleteAppointmentForStaff,
  getAppointmentById,
  getAppointmentSeriesMeta,
  getAvailableSlots,
  getAvailableSlotsForServices,
  getOverHoursSlotsForServices,
  listAppointmentsForStaff,
  markAppointmentNoShow,
  rowToPublic,
  updateAppointmentForStaff,
  type AppointmentSeriesMode,
} from '@server/appointments/index.js'
import { previewRecurringChainConflicts } from '@server/appointments/recurringChain.js'
import { staffPortalBookingHasCustomer } from '@server/appointments/staffBookingValidation.js'
import type { SeriesScope } from '@server/appointments/seriesDates.js'
import { getStaffDaySchedule } from '@server/staff/schedule.js'
import { listServicesForStaff } from '@server/staff/index.js'
import {
  createStaffBlock,
  deleteStaffBlock,
  getBlockSeriesMeta,
  getBlocksForStaffBetween,
  rowBlockToPublic,
  updateStaffBlockNote,
  updateStaffBlockTimes,
  type BlockScope,
  type DeleteBlockMode,
  type UpdateBlockNoteMode,
} from '@server/staff/blocks.js'
import { loginStaff, logoutStaff, resolveStaffSession } from '@server/staff/auth.js'
import type { StaffRow } from '@server/db.js'

const me = new Hono()

function getBearer(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  const auth = c.req.header('Authorization')
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined
}

async function requireStaff(c: {
  req: { header: (name: string) => string | undefined }
  json: (data: unknown, status?: number) => Response
}) {
  const staff = await resolveStaffSession(getBearer(c))
  if (!staff) {
    return { error: c.json({ error: 'No autorizado' }, 401), staff: null as StaffRow | null }
  }
  return { error: null, staff }
}

const errorMessages: Record<string, string> = {
  TELEFONO_INVALIDO: 'Teléfono no válido',
  NOMBRE_INVALIDO: 'Indica al menos el nombre',
  CREDENCIALES_INVALIDAS: 'Nombre o contraseña incorrectos',
  SERVICIO_INVALIDO: 'Servicio no válido',
  STAFF_NO_REALIZA_SERVICIO: 'No realizas ese servicio',
  FECHA_INVALIDA: 'Fecha no disponible',
  HORARIO_NO_DISPONIBLE: 'Ese horario no está disponible',
  HORARIO_ENCADENADO_NO_DISPONIBLE: 'Ese horario no está disponible para todos los tratamientos',
  CITA_NO_ENCONTRADA: 'Cita no encontrada',
  RANGO_INVALIDO: 'La hora de fin debe ser posterior al inicio',
  BLOQUEO_SOLAPADO: 'Ya hay un bloqueo en ese tramo',
  FECHA_FIN_INVALIDA: 'La fecha de fin debe ser igual o posterior al inicio',
  ALCANCE_INVALIDO: 'Tipo de repetición no válido',
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
  const serviceIdsRaw = c.req.query('serviceIds')
  const exclude = c.req.query('excludeAppointmentId')
  if (!date) return c.json({ error: 'Falta date' }, 400)
  const ids = serviceIdsRaw
    ? serviceIdsRaw.split(',').filter(Boolean)
    : serviceId
      ? [serviceId]
      : []
  if (ids.length === 0) return c.json({ error: 'Faltan serviceId o serviceIds' }, 400)
  const slotOptions = { forStaffPortal: true as const, excludeAppointmentId: exclude }
  const slots = ids.length > 1
    ? await getAvailableSlotsForServices(date, ids, staff!.id, slotOptions)
    : await getAvailableSlots(date, ids[0], staff!.id, slotOptions)
  const slotsOverHours = await getOverHoursSlotsForServices(date, ids, staff!.id, slotOptions)
  return c.json({ slots, slotsOverHours })
})

me.get('/me/appointments', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 10)
  const to = c.req.query('to') ?? from
  const rows = await listAppointmentsForStaff(staff!.id, from, to)
  return c.json({ appointments: rows.map(rowToPublic) })
})

me.post('/me/appointments/preview-series', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const body = await c.req.json<{
    serviceIds?: string[]
    serviceStartTimes?: string[]
    serviceDurations?: (number | null)[]
    date: string
    startTime: string
    customerFirstName?: string
    customerLastName?: string
    customerPhone: string
    customerEmail?: string
    customerNotes?: string
    notes?: string
    customerLocale?: 'es' | 'en'
    endDate?: string
    guestCustomer?: boolean
  }>().catch(() => null)
  if (!body || !body.date || !body.startTime || !staffPortalBookingHasCustomer(body)) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  try {
    const serviceIds = body.serviceIds ?? []
    const result = await previewRecurringChainConflicts(
      {
        staffId: staff!.id,
        serviceIds,
        serviceStartTimes: body.serviceStartTimes,
        serviceDurations: body.serviceDurations,
        date: body.date,
        startTime: body.startTime,
        customerFirstName: body.customerFirstName,
        customerLastName: body.customerLastName,
        customerPhone: body.customerPhone ?? '',
        customerEmail: body.customerEmail,
        customerNotes: body.customerNotes,
        notes: body.notes,
        customerLocale: body.customerLocale,
        scope: 'weekly',
        endDate: body.endDate,
        forStaffPortal: true,
        guestCustomer: body.guestCustomer,
      },
      serviceIds,
    )
    return c.json(result)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: code }, 400)
  }
})

me.post('/me/appointments', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const body = await c.req.json<{
    serviceId?: string
    serviceIds?: string[]
    serviceStartTimes?: string[]
    serviceDurations?: (number | null)[]
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
    scope?: SeriesScope
    endDate?: string
    forceSchedule?: boolean
    conflictResolutions?: import('@server/appointments/recurringChain.js').SeriesConflictResolution[]
    guestCustomer?: boolean
  }>()
  const ids = body.serviceIds?.length ? body.serviceIds : body.serviceId ? [body.serviceId] : []
  if (ids.length === 0 || !body.date || !body.startTime || !staffPortalBookingHasCustomer(body)) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  const scope = body.scope ?? 'single'
  if (scope !== 'single' && scope !== 'weekly') {
    return c.json({ error: errorMessages.ALCANCE_INVALIDO }, 400)
  }
  if (scope === 'weekly' && body.endDate && body.endDate < body.date) {
    return c.json({ error: errorMessages.FECHA_FIN_INVALIDA }, 400)
  }
  try {
    const row = await createAppointment({
      serviceIds: ids,
      serviceStartTimes: body.serviceStartTimes,
      serviceDurations: body.serviceDurations,
      staffId: staff!.id,
      date: body.date,
      startTime: body.startTime,
      customerName: body.customerName,
      customerFirstName: body.customerFirstName,
      customerLastName: body.customerLastName,
      customerPhone: body.customerPhone ?? '',
      customerEmail: body.customerEmail,
      customerNotes: body.customerNotes,
      notes: body.notes,
      customerLocale: body.customerLocale,
      scope,
      endDate: body.endDate,
      forStaffPortal: true,
      forceSchedule: body.forceSchedule,
      conflictResolutions: body.conflictResolutions,
      guestCustomer: body.guestCustomer,
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
    serviceIds?: string[]
    serviceStartTimes?: string[]
    serviceDurations?: (number | null)[]
    staffAssignments?: string[]
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
    forceSchedule?: boolean
    guestCustomer?: boolean
  }>()
  try {
    const row = await updateAppointmentForStaff(c.req.param('id'), staff!.id, body)
    return c.json({ appointment: rowToPublic(row) })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: errorMessages[code] ?? 'No se pudo actualizar' }, 409)
  }
})

me.patch('/me/appointments/:id/no-show', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const existing = await getAppointmentById(c.req.param('id'))
  if (!existing || existing.staff_id !== staff!.id) {
    return c.json({ error: 'Cita no encontrada' }, 404)
  }
  const body = await c.req.json().catch(() => ({}))
  const sendWhatsApp =
    typeof body === 'object' &&
    body !== null &&
    (body as { sendWhatsApp?: boolean }).sendWhatsApp === true
  const row = await markAppointmentNoShow(c.req.param('id'), { sendWhatsApp })
  if (!row) return c.json({ error: 'Cita no encontrada' }, 404)
  return c.json({ appointment: rowToPublic(row) })
})

me.get('/me/appointments/:id/series', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const meta = await getAppointmentSeriesMeta(c.req.param('id'), staff!.id)
  if (!meta) return c.json({ error: 'Cita no encontrada' }, 404)
  return c.json({ series: meta })
})

me.delete('/me/appointments/:id', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const modeParam = c.req.query('mode')
  const mode: AppointmentSeriesMode =
    modeParam === 'series' ? 'series' : modeParam === 'group' ? 'group' : 'single'
  const ok = await deleteAppointmentForStaff(c.req.param('id'), staff!.id, mode)
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

me.patch('/me/blocks/:id', async (c) => {
  const { error, staff } = await requireStaff(c)
  if (error) return error
  const body = await c.req.json<{
    note?: string | null
    startTime?: string
    endTime?: string
    mode?: UpdateBlockNoteMode
  }>()
  const mode = body.mode ?? 'single'
  if (mode !== 'single' && mode !== 'series') {
    return c.json({ error: 'mode debe ser single o series' }, 400)
  }

  const hasTimes =
    typeof body.startTime === 'string' &&
    body.startTime.length > 0 &&
    typeof body.endTime === 'string' &&
    body.endTime.length > 0
  const hasNote = 'note' in body

  if (!hasTimes && !hasNote) {
    return c.json({ error: 'Indica note y/o startTime+endTime' }, 400)
  }

  try {
    let row = null
    if (hasTimes) {
      row = await updateStaffBlockTimes(
        c.req.param('id'),
        body.startTime!,
        body.endTime!,
        mode,
        staff!.id,
      )
      if (!row) return c.json({ error: 'Bloqueo no encontrado' }, 404)
    }
    if (hasNote) {
      row = await updateStaffBlockNote(
        c.req.param('id'),
        body.note ?? null,
        mode,
        staff!.id,
      )
      if (!row) return c.json({ error: 'Bloqueo no encontrado' }, 404)
    }
    return c.json({ block: rowBlockToPublic(row!) })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: errorMessages[code] ?? 'No se pudo actualizar el bloqueo' }, 409)
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
