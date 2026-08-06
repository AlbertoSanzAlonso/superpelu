import { useCallback, useMemo } from 'react'
import { AppointmentClientPanelEdit } from '@/components/agenda/AppointmentClientPanelEdit'
import { AppointmentClientPanelView } from '@/components/agenda/AppointmentClientPanelView'
import { AppointmentServiceBlocks } from '@/components/agenda/AppointmentServiceBlocks'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { AppointmentModalFooter } from '@/components/agenda/AppointmentModalFooter'
import { ServiceCategoryPicker } from '@/components/shared/ServiceCategoryPicker'
import { Button } from '@/components/ui/Button'
import { formatCustomerDisplayName } from '@/lib/customer/name'
import { formatDisplayDate } from '@/lib/core/dates'
import {
  APPOINTMENT_STATUS_NO_SHOW,
  canMarkAppointmentNoShow,
} from '@/lib/agenda/noShow'
import { checkServiceOverlaps } from '@/lib/agenda/serviceOverlaps'
import { ScrollableTimeSelect } from '@/components/agenda/ScrollableTimeSelect'
import {
  ALL_DAY_SLOTS,
  buildEditableServiceTimeOptions,
} from '@/lib/agenda/serviceTimeOptions'
import { buildEarliestEditableServiceStartTimes } from '@/lib/booking/combo'
import type { Appointment, BookableService, DayScheduleAppointment } from '@/types/booking'
import { typography } from '@/styles/typography'

export type AgendaStaffOption = { id: string; name: string }

type Props = {
  open: boolean
  mode: 'view' | 'edit'
  date: string
  staffId: string
  staffName: string
  staffOptions: AgendaStaffOption[]
  onStaffChange: (staffId: string) => void
  /** Actualiza el profesional activo sin tocar el resto de staffAssignments (multi-tratamiento). */
  onActiveStaffSync?: (staffId: string) => void
  appointment: DayScheduleAppointment
  customerRegistered: boolean
  draft: AppointmentDraft
  services: BookableService[]
  slots: string[]
  slotsOverHours?: string[]
  /** Slots libres por tratamiento (índice = posición en serviceIds). */
  serviceSlots?: string[][]
  /** Profesional alternativo libre a la hora ocupada de un tratamiento adicional. */
  serviceAlternativeStaff?: ({ id: string; name: string } | null)[]
  saving?: boolean
  onModeChange: (mode: 'view' | 'edit') => void
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onCancelAppointment?: () => void
  onMarkNoShow?: () => void
  /** Historial de citas del cliente (solo administración). */
  showCustomerHistory?: boolean
  adminToken?: string
  reviewRequestSentAt?: string | null
  onReviewRequestSent?: (sentAt: string) => void
  onCustomerRegisteredChange?: (registered: boolean, reviewRequestSentAt?: string | null) => void
  error?: string
}

export function AgendaAppointmentModal({
  open,
  mode,
  date,
  staffId,
  staffName,
  staffOptions,
  onStaffChange,
  onActiveStaffSync,
  appointment,
  customerRegistered,
  draft,
  services,
  slots,
  slotsOverHours = [],
  serviceSlots,
  serviceAlternativeStaff,
  saving = false,
  onModeChange,
  onDraftChange,
  onSubmit,
  onClose,
  onCancelAppointment,
  onMarkNoShow,
  showCustomerHistory = false,
  adminToken,
  reviewRequestSentAt = null,
  onReviewRequestSent,
  onCustomerRegisteredChange,
  error,
}: Props) {
  const appointmentStatus = appointment.status ?? 'confirmed'
  const showNoShowAction =
    onMarkNoShow &&
    canMarkAppointmentNoShow(date, appointment.startTime, appointmentStatus)
  const isNoShow = appointmentStatus === APPOINTMENT_STATUS_NO_SHOW
  const createdLabel = useMemo(() => {
    if (!appointment.createdAt) return null
    return new Date(appointment.createdAt).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [appointment.createdAt])

  const ownTimes = useMemo(() => {
    const times = new Set<string>()
    if (draft.startTime) times.add(draft.startTime)
    for (const time of draft.serviceStartTimes) {
      if (time) times.add(time)
    }
    return times
  }, [draft.startTime, draft.serviceStartTimes])

  // En edición, las horas de esta misma cita no cuentan como ocupadas.
  const freeSet = useMemo(() => {
    const set = new Set(slots)
    for (const time of ownTimes) set.add(time)
    return set
  }, [slots, ownTimes])
  const overHoursSet = useMemo(() => new Set(slotsOverHours), [slotsOverHours])
  const displayFreeSlots = useMemo(
    () =>
      [...new Set([...slots, ...[...ownTimes].filter((t) => !overHoursSet.has(t))])].sort(),
    [slots, ownTimes, overHoursSet],
  )
  const mainOccupiedOptions = useMemo(
    () => ALL_DAY_SLOTS.filter((t) => !freeSet.has(t) && !overHoursSet.has(t)),
    [freeSet, overHoursSet],
  )
  const mainExtraCurrent = useMemo(
    () =>
      draft.startTime &&
      !freeSet.has(draft.startTime) &&
      !overHoursSet.has(draft.startTime) &&
      !mainOccupiedOptions.includes(draft.startTime)
        ? [draft.startTime]
        : [],
    [draft.startTime, freeSet, overHoursSet, mainOccupiedOptions],
  )
  const isOverHoursSelected = draft.startTime ? overHoursSet.has(draft.startTime) : false
  const isMainOccupiedSelected =
    Boolean(draft.startTime) && !freeSet.has(draft.startTime) && !overHoursSet.has(draft.startTime)

  const serviceIds = draft.serviceIds.length > 0 ? draft.serviceIds : ['']
  const hasServices = draft.serviceIds.length > 0 && draft.serviceIds[0] !== ''

  const chainedStartTimes = useMemo(() => {
    if (!draft.startTime || draft.serviceIds.length === 0 || draft.serviceIds[0] === '') return []
    const entries: {
      formIndex: number
      service: { id: string; categoryId: string; durationMinutes: number }
      override: string | undefined
    }[] = []
    for (let i = 0; i < draft.serviceIds.length; i++) {
      const id = draft.serviceIds[i]
      if (!id) continue
      const svc = services.find((s) => s.id === id)
      if (!svc) continue
      const customDuration = draft.serviceDurations[i]
      entries.push({
        formIndex: i,
        service: {
          id: svc.id,
          categoryId: svc.categoryId ?? '',
          durationMinutes:
            customDuration != null && customDuration > 0 ? customDuration : svc.durationMinutes,
        },
        override: draft.serviceStartTimes[i],
      })
    }
    if (entries.length === 0) return []
    // Mínimo editable por tratamiento: sin el override propio (permite atrasar
    // un tratamiento fijado a huecos anteriores libres).
    const earliest = buildEarliestEditableServiceStartTimes(
      entries.map((e) => e.service),
      draft.startTime,
      entries.map((e) => e.override),
    )
    const byFormIndex = draft.serviceIds.map(() => '')
    entries.forEach((entry, j) => {
      byFormIndex[entry.formIndex] = earliest[j]!
    })
    return byFormIndex
  }, [draft.startTime, draft.serviceIds, draft.serviceDurations, draft.serviceStartTimes, services])

  const serviceOverlaps = useMemo(
    () => checkServiceOverlaps(draft, services, staffId),
    [draft, services, staffId],
  )
  const hasOverlaps = serviceOverlaps.length > 0

  const normalizeArr = useCallback(
    <T,>(ids: string[], arr: T[], fill: T): T[] => ids.map((_, i) => (i < arr.length ? arr[i] : fill)),
    [],
  )

  const setStaffAtIndex = useCallback(
    (index: number, id: string) => {
      const assignments = normalizeArr(draft.serviceIds, draft.staffAssignments, staffId).map(
        (assigned) => assigned || staffId,
      )
      assignments[index] = id
      onDraftChange({ staffAssignments: assignments })
      // Solo sincroniza la columna activa; no reasigna el resto de tratamientos.
      if (index === 0 && id && onActiveStaffSync) {
        onActiveStaffSync(id)
      } else if (index === 0 && id && serviceIds.filter(Boolean).length <= 1) {
        onStaffChange(id)
      }
    },
    [
      draft.serviceIds,
      draft.staffAssignments,
      staffId,
      serviceIds,
      onDraftChange,
      onStaffChange,
      onActiveStaffSync,
      normalizeArr,
    ],
  )

  const setServiceAtIndex = useCallback(
    (index: number, id: string) => {
      const next = [...(draft.serviceIds.length > 0 ? draft.serviceIds : [''])]
      if (index === 0 && id === '') {
        const hadService = next[0] !== ''
        if (hadService) {
          onDraftChange({
            serviceIds: [],
            serviceStartTimes: [],
            serviceDurations: [],
            staffAssignments: [],
            startTime: '',
          })
        }
        return
      }
      next[index] = id
      const selectedService = services.find((s) => s.id === id)
      const newDurations = [...normalizeArr(next, draft.serviceDurations, null as number | null)]
      if (selectedService) {
        newDurations[index] = selectedService.durationMinutes
      }
      const newAssignments = normalizeArr(next, draft.staffAssignments, staffId)
      if (id && !newAssignments[index]) {
        newAssignments[index] = staffId
      }
      onDraftChange({
        serviceIds: next,
        serviceStartTimes: draft.serviceStartTimes.length === next.length ? draft.serviceStartTimes : [],
        serviceDurations: newDurations,
        staffAssignments: newAssignments,
      })
    },
    [
      draft.serviceIds,
      draft.serviceStartTimes,
      draft.serviceDurations,
      draft.staffAssignments,
      services,
      staffId,
      onDraftChange,
      normalizeArr,
    ],
  )

  const setServiceStartTime = useCallback(
    (index: number, time: string) => {
      const times = [
        ...(draft.serviceStartTimes.length === draft.serviceIds.length
          ? draft.serviceStartTimes
          : []),
      ]
      times[index] = time
      const patch: Partial<AppointmentDraft> = { serviceStartTimes: times }
      if (index === 0 && time) {
        patch.startTime = time
      }
      onDraftChange(patch)
    },
    [draft.serviceStartTimes, draft.serviceIds.length, onDraftChange],
  )

  const setServiceDuration = useCallback(
    (index: number, duration: number | null) => {
      const durations = [
        ...(draft.serviceDurations.length === draft.serviceIds.length
          ? draft.serviceDurations
          : []),
      ]
      durations[index] = duration
      onDraftChange({ serviceDurations: durations })
    },
    [draft.serviceDurations, draft.serviceIds.length, onDraftChange],
  )

  const addService = useCallback(() => {
    const next = [...serviceIds.filter((s) => s !== ''), '']
    const newAssignments = normalizeArr(next, draft.staffAssignments, staffId).map(
      (id) => id || staffId,
    )
    onDraftChange({ serviceIds: next, staffAssignments: newAssignments })
  }, [serviceIds, draft.staffAssignments, staffId, onDraftChange, normalizeArr])

  const removeService = useCallback(
    (index: number) => {
      const next = serviceIds.filter((_, i) => i !== index)
      const cleaned = next.filter((s) => s !== '')
      const times =
        draft.serviceStartTimes.length === serviceIds.length
          ? draft.serviceStartTimes.filter((_, i) => i !== index)
          : []
      const durations =
        draft.serviceDurations.length === serviceIds.length
          ? draft.serviceDurations.filter((_, i) => i !== index)
          : []
      const assignments =
        draft.staffAssignments.length === serviceIds.length
          ? draft.staffAssignments.filter((_, i) => i !== index)
          : []
      onDraftChange({
        serviceIds: cleaned,
        serviceStartTimes: times,
        serviceDurations: durations,
        staffAssignments: assignments,
        startTime: cleaned.length === 0 ? '' : times[0] || draft.startTime,
      })
    },
    [serviceIds, draft, onDraftChange],
  )

  if (!open) return null

  const appointmentForReview: Appointment | null = {
    id: appointment.id,
    staffId,
    staffName,
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName,
    durationMinutes: appointment.durationMinutes,
    colorGroupRole: appointment.colorGroupRole,
    date,
    startTime: appointment.startTime,
    customerName: formatCustomerDisplayName(draft.customerFirstName, draft.customerLastName),
    customerPhone: draft.customerPhone,
    customerEmail: draft.customerEmail || null,
    notes: draft.notes || null,
    status: appointment.status,
    locale: draft.customerLocale,
    createdAt: appointment.createdAt,
  }

  const selectCn =
    'w-full cursor-pointer border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-50'
  const showReviewRequest = showCustomerHistory

  return (
    <div
      className="fixed inset-0 z-50 flex bg-charcoal/45 sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agenda-apt-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-dvh w-full max-w-3xl flex-col overflow-hidden bg-cream sm:h-auto sm:max-h-[92vh] sm:border sm:border-gold/30 sm:shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gold/15 px-4 py-3 sm:px-5">
          <div>
            <h2 id="agenda-apt-modal-title" className={`${typography.h3} text-gold`}>
              Cita
              {isNoShow && (
                <span className="ml-2 text-sm font-normal text-charcoal-muted">· Inasistencia</span>
              )}
            </h2>
            {createdLabel && (
              <p className={`${typography.caption} mt-0.5 text-charcoal-muted`}>
                Creada {createdLabel} · Backoffice
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer border border-gold/30 px-2.5 py-1.5 text-sm text-charcoal-muted hover:border-gold"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 sm:px-5"
            role="alert"
          >
            {error}
          </div>
        )}

        {mode === 'view' ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-6 lg:grid-cols-2">
                <section>
                  <p className="mb-3 font-semibold capitalize text-charcoal">
                    {formatDisplayDate(date)}
                  </p>
                  <p className={`${typography.caption} mb-2 text-charcoal-muted`}>
                    Con {staffName}
                  </p>
                  <AppointmentServiceBlocks
                    appointment={appointment}
                    staffName={staffName}
                    services={services}
                  />
                </section>
                <section>
                  <AppointmentClientPanelView
                    draft={draft}
                    customerRegistered={customerRegistered}
                    showCustomerHistory={showCustomerHistory}
                    adminToken={adminToken}
                    onEditClient={() => onModeChange('edit')}
                  />
                </section>
              </div>
            </div>

            <AppointmentModalFooter
              showReviewRequest={showReviewRequest}
              adminToken={adminToken}
              phone={draft.customerPhone}
              reviewRequestSentAt={reviewRequestSentAt ?? null}
              appointment={appointmentForReview}
              onReviewRequestSent={onReviewRequestSent}
            >
              <Button type="button" variant="solid" size="sm" onClick={() => onModeChange('edit')}>
                Editar
              </Button>
              {showNoShowAction && (
                <Button type="button" variant="outline" size="sm" onClick={onMarkNoShow}>
                  Inasistencia
                </Button>
              )}
              {onCancelAppointment && (
                <button
                  type="button"
                  onClick={onCancelAppointment}
                  className="cursor-pointer text-sm text-charcoal-muted underline-offset-2 hover:text-red-800 hover:underline"
                >
                  Eliminar
                </button>
              )}
            </AppointmentModalFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="space-y-3">
                  <p className={`${typography.label} text-gold`}>Cita</p>
                  <p className={`${typography.caption} capitalize text-charcoal-muted`}>
                    {formatDisplayDate(date)}
                  </p>
                  {staffOptions.length > 0 && serviceIds.filter(Boolean).length <= 1 && (
                    <div>
                      <label className={`${typography.label} mb-0.5 block text-xs`}>
                        Profesional
                      </label>
                      <select
                        required
                        value={staffId}
                        onChange={(e) => onStaffChange(e.target.value)}
                        className={selectCn}
                      >
                        {staffOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className={`${typography.label} mb-0.5 block text-xs`}>
                      Hora de la cita
                    </label>
                    <ScrollableTimeSelect
                      value={draft.startTime}
                      onChange={(time) =>
                        onDraftChange({
                          startTime: time,
                          serviceStartTimes: [],
                        })
                      }
                      emptyLabel={hasServices ? 'Elige hora' : 'Tratamiento primero'}
                      freeOptions={displayFreeSlots}
                      overHoursOptions={slotsOverHours}
                      occupiedOptions={[...mainExtraCurrent, ...mainOccupiedOptions]}
                      className={selectCn}
                      disabled={!hasServices}
                      required
                    />
                    {isOverHoursSelected && (
                      <p className="mt-1 text-xs text-amber-700">
                        Esta hora va más allá del horario del salón.
                      </p>
                    )}
                    {isMainOccupiedSelected && (
                      <p className="mt-1 text-xs text-amber-700">
                        Esta hora está ocupada; se guardará igualmente.
                      </p>
                    )}
                  </div>

                  {serviceIds.map((serviceId, index) => (
                    <div key={index} className="relative space-y-2 rounded border border-gold/15 p-3">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeService(index)}
                          className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full border border-red-300 bg-red-50 text-xs text-red-600 hover:bg-red-100"
                          aria-label="Quitar tratamiento"
                        >
                          ×
                        </button>
                      )}
                      <ServiceCategoryPicker
                        compact
                        variant="staff"
                        services={services}
                        serviceId={serviceId}
                        loading={services.length === 0}
                        onServiceChange={(id) => setServiceAtIndex(index, id)}
                      />
                      {serviceId && staffOptions.length > 1 && (
                        <div>
                          <label className={`${typography.label} mb-0.5 block text-xs`}>
                            Especialista
                          </label>
                          <select
                            value={draft.staffAssignments[index] || staffId}
                            onChange={(e) => setStaffAtIndex(index, e.target.value)}
                            className={selectCn}
                          >
                            {staffOptions.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {serviceId && index > 0 && (() => {
                        const currentVal = draft.serviceStartTimes[index] ?? ''
                        const {
                          freeOptions: freeOptionsDisplay,
                          occupiedOptions,
                          extraCurrent,
                          isOccupied,
                        } = buildEditableServiceTimeOptions({
                          currentVal,
                          perServiceFree: serviceSlots?.[index] ?? [],
                          fallbackFree: [],
                          // Solo la hora de este tratamiento: no mezclar huecos de otros especialistas.
                          ownTimes: currentVal ? [currentVal] : [],
                        })
                        const chainedLabel =
                          draft.startTime && chainedStartTimes[index]
                            ? chainedStartTimes[index]
                            : 'Automática (encadenada)'

                        return (
                          <div>
                            <label className={`${typography.label} mb-0.5 block text-xs`}>
                              Hora de inicio
                            </label>
                            <ScrollableTimeSelect
                              value={currentVal}
                              onChange={(time) => setServiceStartTime(index, time)}
                              emptyLabel={chainedLabel}
                              freeOptions={freeOptionsDisplay}
                              occupiedOptions={[...extraCurrent, ...occupiedOptions]}
                              className={selectCn}
                            />
                            {isOccupied && (
                              <div className="mt-1 space-y-0.5 text-xs text-amber-700">
                                {freeOptionsDisplay.length > 0 && (
                                  <p>
                                    Otras horas disponibles:{' '}
                                    {freeOptionsDisplay.slice(0, 5).map((t, i2) => (
                                      <button
                                        key={t}
                                        type="button"
                                        onClick={() => setServiceStartTime(index, t)}
                                        className="cursor-pointer font-medium underline"
                                      >
                                        {t}
                                        {i2 < Math.min(freeOptionsDisplay.length, 5) - 1 ? ', ' : ''}
                                      </button>
                                    ))}
                                  </p>
                                )}
                                {serviceAlternativeStaff?.[index] != null && (
                                  <p>
                                    A esta hora está libre:{' '}
                                    <span className="font-medium">
                                      {serviceAlternativeStaff[index]!.name}
                                    </span>
                                  </p>
                                )}
                                {isOccupied &&
                                  freeOptionsDisplay.length === 0 &&
                                  !serviceAlternativeStaff?.[index] && (
                                    <p>Sin disponibilidad para este tratamiento.</p>
                                  )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                      {serviceId && (
                        <div>
                          <label className={`${typography.label} mb-0.5 block text-xs`}>
                            Duración (minutos)
                          </label>
                          <input
                            type="number"
                            min="5"
                            max="480"
                            step="5"
                            value={draft.serviceDurations[index] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setServiceDuration(index, val === '' ? null : parseInt(val, 10))
                            }}
                            className={selectCn}
                            placeholder="Automática"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addService}
                    className="flex w-full cursor-pointer items-center justify-center gap-1 border border-dashed border-gold/40 px-3 py-2 text-xs text-gold transition-colors hover:border-gold hover:bg-gold/5"
                  >
                    <span className="text-sm leading-none">+</span> Añadir tratamiento
                  </button>

                  {hasOverlaps && (
                    <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                      <p className="font-semibold">Horarios solapados:</p>
                      {serviceOverlaps.map((overlap, idx) => (
                        <p key={idx}>
                          {overlap.nameA} y {overlap.nameB} se solapan
                        </p>
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <AppointmentClientPanelEdit
                    draft={draft}
                    customerRegistered={customerRegistered}
                    showCustomerHistory={showCustomerHistory}
                    adminToken={adminToken}
                    onDraftChange={onDraftChange}
                    onCustomerRegisteredChange={onCustomerRegisteredChange}
                  />
                </section>
              </div>
            </div>

            <AppointmentModalFooter
              showReviewRequest={showReviewRequest}
              adminToken={adminToken}
              phone={draft.customerPhone}
              reviewRequestSentAt={reviewRequestSentAt ?? null}
              appointment={appointmentForReview}
              onReviewRequestSent={onReviewRequestSent}
            >
              <Button type="submit" variant="solid" size="sm" disabled={saving || services.length === 0}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onModeChange('view')}
                disabled={saving}
              >
                Volver
              </Button>
              {onCancelAppointment && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-800 hover:bg-red-50"
                  onClick={onCancelAppointment}
                  disabled={saving}
                >
                  Cancelar cita
                </Button>
              )}
            </AppointmentModalFooter>
          </form>
        )}
      </div>
    </div>
  )
}
