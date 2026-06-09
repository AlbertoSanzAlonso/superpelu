import { randomUUID } from "node:crypto"
import { sql, type AppointmentRow } from "@server/db.js"
import { serviceDisplayName } from "@/i18n/localeHelpers"
import { normalizeLocale } from "@/i18n/types"
import { getStaff, listStaffForService, type PublicStaff } from "@server/staff.js"
import { buildFlexibleServiceStartTimes } from "@/lib/bookingCombo"
import { getColorWashReplacementIndex, getOccupiedSegmentsForChainService } from "@/lib/colorComboBooking"
import {
  customerNameSnapshot,
  getCustomer,
  resolveCustomerFromInput,
  upsertCustomer,
} from "@server/customers.js"
import { notifyAppointmentCreated } from "@server/appointmentWhatsApp.js"
import { notifyAdminAppointmentCreated } from "@server/appointmentEmail.js"
import { hoursUntilAppointment } from "@/lib/dates"
import { getBookingSpanMinutes, usesColorSplitBooking } from "@/lib/bookingOccupancy"
import { lockStaffDaysForBooking } from "@server/bookingLock.js"
import {
  insertColorBookingGroup,
  prepareColorBookingGroupIds,
  resolveWashServiceName,
} from "@server/colorBooking.js"
import { getAppointmentById } from "@server/appointmentQueries.js"
import type { CreateAppointmentInput } from "@server/appointmentTypes.js"
import {
  getServiceDaySlots,
  isBookingUnavailable,
  isStaffFreeForServiceAt,
  resolveBookingServices,
  type ResolvedBookingService,
  type SlotOptions,
} from "@server/appointmentBooking.js"
import { timeToMinutes } from "@server/appointmentTime.js"

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
): string[] {
  return buildFlexibleServiceStartTimes(services, visitStartTime, serviceStartOverrides)
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
  const services = await resolveBookingServices(serviceIds, !options.forStaffPortal)
  if (services.length < 2) {
    throw new Error('SERVICIO_INVALIDO')
  }

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
      const postponeSlots =
        overrides[i] === undefined
          ? await getPostponeSlotsForService(date, service.id, svcStart, options)
          : []

      if (i === staffAssignments.length - 1 && staffList.length > 0) {
        return {
          complete: false,
          needsTimeChange: viable.length === 0 && postponeSlots.length === 0,
          segments,
          conflict: {
            serviceIndex: i,
            staffId: staff.id,
          },
          next: {
            serviceIndex: i,
            startTime: svcStart,
            staff: staffList,
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

  return {
    complete: false,
    needsTimeChange: false,
    segments,
    next: {
      serviceIndex: nextIndex,
      startTime: nextStart,
      staff: staffList,
      availableStaffIds: viable.map((member) => member.id),
    },
  }
}

export async function createChainedBookingAppointment(
  input: CreateAppointmentInput,
  serviceIds: string[],
  staffAssignments: string[],
): Promise<AppointmentRow> {
  const services = await resolveBookingServices(serviceIds, !input.forStaffPortal)

  const customer = resolveCustomerFromInput({
    firstName: input.customerFirstName,
    lastName: input.customerLastName,
    customerName: input.customerName,
    phone: input.customerPhone,
  })
  const customerLocaleForUpsert = input.forStaffPortal
    ? input.customerLocale !== undefined
      ? normalizeLocale(input.customerLocale)
      : undefined
    : normalizeLocale(input.locale)

  await upsertCustomer({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: input.customerEmail,
    ...(input.customerNotes !== undefined
      ? { notes: input.customerNotes.trim() || null }
      : {}),
    ...(customerLocaleForUpsert !== undefined ? { locale: customerLocaleForUpsert } : {}),
  })
  const nameSnapshot = customerNameSnapshot(customer.firstName, customer.lastName)

  const profile = await getCustomer(customer.phone)
  const createdAt = new Date().toISOString()
  const locale = input.forStaffPortal
    ? normalizeLocale(profile?.locale ?? input.customerLocale)
    : normalizeLocale(input.locale)
  const reminderSentAt =
    hoursUntilAppointment(input.date, input.startTime) <= 24 ? createdAt : null
  const bookingGroupId = randomUUID()
  const serviceStartTimes =
    input.serviceStartTimes?.length === services.length
      ? input.serviceStartTimes
      : buildFlexibleServiceStartTimes(services, input.startTime, [])

  const primaryId = await sql.begin(async (tx) => {
    await lockStaffDaysForBooking(
      tx,
      staffAssignments.map((staffId) => ({ staffId, date: input.date })),
    )

    for (let i = 0; i < services.length; i++) {
      const staffId = staffAssignments[i]
      const serviceStartTime = serviceStartTimes[i]
      const segments = getOccupiedSegmentsForChainService(
        services,
        i,
        timeToMinutes(serviceStartTime),
      )
      if (await isBookingUnavailable(tx, staffId, input.date, segments)) {
        throw new Error('HORARIO_ENCADENADO_NO_DISPONIBLE')
      }
    }

    let firstId: string | null = null

    for (let i = 0; i < services.length; i++) {
      const service = services[i]
      const staffId = staffAssignments[i]
      const staff = await getStaff(staffId)
      if (!staff?.active) throw new Error('STAFF_INVALIDO')
      const serviceStartTime = serviceStartTimes[i]
      const serviceName = serviceDisplayName(service, locale)

      if (usesColorSplitBooking(service.id)) {
        const colorGroup = await prepareColorBookingGroupIds(service.id)
        if (!colorGroup) throw new Error('SERVICIO_INVALIDO')
        const skipWash = getColorWashReplacementIndex(services) === i + 1
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
            customerPhone: customer.phone,
            customerEmail: input.customerEmail?.trim() || null,
            notes: input.notes?.trim() || null,
            createdAt,
            reminderSentAt,
            locale,
            bookingGroupId,
            skipWash,
          },
          tx,
        )
        if (!firstId) firstId = colorGroup.colorId
        continue
      }

      const id = randomUUID()
      const storedDuration = getBookingSpanMinutes(service.id, service.durationMinutes)
      await tx`
        INSERT INTO appointments (
          id, staff_id, staff_name, service_id, service_name, duration_minutes,
          appointment_date, start_time,
          customer_name, customer_phone, customer_email, notes,
          status, created_at, reminder_sent_at, locale, booking_group_id
        ) VALUES (
          ${id}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
          ${input.date}, ${serviceStartTime},
          ${nameSnapshot}, ${customer.phone}, ${input.customerEmail?.trim() || null},
          ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale},
          ${bookingGroupId}
        )
      `
      if (!firstId) firstId = id
    }

    if (!firstId) throw new Error('SERVICIO_INVALIDO')
    return firstId
  })

  const row = (await getAppointmentById(primaryId))!
  void notifyAppointmentCreated(row, { forStaffPortal: Boolean(input.forStaffPortal) }).catch(
    (err) => {
      console.error('Superpelu WhatsApp (cita nueva):', err)
    },
  )
  void notifyAdminAppointmentCreated(row)
  return row
}
