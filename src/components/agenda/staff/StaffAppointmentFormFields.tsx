import { useCallback, useMemo } from 'react'
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
import { buildFlexibleServiceStartTimes } from '@/lib/booking/combo'

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

  const setServiceAtIndex = useCallback(
    (index: number, id: string) => {
      const next = [...serviceIds]
      if (index === 0 && id === '') {
        const hadService = serviceIds[0] !== ''
        if (hadService) {
          onDraftChange({ serviceIds: [], serviceDurations: [], serviceStartTimes: [], startTime: '' })
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
      onDraftChange({ serviceIds: next, serviceDurations: newDurations, serviceStartTimes: newTimes })
    },
    [serviceIds, draft.serviceDurations, draft.serviceStartTimes, services, onDraftChange, normalizeStartTimes],
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
      onDraftChange({
        serviceIds: cleaned,
        serviceDurations: durations,
        serviceStartTimes: times,
        startTime: cleaned.length === 0 ? '' : draft.startTime,
      })
    },
    [serviceIds, draft.serviceDurations, draft.serviceStartTimes, draft.startTime, onDraftChange, normalizeStartTimes],
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
      const newIds = [...serviceIds.filter((s) => s !== '')]
      const newDurations = normalizeDurations(serviceIds, draft.serviceDurations).filter((_, i) => {
        const idAtI = serviceIds[i]
        return idAtI !== undefined && idAtI !== ''
      })
      const newTimes = normalizeStartTimes(serviceIds, draft.serviceStartTimes).filter((_, i) => {
        const idAtI = serviceIds[i]
        return idAtI !== undefined && idAtI !== ''
      })
      const [movedId] = newIds.splice(fromIndex, 1)
      const [movedDuration] = newDurations.splice(fromIndex, 1)
      const [movedTime] = newTimes.splice(fromIndex, 1)
      newIds.splice(toIndex, 0, movedId)
      newDurations.splice(toIndex, 0, movedDuration)
      newTimes.splice(toIndex, 0, movedTime)
      onDraftChange({ serviceIds: newIds, serviceDurations: newDurations, serviceStartTimes: newTimes })
    },
    [serviceIds, draft.serviceDurations, draft.serviceStartTimes, onDraftChange, normalizeStartTimes],
  )

  const chainedStartTimes = useMemo(() => {
    if (!draft.startTime || draft.serviceIds.length === 0 || draft.serviceIds[0] === '') return []
    const selectedServices = draft.serviceIds.map((id, i) => {
      if (!id) return null
      const svc = services.find(s => s.id === id)
      if (!svc) return null
      const customDuration = draft.serviceDurations[i]
      return {
        id: svc.id,
        category: svc.categoryId ?? '',
        durationMinutes: customDuration != null && customDuration > 0 ? customDuration : svc.durationMinutes,
      }
    }).filter(Boolean) as { id: string; category: string; durationMinutes: number }[]
    if (selectedServices.length === 0) return []
    return buildFlexibleServiceStartTimes(selectedServices, draft.startTime, [])
  }, [draft.startTime, draft.serviceIds, draft.serviceDurations, services])

  const servicesSection = (
    <div className="space-y-2">
      <p className={`${typography.label} text-gold`}>Tratamientos</p>
      {serviceIds.map((serviceId, index) => {
        const filledIds = serviceIds.filter((s) => s !== '')
        const isFirst = filledIds.length > 0 && serviceId === filledIds[0]
        const isLast = filledIds.length > 0 && serviceId === filledIds[filledIds.length - 1]

        return (
          <div key={index} className="relative rounded border border-gold/15 p-3">
            <div className="flex items-start gap-2">
              <div className="flex shrink-0 flex-col gap-0.5 pt-1">
                <button
                  type="button"
                  disabled={isFirst || !serviceId}
                  onClick={() => moveService(filledIds.indexOf(serviceId), filledIds.indexOf(serviceId) - 1)}
                  className="flex size-5 items-center justify-center border border-gold/30 text-xs text-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-25"
                  aria-label="Subir tratamiento"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={isLast || !serviceId}
                  onClick={() => moveService(filledIds.indexOf(serviceId), filledIds.indexOf(serviceId) + 1)}
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
                {serviceId && (
                  <div>
                    <label className={`${typography.label} mb-0.5 block text-xs`}>
                      Hora de inicio
                    </label>
                    <select
                      value={draft.serviceStartTimes[index] ?? ''}
                      onChange={(e) => setServiceStartTime(index, e.target.value)}
                      className={selectCn}
                    >
                      <option value="">
                        {draft.startTime && chainedStartTimes[index]
                          ? chainedStartTimes[index]
                          : 'Elige hora primero'}
                      </option>
                      {timeOptions.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {serviceId && (
                  <div>
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
    </div>
  )

  const infoSection = (
    <div className={compact ? `space-y-3 ${formCompactClass}` : 'space-y-4'}>
      {compact ? (
        <div>
          <label className={timeLabelCn}>Hora</label>
          <select
            required
            value={draft.startTime}
            onChange={(e) => onDraftChange({ startTime: e.target.value, serviceStartTimes: [] })}
            className={selectCn}
            disabled={!hasServices}
          >
            <option value="">
              {hasServices ? 'Elige hora' : 'Tratamiento primero'}
            </option>
            {timeOptions.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className={timeLabelCn}>Hora</label>
          <select
            required
            value={draft.startTime}
            onChange={(e) => onDraftChange({ startTime: e.target.value, serviceStartTimes: [] })}
            className={selectCn}
            disabled={!hasServices}
          >
            <option value="">
              {hasServices ? 'Elige hora' : 'Primero elige el tratamiento'}
            </option>
            {timeOptions.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      )}

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
          {servicesSection}
          {infoSection}
        </div>
      ) : (
        <div className="space-y-4">
          {hint && <p className={typography.caption}>{hint}</p>}
          {servicesSection}
          <hr className="border-gold/15" />
          {infoSection}
        </div>
      )}
    </form>
  )
}
