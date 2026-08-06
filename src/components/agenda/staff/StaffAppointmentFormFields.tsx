import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { ServiceCategoryPicker } from '@/components/shared/ServiceCategoryPicker'
import { AppointmentCustomerEntry } from '@/components/agenda/AppointmentCustomerEntry'
import { AppointmentCustomerFields } from '@/components/agenda/AppointmentCustomerFields'
import { AppointmentRecurrenceFields } from '@/components/agenda/AppointmentRecurrenceFields'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'
import { usesColorSplitBooking } from '@/lib/booking/occupancy'
import { ClockTimeInput } from '@/components/agenda/ClockTimeInput'
import { buildEarliestEditableServiceStartTimes } from '@/lib/booking/combo'
import { checkServiceOverlaps } from '@/lib/agenda/serviceOverlaps'
import { buildEditableServiceTimeOptions, ALL_DAY_SLOTS } from '@/lib/agenda/serviceTimeOptions'

const fieldCompact = '!px-3 !py-2'
const formCompactClass =
  '[&_label>span:first-child]:mb-1 [&_label>span:first-child]:text-xs [&_input]:py-2 [&_textarea]:min-h-0 [&_textarea]:py-2'

const DURATION_OPTIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 5)

/** Asegura que serviceDurations tenga la misma longitud que ids,
 *  preservando los valores existentes y rellenando con null los nuevos índices. */
function normalizeDurations(
  ids: string[],
  durations: (number | null)[],
): (number | null)[] {
  return ids.map((_, i) => (i < durations.length ? durations[i] : null))
}

type Props = {
  editingId: string | null
  date: string
  draft: AppointmentDraft
  services: BookableService[]
  slots: string[]
  slotsOverHours?: string[]
  /** Slots disponibles para cada servicio por separado (índice = posición en serviceIds).
   *  Permite al usuario elegir cualquier hora para tratamientos adicionales e indica cuáles están ocupadas. */
  serviceSlots?: string[][]
  /** Para cada tratamiento adicional con hora ocupada, el primer profesional alternativo libre a esa hora (null = ninguno o no aplica). */
  serviceAlternativeStaff?: ({ id: string; name: string } | null)[]
  /** Lista de profesionales disponibles para el selector por tratamiento. */
  staffList?: { id: string; name: string }[]
  /** Profesional activo en agenda al abrir el formulario. */
  defaultStaffId?: string
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onCancelAppointment?: () => void
  onMarkNoShow?: () => void
  canMarkNoShow?: boolean
  isNoShow?: boolean
  hint?: string
  adminToken?: string
  compact?: boolean
  /** La hora de la visita se edita fuera (p. ej. título del modal). */
  hideVisitTime?: boolean
}

export function StaffAppointmentFormFields({
  editingId,
  date,
  draft,
  services,
  slots,
  slotsOverHours = [],
  serviceSlots,
  serviceAlternativeStaff,
  staffList,
  defaultStaffId,
  onDraftChange,
  onSubmit,
  onClose,
  onCancelAppointment,
  onMarkNoShow,
  canMarkNoShow = false,
  isNoShow = false,
  hint,
  adminToken,
  compact = false,
  hideVisitTime = false,
}: Props) {
  const isAdmin = Boolean(adminToken)
  const timeOptions = useMemo(() => {
    if (isAdmin) return [...ALL_DAY_SLOTS]
    const base = [...new Set([...slots, ...(draft.startTime ? [draft.startTime] : [])])]
    return base.sort()
  }, [isAdmin, slots, draft.startTime])
  const selectCn = compact
    ? 'w-full border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold disabled:opacity-50'
    : 'w-full border border-gold/30 bg-cream px-3 py-2 text-sm outline-none focus:border-gold disabled:opacity-50'
  const timeLabelCn = compact ? `${typography.label} mb-0.5 block text-xs` : `${typography.label} mb-1 block`

  const serviceIds = draft.serviceIds.length > 0 ? draft.serviceIds : ['']
  const hasServices = draft.serviceIds.length > 0 && draft.serviceIds[0] !== ''

  const normalizeStartTimes = useCallback(
    (ids: string[], times: string[]): string[] => {
      return ids.map((_, i) => (i < times.length ? times[i] : ''))
    },
    [],
  )

  const normalizeStaffAssignments = useCallback(
    (ids: string[], assignments: string[]): string[] => {
      return ids.map((_, i) => (i < assignments.length ? assignments[i] : ''))
    },
    [],
  )

  const setStaffAtIndex = useCallback(
    (index: number, staffId: string) => {
      const assignments = normalizeStaffAssignments(draft.serviceIds, draft.staffAssignments)
      assignments[index] = staffId
      onDraftChange({ staffAssignments: assignments })
    },
    [draft.serviceIds, draft.staffAssignments, onDraftChange, normalizeStaffAssignments],
  )

  const staffIdForIndex = useCallback(
    (index: number) => draft.staffAssignments[index] || defaultStaffId || '',
    [draft.staffAssignments, defaultStaffId],
  )

  useEffect(() => {
    if (!defaultStaffId || editingId) return
    const filledIds = draft.serviceIds.filter((id) => id !== '')
    if (filledIds.length === 0) return
    const assignments = normalizeStaffAssignments(draft.serviceIds, draft.staffAssignments)
    let changed = false
    for (let i = 0; i < draft.serviceIds.length; i++) {
      if (draft.serviceIds[i] !== '' && !assignments[i]) {
        assignments[i] = defaultStaffId
        changed = true
      }
    }
    if (changed) onDraftChange({ staffAssignments: assignments })
  }, [
    defaultStaffId,
    draft.serviceIds,
    draft.staffAssignments,
    editingId,
    normalizeStaffAssignments,
    onDraftChange,
  ])

  const setServiceAtIndex = useCallback(
    (index: number, id: string) => {
      const next = [...serviceIds]
      if (index === 0 && id === '') {
        const hadService = serviceIds[0] !== ''
        if (hadService) {
          onDraftChange({ serviceIds: [], serviceDurations: [], serviceStartTimes: [], staffAssignments: [], startTime: '' })
        }
        return
      }
      next[index] = id
      const selectedService = services.find((s) => s.id === id)
      const newDurations = normalizeDurations(next, draft.serviceDurations)
      if (selectedService) {
        const otherIds = next.filter((s, i) => s !== '' && i !== index)
        if (usesColorSplitBooking(id) && otherIds.length > 0) {
          newDurations[index] = 30
        } else {
          newDurations[index] = selectedService.durationMinutes
        }
      } else {
        newDurations[index] = null
      }
      const newTimes = normalizeStartTimes(next, draft.serviceStartTimes)
      const newAssignments = normalizeStaffAssignments(next, draft.staffAssignments)
      if (id && !newAssignments[index] && defaultStaffId) {
        newAssignments[index] = defaultStaffId
      }
      onDraftChange({ serviceIds: next, serviceDurations: newDurations, serviceStartTimes: newTimes, staffAssignments: newAssignments })
    },
    [serviceIds, draft.serviceDurations, draft.serviceStartTimes, draft.staffAssignments, defaultStaffId, services, onDraftChange, normalizeStartTimes, normalizeStaffAssignments],
  )

  const setServiceStartTime = useCallback(
    (index: number, time: string) => {
      const times = normalizeStartTimes(draft.serviceIds, draft.serviceStartTimes)
      times[index] = time
      const patch: Partial<AppointmentDraft> = { serviceStartTimes: times }
      if (index === 0 && time) {
        patch.startTime = time
      }
      onDraftChange(patch)
    },
    [draft.serviceIds, draft.serviceStartTimes, onDraftChange, normalizeStartTimes],
  )

  const addService = useCallback(() => {
    const next = [...serviceIds.filter((s) => s !== ''), '']
    const newTimes = normalizeStartTimes(next, draft.serviceStartTimes)
    onDraftChange({ serviceIds: next, serviceDurations: draft.serviceDurations, serviceStartTimes: newTimes })
  }, [serviceIds, draft.serviceDurations, draft.serviceStartTimes, onDraftChange, normalizeStartTimes])

  const removeService = useCallback(
    (index: number) => {
      const next = serviceIds.filter((_, i) => i !== index)
      const cleaned = next.filter((s) => s !== '')
      const durations = normalizeDurations(serviceIds, draft.serviceDurations).filter((_, i) => i !== index)
      const times = normalizeStartTimes(serviceIds, draft.serviceStartTimes).filter((_, i) => i !== index)
      const assignments = normalizeStaffAssignments(serviceIds, draft.staffAssignments).filter((_, i) => i !== index)
      onDraftChange({
        serviceIds: cleaned,
        serviceDurations: durations,
        serviceStartTimes: times,
        staffAssignments: assignments,
        startTime: cleaned.length === 0 ? '' : times[0] || draft.startTime,
      })
    },
    [serviceIds, draft.serviceDurations, draft.serviceStartTimes, draft.staffAssignments, draft.startTime, onDraftChange, normalizeStartTimes, normalizeStaffAssignments],
  )

  const setServiceDuration = useCallback(
    (index: number, duration: number | null) => {
      const durations = normalizeDurations(draft.serviceIds, draft.serviceDurations)
      durations[index] = duration
      onDraftChange({ serviceDurations: durations })
    },
    [draft.serviceIds, draft.serviceDurations, onDraftChange],
  )

  const moveService = useCallback(
    (fromIndex: number, toIndex: number) => {
      const filledFilter = (_: unknown, i: number) => {
        const idAtI = serviceIds[i]
        return idAtI !== undefined && idAtI !== ''
      }
      const newIds = [...serviceIds.filter((s) => s !== '')]
      const newDurations = normalizeDurations(serviceIds, draft.serviceDurations).filter(filledFilter)
      const newTimes = normalizeStartTimes(serviceIds, draft.serviceStartTimes).filter(filledFilter)
      const newAssignments = normalizeStaffAssignments(serviceIds, draft.staffAssignments).filter(filledFilter)
      const [movedId] = newIds.splice(fromIndex, 1)
      const [movedDuration] = newDurations.splice(fromIndex, 1)
      const [movedTime] = newTimes.splice(fromIndex, 1)
      const [movedAssignment] = newAssignments.splice(fromIndex, 1)
      newIds.splice(toIndex, 0, movedId)
      newDurations.splice(toIndex, 0, movedDuration)
      newTimes.splice(toIndex, 0, movedTime)
      newAssignments.splice(toIndex, 0, movedAssignment)
      onDraftChange({ serviceIds: newIds, serviceDurations: newDurations, serviceStartTimes: newTimes, staffAssignments: newAssignments })
    },
    [serviceIds, draft.serviceDurations, draft.serviceStartTimes, draft.staffAssignments, onDraftChange, normalizeStartTimes, normalizeStaffAssignments],
  )

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
    // Mínimo editable: ignora el override del propio índice para poder atrasarlo.
    const staffForEntries = entries.map(
      (e) => draft.staffAssignments[e.formIndex] || defaultStaffId || '',
    )
    const earliest = buildEarliestEditableServiceStartTimes(
      entries.map((e) => e.service),
      draft.startTime,
      entries.map((e) => e.override),
      staffForEntries,
    )
    const byFormIndex = draft.serviceIds.map(() => '')
    entries.forEach((entry, j) => {
      byFormIndex[entry.formIndex] = earliest[j]!
    })
    return byFormIndex
  }, [
    draft.startTime,
    draft.serviceIds,
    draft.serviceDurations,
    draft.serviceStartTimes,
    draft.staffAssignments,
    defaultStaffId,
    services,
  ])

  const serviceOverlaps = useMemo(
    () => checkServiceOverlaps(draft, services, defaultStaffId),
    [draft, services, defaultStaffId],
  )
  const hasOverlaps = serviceOverlaps.length > 0

  /** Índice expandido; los huecos vacíos siempre se muestran abiertos. */
  const [expandedServiceIndex, setExpandedServiceIndex] = useState<number | null>(null)
  const filledServiceCount = serviceIds.filter((s) => s !== '').length
  const serviceIdsKey = serviceIds.join('\0')

  useEffect(() => {
    const emptyIndex = serviceIds.findIndex((id) => !id)
    if (emptyIndex >= 0) {
      setExpandedServiceIndex(emptyIndex)
      return
    }
    setExpandedServiceIndex((prev) => {
      if (prev != null && prev < serviceIds.length) return prev
      return null
    })
    // Solo reaccionar a cambios de lista de servicios, no a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serviceIdsKey es la identidad estable
  }, [serviceIdsKey])

  const handleAddService = useCallback(() => {
    const nextIndex = serviceIds.filter((s) => s !== '').length
    addService()
    setExpandedServiceIndex(nextIndex)
  }, [addService, serviceIds])

  const handleRemoveService = useCallback(
    (index: number) => {
      removeService(index)
      setExpandedServiceIndex((prev) => {
        if (prev == null) return null
        if (prev === index) return null
        if (prev > index) return prev - 1
        return prev
      })
    },
    [removeService],
  )

  const servicesSection = (
    <div className="space-y-2">
      <p className={`${typography.label} text-gold`}>Tratamientos</p>
      {serviceIds.map((serviceId, index) => {
        const isFirst = index === 0 || !serviceId
        const isLast = !serviceId || index >= filledServiceCount - 1
        const svc = serviceId ? services.find((s) => s.id === serviceId) : undefined
        const isEmpty = !serviceId
        const isExpanded =
          isEmpty ||
          expandedServiceIndex === index ||
          (expandedServiceIndex === null && filledServiceCount <= 1 && Boolean(serviceId))
        const staffName =
          staffList?.find((s) => s.id === staffIdForIndex(index))?.name ??
          staffList?.find((s) => s.id === defaultStaffId)?.name
        const startLabel =
          index === 0
            ? draft.startTime || null
            : draft.serviceStartTimes[index] || chainedStartTimes[index] || null
        const durationMin =
          draft.serviceDurations[index] ?? svc?.durationMinutes ?? null
        const summaryParts = [
          svc?.nameEs ?? 'Tratamiento',
          staffName,
          startLabel,
          durationMin != null ? `${durationMin} min` : null,
        ].filter(Boolean)

        return (
          <div
            key={index}
            className={`relative rounded border ${
              isExpanded ? 'border-gold/30 bg-gold/5' : 'border-gold/15'
            }`}
          >
            <div className="flex items-stretch gap-1.5 p-2">
              <div className="flex shrink-0 flex-col justify-center gap-0.5">
                <button
                  type="button"
                  disabled={isFirst}
                  onClick={() => moveService(index, index - 1)}
                  className="flex size-5 cursor-pointer items-center justify-center border border-gold/30 text-xs text-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-25"
                  aria-label="Subir tratamiento"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => moveService(index, index + 1)}
                  className="flex size-5 cursor-pointer items-center justify-center border border-gold/30 text-xs text-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-25"
                  aria-label="Bajar tratamiento"
                >
                  ▼
                </button>
              </div>

              <button
                type="button"
                disabled={isEmpty}
                aria-expanded={isExpanded}
                onClick={() =>
                  setExpandedServiceIndex((prev) => (prev === index ? null : index))
                }
                className={`min-w-0 flex-1 px-1 py-1 text-left ${
                  isEmpty ? 'cursor-default' : 'cursor-pointer hover:bg-gold/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gold">
                      Tratamiento {index + 1}
                    </p>
                    {isEmpty ? (
                      <p className={`${typography.caption} text-charcoal-muted`}>
                        Elige especialidad y tratamiento
                      </p>
                    ) : (
                      <p className="truncate text-sm text-charcoal">
                        {summaryParts.join(' · ')}
                      </p>
                    )}
                  </div>
                  {!isEmpty && (
                    <svg
                      className={`h-4 w-4 shrink-0 text-gold transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>

              {index > 0 && (
                <button
                  type="button"
                  onClick={() => handleRemoveService(index)}
                  className="mt-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center self-start rounded-full border border-red-300 bg-red-50 text-xs text-red-600 hover:bg-red-100"
                  aria-label="Quitar tratamiento"
                >
                  ×
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="space-y-2 border-t border-gold/15 px-3 pb-3 pt-2">
                <ServiceCategoryPicker
                  compact={compact}
                  variant="staff"
                  services={services}
                  serviceId={serviceId}
                  loading={services.length === 0}
                  onServiceChange={(id) => {
                    setServiceAtIndex(index, id)
                    if (id) setExpandedServiceIndex(index)
                  }}
                />
                {serviceId &&
                  (() => {
                    const currentVal = draft.serviceStartTimes[index] ?? ''
                    const chainedTime =
                      draft.startTime && chainedStartTimes[index]
                        ? chainedStartTimes[index]
                        : undefined
                    const showStartTime = index > 0
                    const showStaff = Boolean(staffList && staffList.length > 1)

                    const durationField = (
                      <div className="min-w-0 flex-1">
                        <label className={`${typography.label} mb-0.5 block text-[10px]`}>
                          Duración
                        </label>
                        <select
                          value={draft.serviceDurations[index] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setServiceDuration(index, val === '' ? null : parseInt(val, 10))
                          }}
                          className={selectCn}
                        >
                          <option value="">Automática</option>
                          {DURATION_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m} min
                            </option>
                          ))}
                        </select>
                      </div>
                    )

                    const staffField = showStaff ? (
                      <div className="min-w-0 flex-1">
                        <label className={`${typography.label} mb-0.5 block text-[10px]`}>
                          Especialista
                        </label>
                        <select
                          value={staffIdForIndex(index)}
                          onChange={(e) => setStaffAtIndex(index, e.target.value)}
                          className={selectCn}
                        >
                          {staffList!.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null

                    if (!showStartTime) {
                      return (
                        <div className="flex flex-wrap items-end gap-2">
                          {staffField}
                          {durationField}
                        </div>
                      )
                    }

                    const timeField = (
                      <div className="shrink-0">
                        <label className={`${typography.label} mb-0.5 block text-[10px]`}>
                          Hora
                        </label>
                        <ClockTimeInput
                          value={currentVal}
                          onChange={(time) => setServiceStartTime(index, time)}
                          defaultTime={
                            isAdmin ? chainedTime : (chainedTime ?? undefined)
                          }
                          allowEmpty
                        />
                      </div>
                    )

                    if (isAdmin) {
                      return (
                        <div className="flex flex-wrap items-end gap-2">
                          {timeField}
                          {staffField}
                          {durationField}
                        </div>
                      )
                    }

                    const { freeOptions, isOccupied } = buildEditableServiceTimeOptions({
                      currentVal,
                      perServiceFree: serviceSlots?.[index] ?? [],
                      fallbackFree: [],
                      ownTimes: currentVal ? [currentVal] : [],
                    })

                    return (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="shrink-0">
                            <label className={`${typography.label} mb-0.5 block text-[10px]`}>
                              Hora
                            </label>
                            <ClockTimeInput
                              value={currentVal}
                              onChange={(time) => setServiceStartTime(index, time)}
                              defaultTime={chainedTime ?? freeOptions[0]}
                              allowEmpty
                            />
                          </div>
                          {staffField}
                          {durationField}
                        </div>
                        {isOccupied && (
                          <div className="space-y-0.5 text-xs text-amber-700">
                            {freeOptions.length > 0 && (
                              <p>
                                Otras horas disponibles:{' '}
                                {freeOptions.slice(0, 5).map((t, i2) => (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => setServiceStartTime(index, t)}
                                    className="cursor-pointer font-medium underline"
                                  >
                                    {t}
                                    {i2 < Math.min(freeOptions.length, 5) - 1 ? ', ' : ''}
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
                              freeOptions.length === 0 &&
                              !serviceAlternativeStaff?.[index] && (
                                <p>Sin disponibilidad para este tratamiento.</p>
                              )}
                          </div>
                        )}
                      </div>
                    )
                  })()}
              </div>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={handleAddService}
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
    </div>
  )

  const timeSection = hideVisitTime ? (
    <input
      tabIndex={-1}
      aria-hidden
      className="pointer-events-none absolute h-0 w-0 opacity-0"
      value={draft.startTime}
      required
      onChange={() => {}}
    />
  ) : (
    <div>
      <label className={timeLabelCn}>Hora de la cita</label>
      <ClockTimeInput
        value={draft.startTime}
        onChange={(time) => onDraftChange({ startTime: time, serviceStartTimes: [] })}
        defaultTime={draft.startTime || timeOptions[0] || '10:00'}
        disabled={isAdmin ? false : !hasServices}
        required
      />
      {!isAdmin && slotsOverHours.length > 0 && draft.startTime && slotsOverHours.includes(draft.startTime) && (
        <p className="mt-1 text-xs text-amber-700">Esta hora está fuera del horario habitual.</p>
      )}
    </div>
  )

  const infoSection = (
    <div className={compact ? `space-y-3 ${formCompactClass}` : 'space-y-4'}>
      {adminToken && !editingId ? (
        <AppointmentCustomerEntry
          adminToken={adminToken}
          draft={draft}
          onDraftChange={onDraftChange}
          compact={compact}
        />
      ) : (
        <AppointmentCustomerFields
          draft={draft}
          onDraftChange={onDraftChange}
          compact={compact}
        />
      )}

      {!editingId && (
        <AppointmentRecurrenceFields
          anchorDate={date}
          scope={draft.recurrenceScope}
          endDate={draft.recurrenceEndDate}
          onChange={({ scope: recurrenceScope, endDate: recurrenceEndDate }) =>
            onDraftChange({ recurrenceScope, recurrenceEndDate })
          }
          compact={compact}
        />
      )}

      <Textarea
        label="Observaciones de la cita"
        rows={compact ? 2 : 3}
        value={draft.notes}
        onChange={(e) => onDraftChange({ notes: e.target.value })}
        className={compact ? fieldCompact : undefined}
      />

      {isNoShow && (
        <p className={`${typography.caption} text-charcoal-muted`}>Inasistencia registrada</p>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button type="submit" variant="solid" size="sm" disabled={services.length === 0 || isNoShow}>
          {editingId ? 'Guardar cambios' : 'Confirmar cita'}
        </Button>
        {editingId && canMarkNoShow && onMarkNoShow && (
          <Button type="button" variant="outline" size="sm" onClick={onMarkNoShow}>
            Inasistencia
          </Button>
        )}
        {editingId && onCancelAppointment && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-300 text-red-800 hover:bg-red-50"
            onClick={onCancelAppointment}
          >
            Cancelar cita
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {editingId ? 'Descartar' : 'Cerrar'}
        </Button>
      </div>
    </div>
  )

  return (
    <form onSubmit={onSubmit}>
      {compact ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            {timeSection}
            {servicesSection}
          </div>
          {infoSection}
        </div>
      ) : (
        <div className="space-y-4">
          {hint && <p className={typography.caption}>{hint}</p>}
          {timeSection}
          {servicesSection}
          <hr className="border-gold/15" />
          {infoSection}
        </div>
      )}
    </form>
  )
}
