import { randomUUID } from 'node:crypto'
import { sql, type AppointmentRow } from '@server/db.js'
import type { DbClient } from '@server/appointments/lock.js'
import { getService } from '@server/catalog/services.js'
import { serviceDisplayName } from '@/i18n/localeHelpers'
import type { Locale } from '@/i18n/types'
import {
  COLOR_GROUP_ROLE,
  COLOR_SPLIT_SEGMENT_MINUTES,
  getWashPhaseStartMinutes,
  serviceUsesLinkedWorkSegments,
  usesColorSplitBooking,
  WASH_COLOR_SERVICE_ID,
} from '@/lib/booking/occupancy'
import {
  defaultColorSplitPattern,
  findReplaceableWorkStepIndex,
  getReplaceableTrailingPolicy,
  patternAfterReplaceable,
  patternHasLinkedWorkSegments,
  patternToOccupiedSegments,
  patternWorkSteps,
  workStepDisplayName,
  type ServiceBookingPattern,
  type ServiceBookingWorkStep,
} from '@/lib/booking/servicePattern'

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export async function getAppointmentsInColorGroup(
  colorGroupId: string,
): Promise<AppointmentRow[]> {
  return sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE color_group_id = ${colorGroupId}
    ORDER BY start_time ASC
  `
}

export async function getColorGroupWashRow(
  colorGroupId: string,
): Promise<AppointmentRow | undefined> {
  const rows = await sql<AppointmentRow[]>`
    SELECT * FROM appointments
    WHERE color_group_id = ${colorGroupId} AND color_group_role = ${COLOR_GROUP_ROLE.wash}
    LIMIT 1
  `
  return rows[0]
}

export type InsertColorGroupParams = {
  groupId: string
  colorId: string
  washId: string
  staffId: string
  staffName: string
  colorServiceId: string
  colorServiceName: string
  washServiceName: string
  date: string
  colorStartTime: string
  durationMinutes: number
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  createdAt: string
  reminderSentAt: string | null
  locale: Locale
  bookingGroupId?: string | null
  seriesId?: string | null
  scope?: string | null
  /** Sin fila de lavado/aclarado: otro tratamiento ocupa ese slot. */
  skipWash?: boolean
  origin?: string | null
  bookingPattern?: ServiceBookingPattern | null
}

function resolvePatternForInsert(
  serviceId: string,
  bookingPattern: ServiceBookingPattern | null | undefined,
): ServiceBookingPattern | null {
  if (patternHasLinkedWorkSegments(bookingPattern)) return bookingPattern!
  if (usesColorSplitBooking(serviceId)) return defaultColorSplitPattern()
  return null
}

async function insertWorkSegmentRow(
  query: DbClient,
  params: {
    id: string
    staffId: string
    staffName: string
    serviceId: string
    serviceName: string
    durationMinutes: number
    date: string
    startTime: string
    customerName: string
    customerPhone: string
    customerEmail: string | null
    notes: string | null
    createdAt: string
    reminderSentAt: string | null
    locale: Locale
    groupId: string
    role: string
    bookingGroupId?: string | null
    seriesId?: string | null
    scope?: string | null
    origin?: string | null
  },
): Promise<void> {
  await query`
    INSERT INTO appointments (
      id, staff_id, staff_name, service_id, service_name, duration_minutes,
      appointment_date, start_time,
      customer_name, customer_phone, customer_email, notes,
      status, created_at, reminder_sent_at, locale,
      color_group_id, color_group_role, booking_group_id, series_id, scope, origin
    ) VALUES (
      ${params.id}, ${params.staffId}, ${params.staffName},
      ${params.serviceId}, ${params.serviceName}, ${params.durationMinutes},
      ${params.date}, ${params.startTime},
      ${params.customerName}, ${params.customerPhone}, ${params.customerEmail}, ${params.notes},
      'confirmed', ${params.createdAt}, ${params.reminderSentAt}, ${params.locale},
      ${params.groupId}, ${params.role}, ${params.bookingGroupId ?? null},
      ${params.seriesId ?? null}, ${params.scope ?? null}, ${params.origin ?? null}
    )
  `
}

/**
 * Inserta el grupo partido: una fila por tramo de trabajo del patrón.
 * El tramo sustituible (o el último work) usa role `wash` (compat agenda/WhatsApp).
 * Sin patrón en BD pero ID color legacy → patrón por defecto; el 2.º tramo sigue
 * pudiendo usar svc-wash-color solo si no hay nombres de tramo (legacy puro).
 */
export async function insertColorBookingGroup(
  params: InsertColorGroupParams,
  query: DbClient = sql,
): Promise<void> {
  const pattern = resolvePatternForInsert(params.colorServiceId, params.bookingPattern)
  const startMinutes = timeToMinutes(params.colorStartTime)

  if (!pattern) {
    // Fallback mínimo legacy hardcodeado.
    await insertWorkSegmentRow(query, {
      id: params.colorId,
      staffId: params.staffId,
      staffName: params.staffName,
      serviceId: params.colorServiceId,
      serviceName: params.colorServiceName,
      durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES,
      date: params.date,
      startTime: params.colorStartTime,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      notes: params.notes,
      createdAt: params.createdAt,
      reminderSentAt: params.reminderSentAt,
      locale: params.locale,
      groupId: params.groupId,
      role: COLOR_GROUP_ROLE.color,
      bookingGroupId: params.bookingGroupId,
      seriesId: params.seriesId,
      scope: params.scope,
      origin: params.origin,
    })
    if (params.skipWash) return
    await insertWorkSegmentRow(query, {
      id: params.washId,
      staffId: params.staffId,
      staffName: params.staffName,
      serviceId: WASH_COLOR_SERVICE_ID,
      serviceName: params.washServiceName,
      durationMinutes: COLOR_SPLIT_SEGMENT_MINUTES,
      date: params.date,
      startTime: minutesToTime(getWashPhaseStartMinutes(startMinutes)),
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      notes: params.notes,
      createdAt: params.createdAt,
      reminderSentAt: params.reminderSentAt,
      locale: params.locale,
      groupId: params.groupId,
      role: COLOR_GROUP_ROLE.wash,
      bookingGroupId: params.bookingGroupId,
      seriesId: params.seriesId,
      scope: params.scope,
      origin: params.origin,
    })
    return
  }

  const workSteps = patternWorkSteps(pattern)
  const replaceableIndexInPattern = findReplaceableWorkStepIndex(pattern)
  const useLegacyWashService =
    usesColorSplitBooking(params.colorServiceId) &&
    !params.bookingPattern &&
    workSteps.length >= 2

  let cursor = startMinutes
  let workOrdinal = 0
  let firstWorkId = params.colorId
  let secondWorkId = params.washId

  for (let i = 0; i < pattern.length; i++) {
    const step = pattern[i]!
    if (step.type === 'break') {
      cursor += step.minutes
      continue
    }

    const workStep = step as ServiceBookingWorkStep
    const isReplaceable =
      (replaceableIndexInPattern >= 0 && i === replaceableIndexInPattern) ||
      (replaceableIndexInPattern < 0 && workOrdinal === workSteps.length - 1 && workSteps.length > 1)

    if (isReplaceable && params.skipWash) {
      // discard / afterReplacement: no más filas aquí (trailing va tras el sustituto si aplica).
      break
    }

    const isFirst = workOrdinal === 0
    const role = isFirst ? COLOR_GROUP_ROLE.color : COLOR_GROUP_ROLE.wash
    const id = isFirst ? firstWorkId : secondWorkId
    // Más de 2 work steps: generar UUID adicionales
    const rowId = isFirst || workOrdinal === 1 ? id : randomUUID()

    const stepLabel = workStepDisplayName(
      workStep,
      params.locale,
      isFirst ? params.colorServiceName : params.washServiceName,
    )
    const serviceName =
      workStep.nameEs || workStep.nameEn
        ? stepLabel
        : isFirst
          ? params.colorServiceName
          : params.washServiceName

    const serviceId =
      !isFirst && useLegacyWashService ? WASH_COLOR_SERVICE_ID : params.colorServiceId

    await insertWorkSegmentRow(query, {
      id: rowId,
      staffId: params.staffId,
      staffName: params.staffName,
      serviceId,
      serviceName,
      durationMinutes: workStep.minutes,
      date: params.date,
      startTime: minutesToTime(cursor),
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      notes: params.notes,
      createdAt: params.createdAt,
      reminderSentAt: params.reminderSentAt,
      locale: params.locale,
      groupId: params.groupId,
      role,
      bookingGroupId: params.bookingGroupId,
      seriesId: params.seriesId,
      scope: params.scope,
      origin: params.origin,
    })

    cursor += workStep.minutes
    workOrdinal += 1
  }
}

/**
 * Inserta los tramos posteriores al sustituible, empezando en `startTime`
 * (p. ej. justo después del tratamiento que ocupó el hueco).
 */
export async function insertTrailingWorkAfterReplacement(
  params: {
    groupId: string
    staffId: string
    staffName: string
    serviceId: string
    serviceNameFallback: string
    bookingPattern: ServiceBookingPattern
    date: string
    startTime: string
    customerName: string
    customerPhone: string
    customerEmail: string | null
    notes: string | null
    createdAt: string
    reminderSentAt: string | null
    locale: Locale
    bookingGroupId?: string | null
    seriesId?: string | null
    scope?: string | null
    origin?: string | null
  },
  query: DbClient = sql,
): Promise<void> {
  const trailing = patternAfterReplaceable(params.bookingPattern)
  if (trailing.length === 0) return
  if (getReplaceableTrailingPolicy(params.bookingPattern) !== 'afterReplacement') return

  const occupied = patternToOccupiedSegments(trailing, timeToMinutes(params.startTime))
  let workOrdinal = 0
  for (let i = 0; i < trailing.length; i++) {
    const step = trailing[i]!
    if (step.type === 'break') continue
    const seg = occupied[workOrdinal]
    if (!seg) break
    const stepLabel = workStepDisplayName(step, params.locale, params.serviceNameFallback)
    await insertWorkSegmentRow(query, {
      id: randomUUID(),
      staffId: params.staffId,
      staffName: params.staffName,
      serviceId: params.serviceId,
      serviceName: step.nameEs || step.nameEn ? stepLabel : params.serviceNameFallback,
      durationMinutes: step.minutes,
      date: params.date,
      startTime: minutesToTime(seg.startMinutes),
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      notes: params.notes,
      createdAt: params.createdAt,
      reminderSentAt: params.reminderSentAt,
      locale: params.locale,
      groupId: params.groupId,
      role: COLOR_GROUP_ROLE.wash,
      bookingGroupId: params.bookingGroupId,
      seriesId: params.seriesId,
      scope: params.scope,
      origin: params.origin,
    })
    workOrdinal += 1
  }
}

export async function prepareColorBookingGroupIds(
  service: { id: string; bookingPattern?: ServiceBookingPattern | null },
): Promise<{ groupId: string; colorId: string; washId: string } | null> {
  if (!serviceUsesLinkedWorkSegments(service)) return null
  return {
    groupId: randomUUID(),
    colorId: randomUUID(),
    washId: randomUUID(),
  }
}

export async function resolveWashServiceName(
  locale: Locale,
  bookingPattern?: ServiceBookingPattern | null,
): Promise<string> {
  if (bookingPattern) {
    const replaceableIndex = findReplaceableWorkStepIndex(bookingPattern)
    if (replaceableIndex >= 0) {
      const step = bookingPattern[replaceableIndex]
      if (step && step.type === 'work') {
        return workStepDisplayName(step, locale, 'Aclarado')
      }
    }
    const works = patternWorkSteps(bookingPattern)
    const last = works[works.length - 1]
    if (last) return workStepDisplayName(last, locale, 'Aclarado')
  }
  const wash = await getService(WASH_COLOR_SERVICE_ID, { onlineOnly: false })
  if (!wash) return 'LAVAR COLOR'
  return serviceDisplayName(wash, locale)
}
