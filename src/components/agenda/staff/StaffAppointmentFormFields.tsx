import { useCallback, useEffect, useMemo } from 'react'
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
import { ScrollableTimeSelect } from '@/components/agenda/ScrollableTimeSelect'
import { buildEarliestEditableServiceStartTimes } from '@/lib/booking/combo'
import { checkServiceOverlaps } from '@/lib/agenda/serviceOverlaps'
import { buildEditableServiceTimeOptions } from '@/lib/agenda/serviceTimeOptions'

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
}: Props) {
  const timeOptions = [...new Set([...slots, ...(draft.startTime ? [draft.startTime] : [])])].sort()
  const overHoursSet = new Set(slotsOverHours)
  const isOverHoursSelected = draft.startTime ? overHoursSet.has(draft.startTime) : false
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
    () => checkServiceOverlaps(draft, services, defaultStaffId),
    [draft, services, defaultStaffId],
  )
  const hasOverlaps = serviceOverlaps.length > 0

  const servicesSection = (
    <div className="space-y-2">
      <p className={`${typography.label} text-gold`}>Tratamientos</p>
      {serviceIds.map((serviceId, index) => {
        const filledCount = serviceIds.filter((s) => s !== '').length
        const isFirst = index === 0 || !serviceId
        const isLast = !serviceId || index >= filledCount - 1

        return (
          <div key={index} className="relative rounded border border-gold/15 p-3">
            <div className="flex items-start gap-2">
              <div className="flex shrink-0 flex-col gap-0.5 pt-1">
                <button
                  type="button"
                  disabled={isFirst}
                  onClick={() => moveService(index, index - 1)}
                  className="flex size-5 items-center justify-center border border-gold/30 text-xs text-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-25"
                  aria-label="Subir tratamiento"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => moveService(index, index + 1)}
                  className="flex size-5 items-center justify-center border border-gold/30 text-xs text-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-25"
                  aria-label="Bajar tratamiento"
                >
                  ▼
                </button>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removeService(index)}
                    className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full border border-red-300 bg-red-50 text-xs text-red-600 hover:bg-red-100"
                    aria-label="Quitar tratamiento"
                  >
                    ×
                  </button>
                )}
                <ServiceCategoryPicker
                  compact={compact}
                  variant="staff"
                  services={services}
                  serviceId={serviceId}
                  loading={services.length === 0}
                  onServiceChange={(id) => setServiceAtIndex(index, id)}
                />
                {serviceId && staffList && staffList.length > 1 && (
                  <div>
                    <label className={`${typography.label} mb-0.5 block text-xs`}>
                      Especialista
                    </label>
                    <select
                      value={staffIdForIndex(index)}
                      onChange={(e) => setStaffAtIndex(index, e.target.value)}
                      className={selectCn}
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {serviceId && index > 0 && (() => {
                  const currentVal = draft.serviceStartTimes[index] ?? ''
                  const { freeOptions, occupiedOptions, extraCurrent, isOccupied } =
                    buildEditableServiceTimeOptions({
                      currentVal,
                      perServiceFree: serviceSlots?.[index] ?? [],
                      fallbackFree: [],
                      ownTimes: currentVal ? [currentVal] : [],
                    })
                  const chainedLabel = draft.startTime && chainedStartTimes[index]
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
                        freeOptions={freeOptions}
                        occupiedOptions={[...extraCurrent, ...occupiedOptions]}
                        className={selectCn}
                      />
                      {isOccupied && (
                        <div className="mt-1 space-y-0.5 text-xs text-amber-700">
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
                                  {t}{i2 < Math.min(freeOptions.length, 5) - 1 ? ', ' : ''}
                                </button>
                              ))}
                            </p>
                          )}
                          {serviceAlternativeStaff?.[index] != null && (
                            <p>
                              A esta hora está libre:{' '}
                              <span className="font-medium">{serviceAlternativeStaff[index]!.name}</span>
                            </p>
                          )}
                          {isOccupied && freeOptions.length === 0 && !serviceAlternativeStaff?.[index] && (
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
                )}
              </div>
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={addService}
        className="flex w-full items-center justify-center gap-1 border border-dashed border-gold/40 px-3 py-2 text-xs text-gold transition-colors hover:border-gold hover:bg-gold/5"
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

  const timeSection = (
    <div>
      <label className={timeLabelCn}>Hora de la cita</label>
      <ScrollableTimeSelect
        value={draft.startTime}
        onChange={(time) => onDraftChange({ startTime: time, serviceStartTimes: [] })}
        emptyLabel={
          hasServices
            ? compact
              ? 'Elige hora'
              : 'Primero elige el tratamiento'
            : 'Tratamiento primero'
        }
        freeOptions={timeOptions}
        overHoursOptions={slotsOverHours}
        className={selectCn}
        disabled={!hasServices}
        required
      />
      {isOverHoursSelected && (
        <p className="mt-1 text-xs text-amber-700">
          Esta hora va más allá del horario del salón.
        </p>
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
