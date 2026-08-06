import { randomUUID } from "node:crypto"
import { sql, type AppointmentRow } from "@server/db.js"
import { serviceDisplayName } from "@/i18n/localeHelpers"
import { normalizeLocale } from "@/i18n/types"
import { getStaff, listStaffForService, type PublicStaff } from "@server/staff/index.js"
import { buildFlexibleServiceStartTimes } from "@/lib/booking/combo"
import { getColorWashReplacementIndex, getOccupiedSegmentsForChainService } from "@/lib/booking/colorCombo"
import { upsertCustomerForBooking } from "@server/customers/index.js"
import { notifyAppointmentCreated } from "@server/notifications/whatsapp.js"
import { notifyAdminAppointmentCreated } from "@server/notifications/email.js"
import { hoursUntilAppointment } from "@/lib/core/dates"
import { getBookingSpanMinutes, usesColorSplitBooking } from "@/lib/booking/occupancy"
import { lockStaffDaysForBooking } from "@server/appointments/lock.js"
import {
  insertColorBookingGroup,
  prepareColorBookingGroupIds,
  resolveWashServiceName,
} from "@server/appointments/color.js"
import { getAppointmentById } from "@server/appointments/queries.js"
import type { CreateAppointmentInput } from "@server/appointments/types.js"
import {
  getServiceDaySlots,
  isBookingUnavailable,
  isStaffFreeForServiceAt,
  resolveBookingServices,
  type ResolvedBookingService,
  type SlotOptions,
} from "@server/appointments/booking.js"
import { timeToMinutes } from "@server/appointments/time.js"

export type BookingChainSegmentPlan = {
  serviceIndex: number
  serviceId: string
  startTime: string
  staffId: string
  staffName: string
}

export type ChainContinuationResult =
  | { complete: true; segments: BookingChainSegmentPlan[] }
  | {
      complete: false
      needsTimeChange: boolean
      segments: BookingChainSegmentPlan[]
      next?: {
        serviceIndex: number
        startTime: string
        staff: PublicStaff[]
        /** Profesionales libres a la hora ideal del tratamiento. */
        availableStaffIds: string[]
      }
      conflict?: {
        serviceIndex: number
        staffId: string
      }
      postpone?: {
        serviceIndex: number
        idealStartTime: string
        slots: string[]
      }
    }

export function parseServiceStartOverrides(
  raw: string | undefined,
  length: number,
): (string | undefined)[] {
  if (!raw?.trim()) return Array.from({ length }, () => undefined)
  const parts = raw.split(',').map((part) => {
    const trimmed = part.trim()
    return trimmed === '_' || trimmed === '' ? undefined : trimmed
  })
  while (parts.length < length) parts.push(undefined)
  return parts.slice(0, length)
}

function resolveVisitServiceStartTimes(
  services: ResolvedBookingService[],
  visitStartTime: string,
  serviceStartOverrides: readonly (string | undefined)[],
  staffAssignments?: readonly string[],
): string[] {
  return buildFlexibleServiceStartTimes(
    services,
    visitStartTime,
    serviceStartOverrides,
    staffAssignments,
  )
}

function buildPartialChainSegments(
  services: ResolvedBookingService[],
  visitStartTime: string,
  assignments: readonly string[],
  serviceStartOverrides: readonly (string | undefined)[],
): BookingChainSegmentPlan[] {
  const serviceStartTimes = resolveVisitServiceStartTimes(
    services,
    visitStartTime,
    serviceStartOverrides,
    assignments,
  )
  return assignments.map((staffId, serviceIndex) => ({
    serviceIndex,
    serviceId: services[serviceIndex].id,
    startTime: serviceStartTimes[serviceIndex],
    staffId,
    staffName: '',
  }))
}

async function getPostponeSlotsForService(
  date: string,
  serviceId: string,
  notBeforeTime: string,
  options: SlotOptions,
): Promise<string[]> {
  const notBefore = timeToMinutes(notBeforeTime)
  const daySlots = await getServiceDaySlots(date, serviceId, options)
  return daySlots.filter((slot) => timeToMinutes(slot) >= notBefore)
}

export async function resolveChainContinuation(
  date: string,
  serviceIds: string[],
  visitStartTime: string,
  staffAssignments: string[],
  options: SlotOptions = {},
  serviceStartOverrides: (string | undefined)[] = [],
): Promise<ChainContinuationResult> {
  const rawServices = await resolveBookingServices(serviceIds, !options.forStaffPortal)
  if (rawServices.length < 2) {
    throw new Error('SERVICIO_INVALIDO')
  }

  const serviceDurations = options.serviceDurations ?? []
  const services = rawServices.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && serviceDurations[i] > 0
        ? serviceDurations[i]
        : s.durationMinutes,
  }))

  const overrides = serviceStartOverrides.length
    ? serviceStartOverrides
    : Array.from({ length: services.length }, () => undefined)
  const serviceStartTimes = resolveVisitServiceStartTimes(services, visitStartTime, overrides)
  const segments: BookingChainSegmentPlan[] = []

  for (let i = 0; i < staffAssignments.length; i++) {
    const staff = await getStaff(staffAssignments[i])
    if (!staff?.active) {
      return {
        complete: false,
        needsTimeChange: true,
        segments: buildPartialChainSegments(
          services,
          visitStartTime,
          staffAssignments,
          overrides,
        ),
      }
    }
    const service = services[i]
    const svcStart = serviceStartTimes[i]
    const chainOptions = {
      ...options,
      chainServices: services,
      chainServiceIndex: i,
    }
    if (!(await isStaffFreeForServiceAt(date, staff.id, service, svcStart, chainOptions))) {
      const staffList = await listStaffForService(service.id)
      const viable: PublicStaff[] = []
      for (const member of staffList) {
        if (await isStaffFreeForServiceAt(date, member.id, service, svcStart, chainOptions)) {
          viable.push(member)
        }
      }
      const earliestStart = resolveVisitServiceStartTimes(
        services,
        visitStartTime,
        Array.from({ length: services.length }, () => undefined),
      )[i]
      const postponeSlots = await getPostponeSlotsForService(
        date,
        service.id,
        earliestStart,
        options,
      )

      if (i === staffAssignments.length - 1 && staffList.length > 0) {
        if (viable.length === 0 && postponeSlots.length > 0) {
          return {
            complete: false,
            needsTimeChange: false,
            segments,
            postpone: {
              serviceIndex: i,
              idealStartTime: svcStart,
              slots: postponeSlots,
            },
          }
        }
        return {
          complete: false,
          needsTimeChange: viable.length === 0 && postponeSlots.length === 0,
          segments,
          next: {
            serviceIndex: i,
            startTime: svcStart,
            staff: viable,
            availableStaffIds: viable.map((member) => member.id),
          },
          ...(postponeSlots.length > 0
            ? {
                postpone: {
                  serviceIndex: i,
                  idealStartTime: svcStart,
                  slots: postponeSlots,
                },
              }
            : {}),
        }
      }

      return {
        complete: false,
        needsTimeChange: true,
        segments: buildPartialChainSegments(
          services,
          visitStartTime,
          staffAssignments,
          overrides,
        ),
      }
    }
    segments.push({
      serviceIndex: i,
      serviceId: service.id,
      startTime: svcStart,
      staffId: staff.id,
      staffName: staff.name,
    })
  }

  if (staffAssignments.length >= services.length) {
    return { complete: true, segments }
  }

  const nextIndex = staffAssignments.length
  const nextService = services[nextIndex]
  const nextStart = serviceStartTimes[nextIndex]
  const staffList = await listStaffForService(nextService.id)
  if (staffList.length === 0) {
    return { complete: false, needsTimeChange: true, segments }
  }

  const nextChainOptions = {
    ...options,
    chainServices: services,
    chainServiceIndex: nextIndex,
  }

  const viable: PublicStaff[] = []
  for (const member of staffList) {
    if (
      await isStaffFreeForServiceAt(date, member.id, nextService, nextStart, nextChainOptions)
    ) {
      viable.push(member)
    }
  }

  // Siempre ofrecer horas para este tratamiento (también si hay profesionales
  // a la sugerida). Si nadie puede a esa hora, no listamos ocupadas: solo horas.
  const earliestStart = resolveVisitServiceStartTimes(
    services,
    visitStartTime,
    Array.from({ length: services.length }, () => undefined),
  )[nextIndex]
  const postponeSlots = await getPostponeSlotsForService(
    date,
    nextService.id,
    earliestStart,
    options,
  )

  if (viable.length === 0 && postponeSlots.length > 0) {
    return {
      complete: false,
      needsTimeChange: false,
      segments,
      postpone: {
        serviceIndex: nextIndex,
        idealStartTime: nextStart,
        slots: postponeSlots,
      },
    }
  }

  return {
    complete: false,
    needsTimeChange: viable.length === 0 && postponeSlots.length === 0,
    segments,
    next: {
      serviceIndex: nextIndex,
      startTime: nextStart,
      // Solo profesionales libres a esa hora (no marcar al resto como ocupadas).
      staff: viable,
      availableStaffIds: viable.map((member) => member.id),
    },
    ...(postponeSlots.length > 0
      ? {
          postpone: {
            serviceIndex: nextIndex,
            idealStartTime: nextStart,
            slots: postponeSlots,
          },
        }
      : {}),
  }
}

export async function createChainedBookingAppointment(
  input: CreateAppointmentInput,
  serviceIds: string[],
  staffAssignments: string[],
): Promise<AppointmentRow> {
  const services = await resolveBookingServices(serviceIds, !input.forStaffPortal)
  const serviceDurations = input.serviceDurations ?? []
  const effectiveServices = services.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && serviceDurations[i] > 0
        ? serviceDurations[i]
        : s.durationMinutes,
  }))

  const { phone: customerPhone, nameSnapshot, profile } = await upsertCustomerForBooking({
    customerFirstName: input.customerFirstName,
    customerLastName: input.customerLastName,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    customerNotes: input.customerNotes,
    locale: input.forStaffPortal ? input.customerLocale : normalizeLocale(input.locale),
    birthdate: input.birthdate,
    returningCustomer: input.returningCustomer,
    forStaffPortal: input.forStaffPortal,
  })
  const createdAt = new Date().toISOString()
  const locale = input.forStaffPortal
    ? normalizeLocale(profile.locale ?? input.customerLocale)
    : normalizeLocale(input.locale)
  const reminderSentAt =
    hoursUntilAppointment(input.date, input.startTime) <= 24 ? createdAt : null
  const bookingGroupId = randomUUID()
  // Si hay horas manuales, calcular el encadenado con esos overrides para que los índices
  // vacíos tomen la hora correcta según el contexto real (no el default sin overrides).
  const rawServiceStartTimes =
    input.serviceStartTimes?.length === effectiveServices.length
      ? input.serviceStartTimes
      : []
  const serviceStartTimes = buildFlexibleServiceStartTimes(
    effectiveServices,
    input.startTime,
    rawServiceStartTimes,
    staffAssignments,
  )

  const primaryId = await sql.begin(async (tx) => {
    await lockStaffDaysForBooking(
      tx,
      staffAssignments.map((staffId) => ({ staffId, date: input.date })),
    )

    const allStartMinutes = serviceStartTimes.map(timeToMinutes)
    for (let i = 0; i < effectiveServices.length; i++) {
      const staffId = staffAssignments[i]
      if (!input.forceSchedule) {
        const segments = getOccupiedSegmentsForChainService(
          effectiveServices,
          i,
          allStartMinutes[i],
          staffAssignments,
        )
        if (
          await isBookingUnavailable(
            tx,
            staffId,
            input.date,
            segments,
            input.excludeAppointmentId,
            false,
            input.allowAppointmentOverlap,
          )
        ) {
          throw new Error('HORARIO_ENCADENADO_NO_DISPONIBLE')
        }
      }
    }

    let firstId: string | null = null
    const origin = input.forStaffPortal ? 'backoffice' : 'booking_page'

    for (let i = 0; i < effectiveServices.length; i++) {
      const service = effectiveServices[i]
      const staffId = staffAssignments[i]
      const staff = await getStaff(staffId)
      if (!staff?.active) throw new Error('STAFF_INVALIDO')
      const serviceStartTime = serviceStartTimes[i]
      const serviceName = serviceDisplayName(service, locale)

      if (usesColorSplitBooking(service.id)) {
        const colorGroup = await prepareColorBookingGroupIds(service.id)
        if (!colorGroup) throw new Error('SERVICIO_INVALIDO')
        // Solo omitir lavado si el mismo profesional continúa con peluquería.
        // Otra coloración u otro especialista → lavado propio.
        const skipWash =
          getColorWashReplacementIndex(effectiveServices, i, staffAssignments) != null
        const washServiceName = skipWash ? '' : await resolveWashServiceName(locale)
        await insertColorBookingGroup(
          {
            groupId: colorGroup.groupId,
            colorId: colorGroup.colorId,
            washId: colorGroup.washId,
            staffId: staff.id,
            staffName: staff.name,
            colorServiceId: service.id,
            colorServiceName: serviceName,
            washServiceName,
            date: input.date,
            colorStartTime: serviceStartTime,
            durationMinutes: service.durationMinutes,
            customerName: nameSnapshot,
            customerPhone: customerPhone,
            customerEmail: input.customerEmail?.trim() || null,
            notes: input.notes?.trim() || null,
            createdAt,
            reminderSentAt,
            locale,
            bookingGroupId,
            skipWash,
            origin,
          },
          tx,
        )
        if (!firstId) firstId = colorGroup.colorId
        continue
      }

      const id = randomUUID()
        const storedDuration = getBookingSpanMinutes(
          service.id,
          service.durationMinutes,
          service.bookingPattern,
        )
      await tx`
        INSERT INTO appointments (
          id, staff_id, staff_name, service_id, service_name, duration_minutes,
          appointment_date, start_time,
          customer_name, customer_phone, customer_email, notes,
          status, created_at, reminder_sent_at, locale, booking_group_id, origin
        ) VALUES (
          ${id}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
          ${input.date}, ${serviceStartTime},
          ${nameSnapshot}, ${customerPhone}, ${input.customerEmail?.trim() || null},
          ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale},
          ${bookingGroupId}, ${origin}
        )
      `
      if (!firstId) firstId = id
    }

    if (!firstId) throw new Error('SERVICIO_INVALIDO')
    return firstId
  })

  const row = (await getAppointmentById(primaryId))!
  // Al recrear una visita editada (skipCustomerWhatsApp) no debe avisarse como «cita nueva».
  if (!input.skipCustomerWhatsApp) {
    void notifyAppointmentCreated(row, { forStaffPortal: Boolean(input.forStaffPortal) }).catch(
      (err) => {
        console.error('Superpelu WhatsApp (cita nueva):', err)
      },
    )
    // Email al admin solo en reserva pública (/reservar), no desde agenda.
    if (!input.forStaffPortal) {
      void notifyAdminAppointmentCreated(row)
    }
  }
  return row
}
