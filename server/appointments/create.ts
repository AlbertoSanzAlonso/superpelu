import { randomUUID } from "node:crypto"
import { sql, type AppointmentRow } from "@server/db.js"
import { getService } from "@server/catalog/services.js"
import { serviceDisplayName } from "@/i18n/localeHelpers"
import { normalizeLocale } from "@/i18n/types"
import { isStaffWorkingOnDate } from "@server/staff/availability.js"
import { getStaff, staffCanPerformService } from "@server/staff/index.js"
import { buildFlexibleServiceStartTimes } from "@/lib/booking/combo"
import {
  customerNameSnapshot,
  getCustomer,
  resolveCustomerFromInput,
  upsertCustomer,
} from "@server/customers/index.js"
import { notifyAppointmentCreated } from "@server/notifications/whatsapp.js"
import { notifyAdminAppointmentCreated } from "@server/notifications/email.js"
import { hoursUntilAppointment } from "@/lib/core/dates"
import { isBookingDateAllowed } from "@server/schedule/salonDay.js"
import {
  getBookingSpanMinutes,
  getOccupiedSegmentsForBooking,
  usesColorSplitBooking,
} from "@/lib/booking/occupancy"
import { lockStaffDayForBooking, lockStaffDaysForBooking } from "@server/appointments/lock.js"
import {
  insertColorBookingGroup,
  prepareColorBookingGroupIds,
  resolveWashServiceName,
} from "@server/appointments/color.js"
import { getAppointmentById } from "@server/appointments/queries.js"
import {
  assertBookingAvailable,
  getAvailableSlotsForServices,
  getServiceDaySlotsForServices,
  normalizeServiceIds,
  resolveBookingServices,
} from "@server/appointments/booking.js"
import { createChainedBookingAppointment, resolveChainContinuation } from "@server/appointments/chain.js"
import { collectDatesForSeriesScope } from "@server/appointments/seriesDates.js"
import { createRecurringChainedAppointment } from "@server/appointments/recurringChain.js"
import { timeToMinutes } from "@server/appointments/time.js"
import type { CreateAppointmentInput } from "@server/appointments/types.js"
export type { CreateAppointmentInput } from "@server/appointments/types.js"
export type { AppointmentSeriesMode } from "@server/appointments/series.js"
export { getAppointmentSeriesMeta } from "@server/appointments/series.js"

type ResolvedStaffService = NonNullable<Awaited<ReturnType<typeof getService>>>
type ResolvedStaff = NonNullable<Awaited<ReturnType<typeof getStaff>>>

async function createRecurringStaffAppointment(
  input: CreateAppointmentInput,
  service: ResolvedStaffService,
  staff: ResolvedStaff,
): Promise<AppointmentRow> {
  const scope = input.scope ?? 'single'
  if (scope !== 'weekly') throw new Error('ALCANCE_INVALIDO')
  if (input.endDate && input.endDate < input.date) throw new Error('FECHA_FIN_INVALIDA')

  const dates = await collectDatesForSeriesScope(
    staff.id,
    input.date,
    scope,
    input.endDate,
    true,
  )
  if (dates.length === 0) throw new Error('FECHA_INVALIDA')

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
  const serviceName = serviceDisplayName(service, locale)
  const bookingSegments = getOccupiedSegmentsForBooking(
    service.id,
    timeToMinutes(input.startTime),
    service.durationMinutes,
  )
  const seriesId = randomUUID()
  const usesColorSplit = usesColorSplitBooking(service.id)
  const washServiceName = usesColorSplit ? await resolveWashServiceName(locale) : null

  let firstId = ''

  const primaryId = await sql.begin(async (tx) => {
    await lockStaffDaysForBooking(
      tx,
      dates.map((day) => ({ staffId: staff.id, date: day })),
    )

    for (const day of dates) {
      await assertBookingAvailable(tx, staff.id, day, bookingSegments)
      const reminderSentAt =
        hoursUntilAppointment(day, input.startTime) <= 24 ? createdAt : null

      const origin = input.forStaffPortal ? 'backoffice' : 'booking_page'

      if (usesColorSplit) {
        const colorGroup = await prepareColorBookingGroupIds(service.id)
        if (!colorGroup) throw new Error('SERVICIO_INVALIDO')
        await insertColorBookingGroup(
          {
            groupId: colorGroup.groupId,
            colorId: colorGroup.colorId,
            washId: colorGroup.washId,
            staffId: staff.id,
            staffName: staff.name,
            colorServiceId: service.id,
            colorServiceName: serviceName,
            washServiceName: washServiceName!,
            date: day,
            colorStartTime: input.startTime,
            durationMinutes: service.durationMinutes,
            customerName: nameSnapshot,
            customerPhone: customer.phone,
            customerEmail: input.customerEmail?.trim() || null,
            notes: input.notes?.trim() || null,
            createdAt,
            reminderSentAt,
            locale,
            seriesId,
            scope,
            origin,
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
          status, created_at, reminder_sent_at, locale, series_id, scope, origin
        ) VALUES (
          ${id}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
          ${day}, ${input.startTime},
          ${nameSnapshot}, ${customer.phone}, ${input.customerEmail?.trim() || null},
          ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale},
          ${seriesId}, ${scope}, ${origin}
        )
      `
      if (!firstId) firstId = id
    }

    if (!firstId) throw new Error('SERVICIO_INVALIDO')
    return firstId
  })

  const row = (await getAppointmentById(primaryId))!
  void notifyAppointmentCreated(row, { forStaffPortal: true }).catch((err) => {
    console.error('Superpelu WhatsApp (cita nueva):', err)
  })
  void notifyAdminAppointmentCreated(row)
  return row
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<AppointmentRow> {
  const serviceIds = normalizeServiceIds(input)
  if (serviceIds.length === 0) throw new Error('SERVICIO_INVALIDO')

  if (serviceIds.length > 1) {
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

    const dateOk = await isBookingDateAllowed(input.date, { forStaffPortal: input.forStaffPortal })
    if (!dateOk) throw new Error('FECHA_INVALIDA')

    const scope = input.scope ?? 'single'
    if (input.forStaffPortal && scope === 'weekly') {
      return createRecurringChainedAppointment(
        input,
        serviceIds,
        input.conflictResolutions ?? [],
      )
    }

    for (const staffId of new Set(staffAssignments)) {
      if (!(await isStaffWorkingOnDate(staffId, input.date))) {
        throw new Error('FECHA_INVALIDA')
      }
    }

    const rawServices = await resolveBookingServices(serviceIds, !input.forStaffPortal)
    const serviceDurations = input.serviceDurations ?? []
    const effectiveServices = rawServices.map((s, i) => ({
      ...s,
      durationMinutes:
        serviceDurations[i] != null && serviceDurations[i] > 0
          ? serviceDurations[i]
          : s.durationMinutes,
    }))
    const rawServiceStartTimes =
      input.serviceStartTimes?.length === serviceIds.length
        ? input.serviceStartTimes
        : []
    // Calcular el encadenado teniendo en cuenta los overrides ya introducidos,
    // para que los índices vacíos tomen la hora correcta según el contexto real.
    const serviceStartTimes = buildFlexibleServiceStartTimes(
      effectiveServices,
      input.startTime,
      rawServiceStartTimes,
    )
    const chainedDefault = buildFlexibleServiceStartTimes(effectiveServices, input.startTime, [])
    const serviceStartOverrides = serviceStartTimes.map((time, index) =>
      time === chainedDefault[index] || !time ? undefined : time,
    )

    if (!input.forceSchedule) {
      const daySlots = await getServiceDaySlotsForServices(input.date, serviceIds, {
        forStaffPortal: input.forStaffPortal,
        excludeAppointmentId: input.excludeAppointmentId,
        serviceDurations,
      })
      if (!daySlots.includes(input.startTime)) throw new Error('HORARIO_NO_DISPONIBLE')

      const chain = await resolveChainContinuation(
        input.date,
        serviceIds,
        input.startTime,
        staffAssignments,
        { forStaffPortal: input.forStaffPortal, excludeAppointmentId: input.excludeAppointmentId, serviceDurations },
        serviceStartOverrides,
      )
      if (!chain.complete) throw new Error('HORARIO_ENCADENADO_NO_DISPONIBLE')
    }

    return createChainedBookingAppointment(
      { ...input, serviceStartTimes },
      serviceIds,
      staffAssignments,
    )
  }

  const staff = await getStaff(input.staffId)
  if (!staff || !staff.active) throw new Error('STAFF_INVALIDO')

  for (const serviceId of serviceIds) {
    if (!(await staffCanPerformService(input.staffId, serviceId))) {
      throw new Error('STAFF_NO_REALIZA_SERVICIO')
    }
  }

  const dateOk =
    (await isBookingDateAllowed(input.date, { forStaffPortal: input.forStaffPortal })) &&
    (await isStaffWorkingOnDate(input.staffId, input.date))

  if (!dateOk) throw new Error('FECHA_INVALIDA')

  if (!input.forceSchedule) {
    const slots = await getAvailableSlotsForServices(
      input.date,
      serviceIds,
      input.staffId,
      { forStaffPortal: input.forStaffPortal },
    )
    if (!slots.includes(input.startTime)) throw new Error('HORARIO_NO_DISPONIBLE')
  }

  const service = await getService(serviceIds[0], { onlineOnly: !input.forStaffPortal })
  if (!service) throw new Error('SERVICIO_INVALIDO')

  const scope = input.scope ?? 'single'
  if (input.forStaffPortal && scope !== 'single') {
    return createRecurringStaffAppointment(input, service, staff)
  }

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
  const serviceName = serviceDisplayName(service, locale)

  // Si la cita es en menos de 24h, no hay recordatorio: se marca como ya gestionado.
  const reminderSentAt =
    hoursUntilAppointment(input.date, input.startTime) <= 24 ? createdAt : null

  const origin = input.forStaffPortal ? 'backoffice' : 'booking_page'

  const customDuration = input.serviceDurations?.[0] ?? null
  const useCustomDuration = customDuration != null && customDuration > 0
  const durationForSegments = useCustomDuration ? customDuration : service.durationMinutes
  const colorGroup = await prepareColorBookingGroupIds(service.id)
  const bookingSegments = getOccupiedSegmentsForBooking(
    service.id,
    timeToMinutes(input.startTime),
    durationForSegments,
  )

  const primaryId = await sql.begin(async (tx) => {
    await lockStaffDayForBooking(tx, staff.id, input.date)
    if (!input.forceSchedule) {
      await assertBookingAvailable(tx, staff.id, input.date, bookingSegments)
    }

    if (colorGroup) {
      const washServiceName = await resolveWashServiceName(locale)
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
          colorStartTime: input.startTime,
          durationMinutes: service.durationMinutes,
          customerName: nameSnapshot,
          customerPhone: customer.phone,
          customerEmail: input.customerEmail?.trim() || null,
          notes: input.notes?.trim() || null,
          createdAt,
          reminderSentAt,
          locale,
          origin,
        },
        tx,
      )
      return colorGroup.colorId
    }

    const id = randomUUID()
    const storedDuration = useCustomDuration
      ? customDuration
      : getBookingSpanMinutes(service.id, service.durationMinutes)
    await tx`
      INSERT INTO appointments (
        id, staff_id, staff_name, service_id, service_name, duration_minutes,
        appointment_date, start_time,
        customer_name, customer_phone, customer_email, notes,
        status, created_at, reminder_sent_at, locale, series_id, scope, origin
      ) VALUES (
        ${id}, ${staff.id}, ${staff.name}, ${service.id}, ${serviceName}, ${storedDuration},
        ${input.date}, ${input.startTime},
        ${nameSnapshot}, ${customer.phone}, ${input.customerEmail?.trim() || null},
        ${input.notes?.trim() || null}, 'confirmed', ${createdAt}, ${reminderSentAt}, ${locale},
        ${null}, ${null}, ${origin}
      )
    `
    return id
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
