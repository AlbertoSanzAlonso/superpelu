import { serve } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import fs from 'node:fs'
import path from 'node:path'
import { COLOR_GROUP_ROLE } from '@/lib/booking/occupancy'
import { listActiveServiceCategories } from '@server/catalog/categories.js'
import { listActiveServices } from '@server/catalog/services.js'
import {
  listAdminServices,
  createService,
  updateService,
  deleteService,
  hardDeleteService,
  listAdminServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  hardDeleteServiceCategory,
} from '@server/catalog/admin.js'
import { listStaffForService, listStaffForServices, getStaff } from '@server/staff/index.js'
import { me } from '@server/staff/me.js'
import { listStaffDaySchedules } from '@server/staff/schedule.js'
import { createStaff, deleteStaff, listAdminStaff, updateStaff } from '@server/staff/admin.js'
import {
  cancelAppointment,
  cancelBookingGroupByCustomer,
  createAppointment,
  deleteAppointmentById,
  getAppointmentById,
  getAppointmentSeriesMeta,
  markAppointmentNoShow,
  getAvailableSlots,
  getAvailableSlotsForServices,
  getOverHoursSlotsForServices,
  getAppointmentsByBookingGroup,
  getServiceDaySlotsForServices,
  getStaffAvailableAtSlot,
  getStaffAvailableAtSlotForServices,
  listAppointments,
  parseServiceStartOverrides,
  resolveChainContinuation,
  rescheduleAppointmentByCustomer,
  rowToPublic,
  updateAppointmentForAdmin,
} from '@server/appointments/index.js'
import { previewRecurringChainConflicts } from '@server/appointments/recurringChain.js'
import {
  buildIcs,
  buildManageUrl,
  decodeId,
  encodeId,
  injectSpaLinkPreviewMeta,
  publicBaseUrl,
} from '@server/appointments/links.js'
import {
  appointmentDetailHtml,
  backToManageLink,
  bookingGroupDetailHtml,
  bookingTreatmentPickerHtml,
  cancelAllVisitLinkHtml,
  changeTreatmentLinkHtml,
  customerLangQueryHidden,
  customerLangSuffix,
  customerPageShell,
  customerPageUrlFromRequest,
  escapeHtml,
  manageErrorMessage,
  renderInvalidLinkPage,
  renderNotFoundPage,
  isMultiTreatmentVisit,
  resolveCustomerBookingContext,
  visitChangesPromptHtml,
} from '@server/customers/pages.js'
import { notifyCustomerBookingVisitFinished } from '@server/notifications/whatsapp.js'
import { publicAppointmentErrorMessageOrFallback } from '@/i18n/publicAppointmentErrors'
import { getTranslation } from '@/i18n/translations'
import { normalizeLocale, type Locale } from '@/i18n/types'
import {
  addDaysToDateString,
  formatDisplayDate,
  isWithinSalonBookingWindow,
  todaySalon,
} from '@/lib/core/dates'
import { isSalonOpenOnDate } from '@server/schedule/salonDay.js'
import { schedule } from '@server/config.js'
import { formatAppointmentTimeRange } from '@/lib/booking/occupancy'
import { splitCustomerName } from '@/lib/customer/name'
import {
  createStaffBlock,
  deleteStaffBlockById,
  getBlockSeriesMeta,
  rowBlockToPublic,
  updateStaffBlockNote,
  type BlockScope,
  type DeleteBlockMode,
  type UpdateBlockNoteMode,
} from '@server/staff/blocks.js'
import { listServicesForStaff } from '@server/staff/index.js'
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomerAppointments,
  listCustomers,
  lookupCustomerForBooking,
  updateCustomer,
} from '@server/customers/index.js'
import {
  getBirthdayMessageTemplates,
  setBirthdayMessageTemplates,
} from '@server/customers/birthdayMessage.js'
import { sendCustomerReviewRequest } from '@server/notifications/review.js'
import { initDatabase, sql } from '@server/db.js'
import {
  getFullSchedule,
  setSalonSchedule,
  setStaffSchedule,
  type ScheduleTimeRange,
} from '@server/schedule/index.js'
import {
  getStaffSpecialSchedule,
  setStaffSpecialSchedule,
  deleteStaffSpecialDate,
  getSalonSpecialSchedule,
  setSalonSpecialSchedule,
  deleteSalonSpecialDate,
} from '@server/schedule/special.js'
import {
  getBookingFallback,
  setBookingFallback,
} from '@server/schedule/bookingFallback.js'
import {
  getOpenWaAdminConfig,
  isOpenWaConfigured,
  isOpenWaSessionConnected,
  logOpenWaStartup,
  openWaEnsureSession,
  openWaEnsureStarted,
  openWaGetQr,
  openWaGetSessionById,
  openWaGetSessionStatus,
  openWaSendText,
  openWaSessionName,
  openWaStartSession,
  phoneToWhatsAppChatId,
  startOpenWaKeepAlive,
} from '@server/notifications/openwa.js'
import { processDueReminders, startReminderScheduler } from '@server/notifications/reminders.js'
import {
  processDueBirthdayWishes,
  startBirthdayWishScheduler,
} from '@server/notifications/birthdays.js'
import { logEmailStartup } from '@server/notifications/email.js'
import { getStats } from '@server/stats/index.js'

const app = new Hono()

function parseServiceIds(serviceId?: string | null, serviceIds?: string | null): string[] | null {
  if (serviceIds?.trim()) {
    const ids = serviceIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    return ids.length > 0 ? ids : null
  }
  if (serviceId?.trim()) return [serviceId.trim()]
  return null
}

function parseServiceDurationsQuery(raw?: string | null): (number | null)[] | undefined {
  if (raw == null || raw === '') return undefined
  return raw.split(',').map((value) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  })
}

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

app.get('/api/booking/fallback', async (c) => {
  return c.json(await getBookingFallback())
})

app.get('/api/admin/booking-fallback', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  return c.json(await getBookingFallback())
})

app.put('/api/admin/booking-fallback', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{ enabled?: boolean }>()
  if (typeof body.enabled !== 'boolean') {
    return c.json({ error: 'Falta enabled (boolean)' }, 400)
  }
  return c.json(await setBookingFallback(body.enabled))
})

app.get('/api/admin/schedule', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const data = await getFullSchedule()
  return c.json(data)
})

app.put('/api/admin/schedule/salon', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{ weeklyWindows?: Record<string, ScheduleTimeRange[]> }>().catch(() => ({} as { weeklyWindows?: Record<string, ScheduleTimeRange[]> }))
  if (!body.weeklyWindows || typeof body.weeklyWindows !== 'object') {
    return c.json({ error: 'Falta weeklyWindows' }, 400)
  }
  const result = await setSalonSchedule(body.weeklyWindows)
  return c.json(result)
})

app.put('/api/admin/schedule/staff/:staffId', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const staffId = c.req.param('staffId')
  const body = await c.req.json<{ weeklyWindows?: Record<string, ScheduleTimeRange[]> }>().catch(() => ({} as { weeklyWindows?: Record<string, ScheduleTimeRange[]> }))
  if (!body.weeklyWindows || typeof body.weeklyWindows !== 'object') {
    return c.json({ error: 'Falta weeklyWindows' }, 400)
  }
  const result = await setStaffSchedule(staffId, body.weeklyWindows)
  return c.json({ staffId, weeklyWindows: result })
})

app.get('/api/admin/schedule/special/:staffId', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const staffId = c.req.param('staffId')
  const dateFrom = c.req.query('from')
  const dateTo = c.req.query('to')
  const specialDays = await getStaffSpecialSchedule(staffId, dateFrom, dateTo)
  return c.json({ staffId, specialDays })
})

app.put('/api/admin/schedule/special/:staffId', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const staffId = c.req.param('staffId')
  const body = await c.req.json<{ specialDays?: Record<string, ScheduleTimeRange[]> }>().catch(
    () => ({} as { specialDays?: Record<string, ScheduleTimeRange[]> }),
  )
  if (!body.specialDays || typeof body.specialDays !== 'object') {
    return c.json({ error: 'Falta specialDays' }, 400)
  }
  const result = await setStaffSpecialSchedule(staffId, body.specialDays!)
  return c.json({ staffId, specialDays: result })
})

app.delete('/api/admin/schedule/special/:staffId', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const staffId = c.req.param('staffId')
  const date = c.req.query('date')
  if (!date) return c.json({ error: 'Falta date' }, 400)
  await deleteStaffSpecialDate(staffId, date)
  return c.json({ ok: true })
})

app.get('/api/admin/schedule/salon/special', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const dateFrom = c.req.query('from')
  const dateTo = c.req.query('to')
  const specialDays = await getSalonSpecialSchedule(dateFrom, dateTo)
  return c.json({ specialDays })
})

app.put('/api/admin/schedule/salon/special', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{ specialDays?: Record<string, ScheduleTimeRange[]> }>().catch(
    () => ({} as { specialDays?: Record<string, ScheduleTimeRange[]> }),
  )
  if (!body.specialDays || typeof body.specialDays !== 'object') {
    return c.json({ error: 'Falta specialDays' }, 400)
  }
  const result = await setSalonSpecialSchedule(body.specialDays!)
  return c.json({ specialDays: result })
})

app.delete('/api/admin/schedule/salon/special', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const date = c.req.query('date')
  if (!date) return c.json({ error: 'Falta date' }, 400)
  await deleteSalonSpecialDate(date)
  return c.json({ ok: true })
})

// ── Servicios CRUD (admin) ─────────────────────────────────────────────

type CreateServiceBody = {
  id?: string
  nameEs: string
  nameEn: string
  durationMinutes: number
  categoryId: string | null
  bookableOnline: boolean
  sortOrder: number
  bookingPattern?: import('@/lib/booking/servicePattern').ServiceBookingPattern | null
}

type UpdateServiceBody = {
  nameEs?: string
  nameEn?: string
  durationMinutes?: number
  categoryId?: string | null
  bookableOnline?: boolean
  active?: boolean
  sortOrder?: number
  bookingPattern?: import('@/lib/booking/servicePattern').ServiceBookingPattern | null
}

type CreateCategoryBody = {
  id: string
  nameEs: string
  nameEn: string
  sortOrder: number
  priceFromCents?: number | null
  priceNote?: string | null
}

type UpdateCategoryBody = {
  nameEs?: string
  nameEn?: string
  active?: boolean
  sortOrder?: number
  priceFromCents?: number | null
  priceNote?: string | null
}

app.get('/api/admin/services', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const services = await listAdminServices()
  return c.json({ services })
})

app.post('/api/admin/services', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const raw = await c.req.json().catch(() => ({}))
  const body = raw as CreateServiceBody
  if (!body.nameEs || !body.durationMinutes) {
    return c.json({ error: 'Faltan campos obligatorios (nameEs, durationMinutes)' }, 400)
  }
  const service = await createService(body)
  return c.json({ service }, 201)
})

app.patch('/api/admin/services/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as UpdateServiceBody
  await updateService(id, body)
  return c.json({ ok: true })
})

app.delete('/api/admin/services/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  await deleteService(id)
  return c.json({ ok: true })
})

app.delete('/api/admin/services/:id/hard', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  try {
    await hardDeleteService(id)
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar el servicio'
    return c.json({ error: message }, 400)
  }
})

app.get('/api/admin/service-categories', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const categories = await listAdminServiceCategories()
  return c.json({ categories })
})

app.post('/api/admin/service-categories', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const raw = await c.req.json().catch(() => ({}))
  const body = raw as CreateCategoryBody
  if (!body.id || !body.nameEs) {
    return c.json({ error: 'Faltan campos obligatorios (id, nameEs)' }, 400)
  }
  const category = await createServiceCategory(body)
  return c.json({ category }, 201)
})

app.patch('/api/admin/service-categories/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as UpdateCategoryBody
  await updateServiceCategory(id, body)
  return c.json({ ok: true })
})

app.delete('/api/admin/service-categories/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  await deleteServiceCategory(id)
  return c.json({ ok: true })
})

app.delete('/api/admin/service-categories/:id/hard', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  await hardDeleteServiceCategory(id)
  return c.json({ ok: true })
})

// ── Staff CRUD (admin) ──────────────────────────────────────────────

type CreateStaffBody = {
  id?: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  sortOrder: number
  categoryIds?: string[]
}

type UpdateStaffBody = {
  name?: string
  role?: string | null
  phone?: string | null
  email?: string | null
  active?: boolean
  sortOrder?: number
  categoryIds?: string[]
}

app.get('/api/admin/staff', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const staff = await listAdminStaff()
  return c.json({ staff })
})

app.post('/api/admin/staff', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const raw = await c.req.json().catch(() => ({}))
  const body = raw as CreateStaffBody
  if (!body.name) {
    return c.json({ error: 'Faltan campos obligatorios (name)' }, 400)
  }
  if (body.categoryIds !== undefined && !Array.isArray(body.categoryIds)) {
    return c.json({ error: 'categoryIds debe ser un array' }, 400)
  }
  const member = await createStaff(body)
  return c.json({ staff: member }, 201)
})

app.patch('/api/admin/staff/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({})) as UpdateStaffBody
  if (body.categoryIds !== undefined && !Array.isArray(body.categoryIds)) {
    return c.json({ error: 'categoryIds debe ser un array' }, 400)
  }
  await updateStaff(id, body)
  return c.json({ ok: true })
})

app.delete('/api/admin/staff/:id', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const id = c.req.param('id')
  try {
    await deleteStaff(id)
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No se pudo eliminar'
    return c.json({ error: message }, 409)
  }
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

/** Envía un WhatsApp de prueba (solo admin). Body: { phone, text? } */
app.post('/api/admin/whatsapp/test', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)

  if (!isOpenWaConfigured()) {
    return c.json({ error: 'OpenWA no configurado (OPENWA_ENABLED y credenciales)' }, 400)
  }

  const body = await c.req.json<{ phone?: string; text?: string }>().catch(() => ({} as { phone?: string; text?: string }))
  const phone = body.phone?.trim()
  if (!phone) return c.json({ error: 'Falta phone (E.164, p. ej. +34600111222)' }, 400)

  const text = body.text?.trim() || 'Prueba Superpelu — WhatsApp OK ✅'

  try {
    await openWaEnsureStarted()
    const session = await openWaGetSessionStatus()
    if (!isOpenWaSessionConnected(session?.status)) {
      return c.json(
        {
          error: 'Sesión OpenWA no conectada',
          session: session ? { id: session.id, status: session.status } : null,
        },
        503,
      )
    }
    const chatId = phoneToWhatsAppChatId(phone)
    const messageId = await openWaSendText(chatId, text)
    return c.json({ ok: true, chatId, messageId: messageId ?? null })
  } catch (err) {
    console.error('Superpelu WhatsApp test:', err)
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502)
  }
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
  const ids = parseServiceIds(c.req.query('serviceId'), c.req.query('serviceIds'))
  if (!ids) {
    return c.json({ error: 'Falta serviceId o serviceIds' }, 400)
  }
  const date = c.req.query('date')
  const startTime = c.req.query('startTime')
  if (date && startTime) {
    return c.json({
      staff: await getStaffAvailableAtSlotForServices(date, ids, startTime),
    })
  }
  return c.json({
    staff: ids.length === 1 ? await listStaffForService(ids[0]) : await listStaffForServices(ids),
  })
})

app.get('/api/slots', async (c) => {
  const date = c.req.query('date')
  const ids = parseServiceIds(c.req.query('serviceId'), c.req.query('serviceIds'))
  const staffId = c.req.query('staffId')

  if (!date || !ids) {
    return c.json({ error: 'Faltan date o serviceId/serviceIds' }, 400)
  }

  if (!staffId) {
    return c.json({
      date,
      serviceIds: ids,
      slots: await getServiceDaySlotsForServices(date, ids),
    })
  }

  return c.json({
    date,
    serviceIds: ids,
    staffId,
    slots: await getAvailableSlotsForServices(date, ids, staffId),
  })
})

app.get('/api/booking/chain', async (c) => {
  const date = c.req.query('date')
  const ids = parseServiceIds(c.req.query('serviceId'), c.req.query('serviceIds'))
  const startTime = c.req.query('startTime')
  const staffAssignments =
    c.req.query('staffAssignments')
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  if (!date || !ids || ids.length < 2 || !startTime) {
    return c.json({ error: 'Faltan date, serviceIds (≥2) o startTime' }, 400)
  }

  const serviceStartOverrides = parseServiceStartOverrides(
    c.req.query('serviceStartOverrides'),
    ids.length,
  )

  try {
    return c.json(
      await resolveChainContinuation(
        date,
        ids,
        startTime,
        staffAssignments,
        {},
        serviceStartOverrides,
      ),
    )
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: code }, 400)
  }
})

app.get('/api/booking/customer-lookup', async (c) => {
  const phone = c.req.query('phone') ?? ''
  if (!phone.trim()) {
    return c.json({ found: false as const })
  }
  try {
    return c.json(await lookupCustomerForBooking(phone))
  } catch {
    return c.json({ found: false as const })
  }
})

app.post('/api/appointments', async (c) => {
  const body = await c.req.json<{
    serviceId?: string
    serviceIds?: string[]
    staffId: string
    staffAssignments?: string[]
    serviceStartTimes?: string[]
    date: string
    startTime: string
    customerName?: string
    customerPhone: string
    customerEmail?: string
    notes?: string
    locale?: 'es' | 'en'
    birthdate?: string | null
    returningCustomer?: boolean
  }>()

  const serviceIds =
    body.serviceIds?.filter(Boolean) ??
    (body.serviceId ? [body.serviceId] : [])

  const locale = normalizeLocale(body.locale)

  const fallback = await getBookingFallback()
  if (fallback.enabled) {
    return c.json(
      {
        error:
          locale === 'en'
            ? 'Online booking is temporarily redirected. Please use the BUK agenda.'
            : 'La reserva online está temporalmente redirigida. Usa la agenda BUK.',
        code: 'BOOKING_FALLBACK_BUK',
        url: fallback.url,
      },
      503,
    )
  }

  if (
    serviceIds.length === 0 ||
    !body.staffId ||
    !body.date ||
    !body.startTime ||
    !body.customerPhone?.trim() ||
    (!body.returningCustomer && !body.customerName?.trim())
  ) {
    return c.json(
      {
        error: publicAppointmentErrorMessageOrFallback('INCOMPLETE_DATA', locale),
        code: 'INCOMPLETE_DATA',
      },
      400,
    )
  }

  try {
    const row = await createAppointment({
      serviceIds,
      staffId: body.staffId,
      staffAssignments: body.staffAssignments,
      serviceStartTimes: body.serviceStartTimes,
      date: body.date,
      startTime: body.startTime,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      notes: body.notes,
      locale: body.locale,
      birthdate: body.birthdate,
      returningCustomer: body.returningCustomer,
    })
    const grouped =
      row.booking_group_id != null
        ? await getAppointmentsByBookingGroup(row.booking_group_id)
        : [row]
    const visibleGroup = grouped.filter((apt) => apt.color_group_role !== COLOR_GROUP_ROLE.wash)
    return c.json(
      {
        appointment: rowToPublic(row),
        appointments: visibleGroup.map(rowToPublic),
      },
      201,
    )
  } catch (err) {
    const code = err instanceof Error ? err.message : 'CREATE_FAILED'
    return c.json(
      {
        error: publicAppointmentErrorMessageOrFallback(code, locale),
        code,
      },
      409,
    )
  }
})

app.get('/api/customers', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const q = c.req.query('q')
  const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined
  return c.json({ customers: await listCustomers({ q, limit }) })
})

app.post('/api/customers', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)

  const body = await c.req.json<{
    phone: string
    firstName: string
    lastName?: string
    email?: string | null
    notes?: string | null
    locale?: 'es' | 'en'
    birthdate?: string | null
  }>()

  try {
    const row = await createCustomer({
      phone: body.phone,
      firstName: body.firstName ?? '',
      lastName: body.lastName,
      email: body.email,
      notes: body.notes,
      locale: body.locale,
      birthdate: body.birthdate,
    })
    return c.json({ customer: customerToJson(row) }, 201)
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    const messages: Record<string, string> = {
      TELEFONO_INVALIDO: 'Teléfono no válido',
      NOMBRE_INVALIDO: 'Indica al menos el nombre',
      CLIENTE_YA_EXISTE: 'Ya existe un cliente con ese teléfono',
      FECHA_NACIMIENTO_INVALIDA: 'Fecha de nacimiento no válida',
    }
    return c.json({ error: messages[code] ?? 'No se pudo crear el cliente' }, 400)
  }
})

function customerToJson(customer: {
  phone: string
  first_name: string
  last_name: string | null
  email: string | null
  notes: string | null
  locale?: string | null
  birthdate?: string | Date | null
  review_request_sent_at?: string | null
  created_at: string
  updated_at: string
}) {
  const birthdate =
    customer.birthdate == null
      ? null
      : typeof customer.birthdate === 'string'
        ? customer.birthdate.slice(0, 10)
        : customer.birthdate.toISOString().slice(0, 10)
  return {
    phone: customer.phone,
    firstName: customer.first_name,
    lastName: customer.last_name ?? '',
    email: customer.email,
    notes: customer.notes,
    locale: customer.locale === 'en' ? 'en' : 'es',
    birthdate,
    reviewRequestSentAt: customer.review_request_sent_at ?? null,
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
      birthdate: null,
      reviewRequestSentAt: null,
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
    birthdate?: string | null
  }>()

  try {
    const row = await updateCustomer(phone, {
      firstName: body.firstName ?? '',
      lastName: body.lastName,
      email: body.email,
      notes: body.notes,
      locale: body.locale,
      birthdate: body.birthdate,
    })
    return c.json({ customer: customerToJson(row) })
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    const messages: Record<string, string> = {
      TELEFONO_INVALIDO: 'Teléfono no válido',
      CLIENTE_NO_ENCONTRADO: 'Cliente no encontrado',
      NOMBRE_INVALIDO: 'Indica al menos el nombre',
      FECHA_NACIMIENTO_INVALIDA: 'Fecha de nacimiento no válida',
    }
    const status = code === 'CLIENTE_NO_ENCONTRADO' ? 404 : 400
    return c.json({ error: messages[code] ?? 'No se pudo actualizar el cliente' }, status)
  }
})

app.get('/api/admin/birthday-message', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  return c.json({ templates: await getBirthdayMessageTemplates() })
})

app.put('/api/admin/birthday-message', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{ es?: string; en?: string }>()
  try {
    const templates = await setBirthdayMessageTemplates(body)
    return c.json({ templates })
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    if (code === 'PLANTILLA_SIN_NOMBRE') {
      return c.json(
        { error: 'La plantilla debe incluir el marcador {nombre}' },
        400,
      )
    }
    return c.json({ error: 'No se pudo guardar la plantilla' }, 400)
  }
})

app.post('/api/admin/birthday-wishes/run', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const sent = await processDueBirthdayWishes()
  return c.json({ sent })
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

app.post('/api/customers/:phone/review-request', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)

  const phone = decodeURIComponent(c.req.param('phone'))
  const body = await c.req.json<{ appointmentId?: string }>().catch(() => ({} as { appointmentId?: string }))
  try {
    const result = await sendCustomerReviewRequest(phone, {
      appointmentId: body?.appointmentId,
    })
    return c.json(result)
  } catch (err) {
    const code = err instanceof Error ? err.message : ''
    const messages: Record<string, string> = {
      CLIENTE_NO_ENCONTRADO: 'Cliente no encontrado',
      TELEFONO_INVALIDO: 'Teléfono no válido',
      WHATSAPP_NO_CONFIGURADO: 'WhatsApp no está configurado en el servidor',
    }
    const status =
      code === 'CLIENTE_NO_ENCONTRADO' ? 404 : code === 'WHATSAPP_NO_CONFIGURADO' ? 503 : 400
    return c.json({ error: messages[code] ?? 'No se pudo enviar el mensaje' }, status)
  }
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

app.get('/api/admin/stats', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const stats = await getStats()
  return c.json(stats)
})

const adminScheduleErrors: Record<string, string> = {
  SERVICIO_INVALIDO: 'Servicio no válido',
  STAFF_INVALIDO: 'Profesional no válido',
  STAFF_NO_REALIZA_SERVICIO: 'Este profesional no realiza ese servicio',
  FECHA_INVALIDA: 'Fecha no disponible',
  HORARIO_NO_DISPONIBLE: 'Ese horario no está disponible',
  HORARIO_ENCADENADO_NO_DISPONIBLE: 'Ese horario no está disponible para todos los tratamientos',
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
  const serviceIdsRaw = c.req.query('serviceIds')
  const staffId = c.req.query('staffId')
  const exclude = c.req.query('excludeAppointmentId')
  const serviceDurations = parseServiceDurationsQuery(c.req.query('serviceDurations'))
  if (!date || !staffId) {
    return c.json({ error: 'Faltan date o staffId' }, 400)
  }
  if (!serviceId && !serviceIdsRaw) {
    return c.json({ error: 'Falta serviceId o serviceIds' }, 400)
  }
  const ids = serviceIdsRaw
    ? serviceIdsRaw.split(',').filter(Boolean)
    : serviceId
      ? [serviceId]
      : []
  if (ids.length === 0) {
    return c.json({ error: 'Faltan serviceIds' }, 400)
  }
  const slotOptions = {
    forStaffPortal: true as const,
    excludeAppointmentId: exclude,
    serviceDurations,
    allowAppointmentOverlap: true as const,
  }
  const slots = ids.length > 1
    ? await getAvailableSlotsForServices(date, ids, staffId, slotOptions)
    : await getAvailableSlots(date, ids[0], staffId, slotOptions)
  const slotsOverHours = await getOverHoursSlotsForServices(date, ids, staffId, slotOptions)
  return c.json({ slots, slotsOverHours })
})

app.get('/api/schedule/day-slots', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const date = c.req.query('date')
  const serviceIdsRaw = c.req.query('serviceIds')
  const exclude = c.req.query('excludeAppointmentId')
  const serviceDurations = parseServiceDurationsQuery(c.req.query('serviceDurations'))
  if (!date || !serviceIdsRaw) {
    return c.json({ error: 'Faltan date o serviceIds' }, 400)
  }
  const ids = serviceIdsRaw.split(',').filter(Boolean)
  if (ids.length === 0) {
    return c.json({ error: 'Faltan serviceIds' }, 400)
  }
  const slots = await getServiceDaySlotsForServices(date, ids, {
    forStaffPortal: true,
    excludeAppointmentId: exclude,
    serviceDurations,
    allowAppointmentOverlap: true,
  })
  return c.json({ slots })
})

app.get('/api/schedule/chain', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const date = c.req.query('date')
  const serviceIdsRaw = c.req.query('serviceIds')
  const startTime = c.req.query('startTime')
  const staffAssignments =
    c.req.query('staffAssignments')
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? []
  const exclude = c.req.query('excludeAppointmentId')
  const serviceDurations = parseServiceDurationsQuery(c.req.query('serviceDurations'))
  if (!date || !serviceIdsRaw || !startTime) {
    return c.json({ error: 'Faltan date, serviceIds o startTime' }, 400)
  }
  const ids = serviceIdsRaw.split(',').filter(Boolean)
  if (ids.length < 2) {
    return c.json({ error: 'Se requieren al menos 2 serviceIds' }, 400)
  }
  const serviceStartOverrides = parseServiceStartOverrides(
    c.req.query('serviceStartOverrides'),
    ids.length,
  )
  try {
    return c.json(
      await resolveChainContinuation(
        date,
        ids,
        startTime,
        staffAssignments,
        {
          forStaffPortal: true,
          excludeAppointmentId: exclude,
          serviceDurations,
          allowAppointmentOverlap: true,
        },
        serviceStartOverrides,
      ),
    )
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: code }, 400)
  }
})

app.get('/api/schedule/staff-at-slot', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const date = c.req.query('date')
  const serviceId = c.req.query('serviceId')
  const startTime = c.req.query('startTime')
  if (!date || !serviceId || !startTime) {
    return c.json({ error: 'Faltan date, serviceId o startTime' }, 400)
  }
  const staff = await getStaffAvailableAtSlot(date, serviceId, startTime, {
    forStaffPortal: true,
    allowAppointmentOverlap: true,
  })
  return c.json({ staff })
})

app.post('/api/schedule/appointments/preview-series', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{
    staffId: string
    serviceIds?: string[]
    serviceId?: string
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
    scope?: BlockScope
    endDate?: string
  }>()
  const ids = body.serviceIds?.length ? body.serviceIds : body.serviceId ? [body.serviceId] : []
  if (!body.staffId || ids.length === 0 || !body.date || !body.startTime) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  const scope = body.scope ?? 'weekly'
  if (scope !== 'weekly') {
    return c.json({ error: adminScheduleErrors.ALCANCE_INVALIDO }, 400)
  }
  try {
    const result = await previewRecurringChainConflicts(
      {
        staffId: body.staffId,
        serviceIds: ids,
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
        scope,
        endDate: body.endDate,
        forStaffPortal: true,
      },
      ids,
    )
    return c.json(result)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    return c.json({ error: adminScheduleErrors[code] ?? 'No se pudo previsualizar la serie' }, 409)
  }
})

app.post('/api/schedule/appointments', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const body = await c.req.json<{
    staffId: string
    staffAssignments?: string[]
    serviceIds?: string[]
    serviceId?: string
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
    scope?: BlockScope
    endDate?: string
    forceSchedule?: boolean
    conflictResolutions?: { date: string; action: 'skip' | 'reassign' | 'reschedule'; staffId?: string; startTime?: string }[]
  }>()
  const ids = body.serviceIds?.length ? body.serviceIds : body.serviceId ? [body.serviceId] : []
  const hasName = Boolean(body.customerName?.trim() || body.customerFirstName?.trim())
  if (
    !body.staffId ||
    ids.length === 0 ||
    !body.date ||
    !body.startTime ||
    !hasName ||
    !body.customerPhone?.trim()
  ) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }
  const scope = body.scope ?? 'single'
  if (scope !== 'single' && scope !== 'weekly') {
    return c.json({ error: adminScheduleErrors.ALCANCE_INVALIDO }, 400)
  }
  if (scope === 'weekly' && body.endDate && body.endDate < body.date) {
    return c.json({ error: adminScheduleErrors.FECHA_FIN_INVALIDA }, 400)
  }
  try {
    const row = await createAppointment({
      staffId: body.staffId,
      staffAssignments: body.staffAssignments,
      serviceIds: ids,
      serviceStartTimes: body.serviceStartTimes,
      serviceDurations: body.serviceDurations,
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
      scope,
      endDate: body.endDate,
      forStaffPortal: true,
      forceSchedule: body.forceSchedule,
      allowAppointmentOverlap: true,
      conflictResolutions: body.conflictResolutions,
    })
    const grouped =
      row.booking_group_id != null
        ? await getAppointmentsByBookingGroup(row.booking_group_id)
        : [row]
    const visibleGroup = grouped.filter((apt) => apt.color_group_role !== COLOR_GROUP_ROLE.wash)
    return c.json(
      {
        appointment: rowToPublic(row),
        appointments: visibleGroup.map(rowToPublic),
      },
      201,
    )
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
    staffAssignments?: string[]
    serviceId?: string
    serviceIds?: string[]
    serviceStartTimes?: string[]
    serviceDurations?: (number | null)[]
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
    forceSchedule?: boolean
  }>()
  try {
    const row = await updateAppointmentForAdmin(c.req.param('id'), body)
    return c.json({ appointment: rowToPublic(row) })
  } catch (err) {
    const code = err instanceof Error ? err.message : 'ERROR'
    console.error('Superpelu update appointment:', code, err)
    return c.json(
      {
        error:
          adminScheduleErrors[code] ??
          (err instanceof Error && err.message && !/^[A-Z0-9_]+$/.test(err.message)
            ? err.message
            : 'No se pudo actualizar'),
      },
      409,
    )
  }
})

app.get('/api/schedule/appointments/:id/series', async (c) => {
  const auth = c.req.header('Authorization')
  if (!requireAdmin(auth)) return c.json({ error: 'No autorizado' }, 401)
  const meta = await getAppointmentSeriesMeta(c.req.param('id'))
  if (!meta) return c.json({ error: 'Cita no encontrada' }, 404)
  return c.json({ series: meta })
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
  const modeRaw =
    typeof body === 'object' && body !== null ? (body as { mode?: string }).mode : undefined
  const mode: import('@server/appointments/series.js').AppointmentSeriesMode =
    modeRaw === 'series' ? 'series' : modeRaw === 'group' ? 'group' : 'single'

  const row = await cancelAppointment(c.req.param('id'), { notifyCustomer, mode })
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

  const mode = c.req.query('mode') === 'series' ? 'series' : 'single'

  if (!(await deleteAppointmentById(c.req.param('id'), mode))) {
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
  c: Context,
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
  const code = c.req.param('code')
  const token = c.req.query('t')
  const scopeAll = c.req.query('scope') === 'all'
  const resolved = await resolveCustomerBookingContext(code, token, queryLang, c.req.query('apt'))
  if (!resolved.ok) {
    const page = renderInvalidLinkPage(resolved.locale, 'cancel')
    return c.html(page.html, 400)
  }

  const { ctx } = resolved
  const { locale, activeRows, targetRow, linkRow } = ctx
  const manageBase = `/m/${encodeURIComponent(code)}`
  const cancelBase = `/c/${encodeURIComponent(code)}`

  if (activeRows.length === 0) {
    const t = cp(locale).alreadyCancelled
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.headingDone)}</h1><p>${escapeHtml(t.bodyDone)}</p>`,
      locale,
    )
  }

  if (activeRows.length > 1 && !targetRow && !scopeAll) {
    const t = cp(locale).cancel
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1>
       ${bookingTreatmentPickerHtml(activeRows, locale, {
         intro: t.multiIntro,
         actionLabel: t.selectTreatment,
         basePath: cancelBase,
         token: token ?? '',
       })}
       ${cancelAllVisitLinkHtml(cancelBase, token ?? '', locale, {
         sectionLabel: t.cancelAllSection,
         buttonLabel: t.cancelAllButton,
       })}
       ${backToManageLink(buildManageUrl(linkRow), locale)}`,
      locale,
    )
  }

  if (activeRows.length > 1 && scopeAll) {
    const t = cp(locale).cancel
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.cancelAllConfirmHeading)}</h1>
       <p>${escapeHtml(t.cancelAllIntro)}</p>
       ${bookingGroupDetailHtml(activeRows, locale)}
       <form method="POST" action="/c/${encodeURIComponent(code)}${locale === 'en' ? '?lang=en' : ''}">
         <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
         <input type="hidden" name="scope" value="all">
         <button class="btn btn-danger" type="submit">${escapeHtml(t.cancelAllConfirmButton)}</button>
       </form>
       <p style="margin-top:1rem"><a class="btn btn-secondary" href="${escapeHtml(`${cancelBase}?t=${encodeURIComponent(token ?? '')}${customerLangSuffix(locale)}`)}">${escapeHtml(cp(locale).confirmChange.back)}</a></p>
       <p class="muted">${escapeHtml(t.hint)}</p>`,
      locale,
    )
  }

  const row = targetRow!
  if (row.status === 'cancelled') {
    const t = cp(locale).alreadyCancelled
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.headingDone)}</h1><p>${escapeHtml(t.bodyDone)}</p>`,
      locale,
    )
  }

  const t = cp(locale).cancel
  const aptSuffix = activeRows.length > 1 ? `&apt=${encodeURIComponent(encodeId(row.id))}` : ''
  const langSuffix = customerLangSuffix(locale)

  return replyCustomerPage(
    c,
    t.title,
    `<h1>${escapeHtml(t.heading)}</h1>
     ${activeRows.length > 1 ? changeTreatmentLinkHtml(cancelBase, token ?? '', locale) : ''}
     ${appointmentDetailHtml(row, locale)}
     <form method="POST" action="/c/${encodeURIComponent(code)}${locale === 'en' ? '?lang=en' : ''}">
       <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
       ${activeRows.length > 1 ? `<input type="hidden" name="apt" value="${escapeHtml(encodeId(row.id))}">` : ''}
       <button class="btn btn-danger" type="submit">${escapeHtml(t.confirmButton)}</button>
     </form>
     ${backToManageLink(`${manageBase}?t=${encodeURIComponent(token ?? '')}${aptSuffix}${langSuffix}`, locale)}
     <p class="muted">${escapeHtml(t.hint)}</p>`,
    locale,
  )
})

app.post('/c/:code', async (c) => {
  const queryLang = c.req.query('lang')
  const code = c.req.param('code')
  const body = await c.req.parseBody()
  const token = typeof body.t === 'string' ? body.t : undefined
  const aptCode = typeof body.apt === 'string' ? body.apt : undefined
  const cancelAll = body.scope === 'all'
  const resolved = await resolveCustomerBookingContext(code, token, queryLang, aptCode)
  if (!resolved.ok) {
    const page = renderInvalidLinkPage(resolved.locale, 'action')
    return c.html(page.html, 400)
  }

  const { ctx } = resolved
  const { locale, activeRows, targetRow, groupRows } = ctx
  if (cancelAll && activeRows.length > 1) {
    const cancelled = await cancelBookingGroupByCustomer(ctx.linkId, { notifyCustomer: true })
    if (cancelled === 0) {
      const t = cp(locale).alreadyCancelled
      return replyCustomerPage(
        c,
        t.title,
        `<h1>${escapeHtml(t.headingWas)}</h1><p>${escapeHtml(t.bodyThanks)}</p>`,
        locale,
      )
    }
    const t = cp(locale).cancel
    return replyCustomerPage(
      c,
      t.successTitle,
      `<h1>${escapeHtml(t.successHeading)}</h1><p>${escapeHtml(t.successAllBody)}</p><p>${escapeHtml(t.successFooter)}</p>`,
      locale,
    )
  }

  const cancelId = targetRow?.id ?? ctx.linkId

  const existing = await getAppointmentById(cancelId)
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

  const multiVisit = isMultiTreatmentVisit(groupRows)
  await cancelAppointment(cancelId, { notifyCustomer: !multiVisit })
  const t = cp(locale).cancel
  const remaining = activeRows.filter((row) => row.id !== cancelId)

  if (multiVisit) {
    const updated = cp(locale).updated
    return replyCustomerPage(
      c,
      t.successTitle,
      `<h1>${escapeHtml(t.successHeading)}</h1>
       <p>${escapeHtml(updated.treatmentCancelled)}</p>
       ${visitChangesPromptHtml(code, token ?? '', locale, remaining.length)}`,
      locale,
    )
  }

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
  const aptCode = c.req.query('apt')
  const resolved = await resolveCustomerBookingContext(code, token, queryLang, aptCode)
  if (!resolved.ok) {
    const page = renderInvalidLinkPage(resolved.locale, 'confirm')
    return c.html(page.html, 400)
  }

  const { ctx } = resolved
  const { locale, targetRow, activeRows } = ctx
  if (activeRows.length > 1 && !targetRow) {
    const t = cp(locale).incomplete
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(t.bodyStaffDayTime)}</p>`,
      locale,
      400,
    )
  }

  if (!date || !startTime || !staffId) {
    const t = cp(locale).incomplete
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(t.bodyStaffDayTime)}</p>`,
      locale,
      400,
    )
  }

  const row = targetRow!
  if (!row || row.status === 'cancelled') {
    const page = renderNotFoundPage(locale, true)
    return c.html(page.html, 404)
  }

  const staff = await getStaff(staffId)
  const t = cp(locale)
  const dateLabel = escapeHtml(formatDisplayDate(date, locale))
  const timeRange = escapeHtml(
    formatAppointmentTimeRange(row.service_id, startTime, row.duration_minutes, locale, {
      colorGroupRole: row.color_group_role,
    }),
  )
  const service = escapeHtml(row.service_name)
  const langSuffix = customerLangSuffix(locale)
  const aptSuffix =
    activeRows.length > 1 ? `&apt=${encodeURIComponent(encodeId(row.id))}` : ''
  const manageBase = `/m/${encodeURIComponent(code)}`
  const backUrl = `${manageBase}?t=${encodeURIComponent(token ?? '')}&date=${encodeURIComponent(date)}&staffId=${encodeURIComponent(staffId)}${aptSuffix}${langSuffix}`

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
       ${activeRows.length > 1 ? `<input type="hidden" name="apt" value="${escapeHtml(encodeId(row.id))}">` : ''}
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
  const resolved = await resolveCustomerBookingContext(code, token, queryLang, c.req.query('apt'))
  if (!resolved.ok) {
    const page = renderInvalidLinkPage(resolved.locale, 'manage')
    return c.html(page.html, 400)
  }

  const { ctx } = resolved
  const { locale, activeRows, targetRow } = ctx
  const manageBase = `/m/${encodeURIComponent(code)}`
  const cancelBase = `/c/${encodeURIComponent(code)}`

  if (activeRows.length === 0) {
    const t = cp(locale).alreadyCancelled
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.headingIs)}</h1><p>${escapeHtml(t.bodyBookAgain)}</p>`,
      locale,
    )
  }

  if (activeRows.length > 1 && !targetRow) {
    const t = cp(locale).manage
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1>
       ${bookingTreatmentPickerHtml(activeRows, locale, {
         intro: t.multiIntro,
         actionLabel: t.selectTreatment,
         basePath: manageBase,
         token: token ?? '',
       })}
       ${cancelAllVisitLinkHtml(cancelBase, token ?? '', locale, {
         sectionLabel: cp(locale).cancel.cancelAllSection,
         buttonLabel: t.cancelAllButton,
       })}`,
      locale,
    )
  }

  const row = targetRow!
  if (row.status === 'cancelled') {
    const t = cp(locale).alreadyCancelled
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.headingIs)}</h1><p>${escapeHtml(t.bodyBookAgain)}</p>`,
      locale,
    )
  }

  const langSuffix = customerLangSuffix(locale)
  const aptSuffix =
    activeRows.length > 1 ? `&apt=${encodeURIComponent(encodeId(row.id))}` : ''
  const aptHidden =
    activeRows.length > 1
      ? `<input type="hidden" name="apt" value="${escapeHtml(encodeId(row.id))}">`
      : ''
  const cancelUrl = `${publicBaseUrl() || ''}${cancelBase}?t=${encodeURIComponent(token ?? '')}${aptSuffix}${langSuffix}`
  const cancelAllUrl = `${publicBaseUrl() || ''}${cancelBase}?t=${encodeURIComponent(token ?? '')}&scope=all${langSuffix}`
  const t = cp(locale).manage
  const cancelSectionHtml =
    activeRows.length > 1
      ? `<a class="btn btn-danger" href="${escapeHtml(cancelUrl)}">${escapeHtml(t.cancelButton)}</a>
         <p class="section-label" style="margin-top:1.25rem">${escapeHtml(cp(locale).cancel.cancelAllSection)}</p>
         <a class="btn btn-danger" href="${escapeHtml(cancelAllUrl)}">${escapeHtml(t.cancelAllButton)}</a>`
      : `<a class="btn btn-danger" href="${escapeHtml(cancelUrl)}">${escapeHtml(t.cancelButton)}</a>`

  const staffOptions = await listStaffForService(row.service_id)
  let selectedStaffId = (c.req.query('staffId') ?? row.staff_id ?? '').trim()
  if (!staffOptions.some((s) => s.id === selectedStaffId)) {
    selectedStaffId = staffOptions[0]?.id ?? row.staff_id ?? ''
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
       <form method="GET" action="${escapeHtml(manageBase)}" class="staff-form">
         <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
         <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
         ${aptHidden}
         ${customerLangQueryHidden(locale)}
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
  if (!(await isSalonOpenOnDate(selectedDate)) || !isWithinSalonBookingWindow(selectedDate)) {
    slotsHtml = `<p class="muted">${escapeHtml(t.salonClosed)}</p>`
  } else if (selectedStaffId) {
    const slots = await getAvailableSlots(selectedDate, row.service_id, selectedStaffId, {
      excludeAppointmentId: row.id,
      serviceDurations: [row.duration_minutes],
    })
    if (slots.length === 0) {
      slotsHtml = `<p class="muted">${escapeHtml(t.noSlots)}</p>`
    } else {
      slotsHtml =
        `<p class="section-label">${escapeHtml(t.hourSection)}</p><div class="slots">` +
        slots
          .map(
            (slot) =>
              `<form method="GET" action="${escapeHtml(manageBase)}/confirm" class="slot-form">
                 <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
                 <input type="hidden" name="date" value="${escapeHtml(selectedDate)}">
                 <input type="hidden" name="staffId" value="${escapeHtml(selectedStaffId)}">
                 ${aptHidden}
                 ${customerLangQueryHidden(locale)}
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
     ${activeRows.length > 1 ? changeTreatmentLinkHtml(manageBase, token ?? '', locale) : ''}
     <div class="detail">
       <p>💇 ${service}</p>
       <p>${escapeHtml(cp(locale).withStaff(selectedStaffRaw))}</p>
       <p>📅 ${dateLabel}</p>
       <p>🕐 ${timeRange}</p>
     </div>
     <p class="section-label">${escapeHtml(t.modifySection)}</p>
     ${staffSelectHtml}
     <p class="section-label">${escapeHtml(t.daySection)}</p>
     <form method="GET" action="${escapeHtml(manageBase)}" class="date-form">
       <input type="hidden" name="t" value="${escapeHtml(token ?? '')}">
       <input type="hidden" name="staffId" value="${escapeHtml(selectedStaffId)}">
       ${aptHidden}
       ${customerLangQueryHidden(locale)}
       <input type="date" name="date" value="${escapeHtml(selectedDate)}" min="${today}" max="${maxDate}" onchange="this.form.submit()">
     </form>
     ${slotsHtml}
     <p class="section-label">${escapeHtml(t.cancelSection)}</p>
     ${cancelSectionHtml}
     <p class="muted">${escapeHtml(t.callSalon)}</p>`,
    locale,
  )
})

app.post('/m/:code', async (c) => {
  const queryLang = c.req.query('lang')
  const code = c.req.param('code')
  const body = await c.req.parseBody()
  const token = typeof body.t === 'string' ? body.t : undefined
  const aptCode = typeof body.apt === 'string' ? body.apt : undefined
  const date = typeof body.date === 'string' ? body.date : undefined
  const startTime = typeof body.startTime === 'string' ? body.startTime : undefined
  const staffId = typeof body.staffId === 'string' ? body.staffId : undefined

  const resolved = await resolveCustomerBookingContext(code, token, queryLang, aptCode)
  if (!resolved.ok) {
    const page = renderInvalidLinkPage(resolved.locale, 'action')
    return c.html(page.html, 400)
  }

  const { ctx } = resolved
  const { locale, targetRow, activeRows } = ctx
  const rescheduleId = targetRow?.id ?? ctx.linkId

  if (!date || !startTime) {
    const t = cp(locale).incomplete
    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(t.bodyDateTime)}</p>`,
      locale,
      400,
    )
  }

  const multiVisit = isMultiTreatmentVisit(ctx.groupRows)

  try {
    const row = await rescheduleAppointmentByCustomer(
      rescheduleId,
      { date, startTime, staffId },
      { notifyCustomer: !multiVisit },
    )
    const t = cp(locale).updated
    const dateLabel = escapeHtml(formatDisplayDate(row.appointment_date, locale))
    const timeRange = escapeHtml(
      formatAppointmentTimeRange(row.service_id, row.start_time, row.duration_minutes, locale, {
        colorGroupRole: row.color_group_role,
      }),
    )

    const detailHtml = `<div class="detail">
         <p>📅 ${dateLabel}</p>
         <p>🕐 ${timeRange}</p>
         <p>💇 ${escapeHtml(row.service_name)}</p>
         ${row.staff_name ? `<p>${escapeHtml(cp(locale).withStaff(row.staff_name))}</p>` : ''}
       </div>`

    if (multiVisit) {
      const refreshed = await resolveCustomerBookingContext(code, token, queryLang)
      const activeCount =
        refreshed.ok ? refreshed.ctx.activeRows.length : activeRows.length
      return replyCustomerPage(
        c,
        t.title,
        `<h1>${escapeHtml(t.heading)}</h1>
         <p>${escapeHtml(t.intro)}</p>
         ${detailHtml}
         ${visitChangesPromptHtml(code, token ?? '', locale, activeCount)}`,
        locale,
      )
    }

    return replyCustomerPage(
      c,
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1>
       <p>${escapeHtml(t.intro)}</p>
       ${detailHtml}
       ${backToManageLink(buildManageUrl(ctx.linkRow), locale)}
       <p class="muted">${escapeHtml(t.closing)}</p>`,
      locale,
    )
  } catch (err) {
    const codeErr = err instanceof Error ? err.message : 'ERROR'
    const message = manageErrorMessage(codeErr, locale)
    const aptSuffix =
      targetRow && activeRows.length > 1
        ? `&apt=${encodeURIComponent(encodeId(targetRow.id))}`
        : ''
    const backUrl = `/m/${encodeURIComponent(code)}?t=${encodeURIComponent(token ?? '')}&date=${encodeURIComponent(date)}${staffId ? `&staffId=${encodeURIComponent(staffId)}` : ''}${aptSuffix}${customerLangSuffix(locale)}`
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

/** Envía el WhatsApp resumen tras guardar cambios en una visita multi-tratamiento. */
app.post('/m/:code/finish', async (c) => {
  const queryLang = c.req.query('lang')
  const code = c.req.param('code')
  const body = await c.req.parseBody()
  const token = typeof body.t === 'string' ? body.t : undefined
  const resolved = await resolveCustomerBookingContext(code, token, queryLang)
  if (!resolved.ok) {
    const page = renderInvalidLinkPage(resolved.locale, 'action')
    return c.html(page.html, 400)
  }

  const { ctx } = resolved
  const { locale } = ctx
  if (!isMultiTreatmentVisit(ctx.groupRows)) {
    return c.redirect(`/m/${encodeURIComponent(code)}?t=${encodeURIComponent(token ?? '')}${customerLangSuffix(locale)}`)
  }

  await notifyCustomerBookingVisitFinished(ctx.linkId)

  const t = cp(locale).visitChanges
  const activeCount = ctx.activeRows.length
  const bodyText = activeCount > 0 ? t.finishBody : t.finishAllCancelledBody

  return replyCustomerPage(
    c,
    t.finishTitle,
    `<h1>${escapeHtml(t.finishHeading)}</h1>
     <p>${escapeHtml(bodyText)}</p>
     <p>${escapeHtml(t.finishFooter)}</p>`,
    locale,
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
      const relative = c.req.path.replace(/^\//, '')
      const ext = path.extname(filePath).toLowerCase()
      const type = staticMime[ext] ?? 'application/octet-stream'
      const headers: Record<string, string> = { 'Content-Type': type }
      if (relative === 'index.html') {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
      } else if (relative.startsWith('assets/')) {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable'
      }
      return c.body(fs.readFileSync(filePath), 200, headers)
    }
    const html = injectSpaLinkPreviewMeta(
      fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8'),
      c.req.path,
    )
    return c.html(html, 200, {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    })
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
  startBirthdayWishScheduler()
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
