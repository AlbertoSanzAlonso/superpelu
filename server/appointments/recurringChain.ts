import { randomUUID } from 'node:crypto'
import { sql, type AppointmentRow } from '@server/db.js'
import { serviceDisplayName } from '@/i18n/localeHelpers'
import { normalizeLocale } from '@/i18n/types'
import { getStaff, listStaffForService, staffCanPerformService } from '@server/staff/index.js'
import { buildFlexibleServiceStartTimes } from '@/lib/booking/combo'
import { getColorWashReplacementIndex, getOccupiedSegmentsForChainService } from '@/lib/booking/colorCombo'
import {
  customerNameSnapshot,
  getCustomer,
  resolveCustomerFromInput,
  upsertCustomer,
} from '@server/customers/index.js'
import { notifyAppointmentCreated } from '@server/notifications/whatsapp.js'
import { notifyAdminAppointmentCreated } from '@server/notifications/email.js'
import { hoursUntilAppointment } from '@/lib/core/dates'
import { getBookingSpanMinutes, usesColorSplitBooking } from '@/lib/booking/occupancy'
import { lockStaffDaysForBooking } from '@server/appointments/lock.js'
import {
  insertColorBookingGroup,
  prepareColorBookingGroupIds,
  resolveWashServiceName,
} from '@server/appointments/color.js'
import { getAppointmentById } from '@server/appointments/queries.js'
import type { CreateAppointmentInput } from '@server/appointments/types.js'
import {
  getAvailableSlotsForServices,
  isBookingUnavailable,
  isStaffFreeForServiceAt,
  resolveBookingServices,
} from '@server/appointments/booking.js'
import { collectDatesForSeriesScope } from '@server/appointments/seriesDates.js'
import { timeToMinutes } from '@server/appointments/time.js'

export type SeriesConflictResolution = {
  date: string
  action: 'skip' | 'reassign' | 'reschedule'
  staffId?: string
  startTime?: string
}

export type SeriesDateConflict = {
  date: string
  serviceIndex: number
  serviceName: string
  staffId: string
  staffName: string
  idealStartTime: string
  availableSlots: string[]
  availableStaff: { id: string; name: string; freeSlots: string[] }[]
}

export type SeriesPreviewResult = {
  dates: string[]
  conflicts: SeriesDateConflict[]
  okDates: string[]
}

export async function previewRecurringChainConflicts(
  input: CreateAppointmentInput,
  serviceIds: string[],
): Promise<SeriesPreviewResult> {
  const scope = input.scope ?? 'weekly'
  if (scope !== 'weekly') throw new Error('ALCANCE_INVALIDO')

  const staffAssignments =
    input.staffAssignments?.length === serviceIds.length
      ? input.staffAssignments
      : serviceIds.map(() => input.staffId)

  const dates = await collectDatesForSeriesScope(
    input.staffId,
    input.date,
    scope,
    input.endDate,
    true,
  )
  if (dates.length === 0) throw new Error('FECHA_INVALIDA')

  const rawServices = await resolveBookingServices(serviceIds, false)
  const serviceDurations = input.serviceDurations ?? []
  const effectiveServices = rawServices.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && serviceDurations[i] > 0
        ? serviceDurations[i]
        : s.durationMinutes,
  }))
  const serviceStartTimes = buildFlexibleServiceStartTimes(effectiveServices, input.startTime, [])

  const conflicts: SeriesDateConflict[] = []
  const okDates: string[] = []

  for (const day of dates) {
    let dayHasConflict = false

    for (let i = 0; i < effectiveServices.length; i++) {
      const staffId = staffAssignments[i]
      const staff = await getStaff(staffId)
      if (!staff?.active) continue

      const service = effectiveServices[i]
      const svcStart = serviceStartTimes[i]
      const chainOptions = {
        forStaffPortal: true,
        chainServices: effectiveServices,
        chainServiceIndex: i,
      }

      const isFree = await isStaffFreeForServiceAt(day, staffId, service, svcStart, chainOptions)
      if (isFree) continue

      dayHasConflict = true

      const availableSlots = await getAvailableSlotsForServices(day, serviceIds, staffId, {
        forStaffPortal: true,
      })

      const staffList = await listStaffForService(service.id)
      const availableStaff: SeriesDateConflict['availableStaff'] = []
      for (const member of staffList) {
        const memberFree = await isStaffFreeForServiceAt(day, member.id, service, svcStart, chainOptions)
        if (memberFree) {
          const memberSlots = await getAvailableSlotsForServices(day, serviceIds, member.id, {
            forStaffPortal: true,
          })
          availableStaff.push({
            id: member.id,
            name: member.name,
            freeSlots: memberSlots,
          })
        }
      }

      conflicts.push({
        date: day,
        serviceIndex: i,
        serviceName: service.nameEs,
        staffId: staff.id,
        staffName: staff.name,
        idealStartTime: svcStart,
        availableSlots,
        availableStaff,
      })
    }

    if (!dayHasConflict) {
      okDates.push(day)
    }
  }

  return { dates, conflicts, okDates }
}

export async function createRecurringChainedAppointment(
  input: CreateAppointmentInput,
  serviceIds: string[],
  conflictResolutions: SeriesConflictResolution[],
): Promise<AppointmentRow> {
  const scope = input.scope ?? 'weekly'
  if (scope !== 'weekly') throw new Error('ALCANCE_INVALIDO')
  if (input.endDate && input.endDate < input.date) throw new Error('FECHA_FIN_INVALIDA')

  const staffAssignments =
    input.staffAssignments?.length === serviceIds.length
      ? input.staffAssignments
      : serviceIds.map(() => input.staffId)

  for (let i = 0; i < serviceIds.length; i++) {
    const staffId = staffAssignments[i]
    const staff = await getStaff(staffId)
    if (!staff?.active) throw new Error('STAFF_INVALIDO')
    if (!(await staffCanPerformService(staffId, serviceIds[i]))) {
      throw new Error('STAFF_NO_REALIZA_SERVICIO')
    }
  }

  const dates = await collectDatesForSeriesScope(
    input.staffId,
    input.date,
    scope,
    input.endDate,
    true,
  )
  if (dates.length === 0) throw new Error('FECHA_INVALIDA')

  const resolutionMap = new Map<string, SeriesConflictResolution>()
  for (const r of conflictResolutions) {
    resolutionMap.set(r.date, r)
  }

  const rawServices = await resolveBookingServices(serviceIds, false)
  const serviceDurations = input.serviceDurations ?? []
  const effectiveServices = rawServices.map((s, i) => ({
    ...s,
    durationMinutes:
      serviceDurations[i] != null && serviceDurations[i] > 0
        ? serviceDurations[i]
        : s.durationMinutes,
  }))
  const defaultStartTimes = buildFlexibleServiceStartTimes(effectiveServices, input.startTime, [])

  const customer = resolveCustomerFromInput({
    firstName: input.customerFirstName,
    lastName: input.customerLastName,
    customerName: input.customerName,
    phone: input.customerPhone,
  })
  const customerLocaleForUpsert =
    input.customerLocale !== undefined ? normalizeLocale(input.customerLocale) : undefined

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
  const locale = normalizeLocale(profile?.locale ?? input.customerLocale)
  const seriesId = randomUUID()

  const datesToCreate: {
    date: string
    staffAssignments: string[]
    serviceStartTimes: string[]
  }[] = []

  for (const day of dates) {
    const resolution = resolutionMap.get(day)

    if (resolution?.action === 'skip') continue

    let dayStaffAssignments = [...staffAssignments]
    let dayStartTimes = [...defaultStartTimes]

    if (resolution?.action === 'reassign' && resolution.staffId) {
      dayStaffAssignments = dayStaffAssignments.map((s) => s)
      const conflictIdx = effectiveServices.findIndex((_, i) => {
        const conflictStaff = staffAssignments[i]
        return conflictStaff !== resolution.staffId
      })
      if (conflictIdx >= 0) {
        dayStaffAssignments[conflictIdx] = resolution.staffId
      }
    }

    if (resolution?.action === 'reschedule' && resolution.startTime) {
      dayStartTimes = buildFlexibleServiceStartTimes(effectiveServices, resolution.startTime, [])
    }

    datesToCreate.push({
      date: day,
      staffAssignments: dayStaffAssignments,
      serviceStartTimes: dayStartTimes,
    })
  }

  if (datesToCreate.length === 0) throw new Error('FECHA_INVALIDA')

  const allLockKeys = datesToCreate.flatMap((d) =>
    d.staffAssignments.map((staffId) => ({ staffId, date: d.date })),
  )
  const uniqueLockKeys = allLockKeys.filter(
    (key, i, arr) => arr.findIndex((k) => k.staffId === key.staffId && k.date === key.date) === i,
  )

  let firstId = ''

  await sql.begin(async (tx) => {
    await lockStaffDaysForBooking(tx, uniqueLockKeys)

    for (const dayPlan of datesToCreate) {
      const bookingGroupId = randomUUID()

      for (let i = 0; i < effectiveServices.length; i++) {
        const staffId = dayPlan.staffAssignments[i]
        const serviceStartTime = dayPlan.serviceStartTimes[i]
        const segments = getOccupiedSegmentsForChainService(
          effectiveServices,
          i,
          timeToMinutes(serviceStartTime),
        )
        if (await isBookingUnavailable(tx, staffId, dayPlan.date, segments)) {
          throw new Error('HORARIO_ENCADENADO_NO_DISPONIBLE')
        }
      }

      for (let i = 0; i < effectiveServices.length; i++) {
        const service = effectiveServices[i]
        const staffId = dayPlan.staffAssignments[i]
        const staff = await getStaff(staffId)
        if (!staff?.active) throw new Error('STAFF_INVALIDO')
        const serviceStartTime = dayPlan.serviceStartTimes[i]
        const serviceName = serviceDisplayName(service, locale)
        const reminderSentAt =
          hoursUntilAppointment(dayPlan.date, serviceStartTime) <= 24 ? createdAt : null

        if (usesColorSplitBooking(service.id)) {
          const colorGroup = await prepareColorBookingGroupIds(service.id)
          if (!colorGroup) throw new Error('SERVICIO_INVALIDO')
          const skipWash = getColorWashReplacementIndex(effectiveServices) === i + 1
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
              date: dayPlan.date,
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
              seriesId,
              scope,
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
            status, created_at, reminder_sent_at, locale, booking_group_id, series_id, scope
          ) VALUES (
            ${id}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
            ${dayPlan.date}, ${serviceStartTime},
            ${nameSnapshot}, ${customer.phone}, ${input.customerEmail?.trim() || null},
            ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale},
            ${bookingGroupId}, ${seriesId}, ${scope}
          )
        `
        if (!firstId) firstId = id
      }
    }
  })

  if (!firstId) throw new Error('SERVICIO_INVALIDO')

  const row = (await getAppointmentById(firstId))!
  void notifyAppointmentCreated(row, { forStaffPortal: true }).catch((err) => {
    console.error('Superpelu WhatsApp (cita nueva):', err)
  })
  void notifyAdminAppointmentCreated(row)
  return row
}
