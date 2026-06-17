import { useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { ServiceCategoryPicker } from '@/components/shared/ServiceCategoryPicker'
import { AppointmentCustomerEntry } from '@/components/agenda/AppointmentCustomerEntry'
import { AppointmentCustomerFields } from '@/components/agenda/AppointmentCustomerFields'
import { AppointmentRecurrenceFields } from '@/components/agenda/AppointmentRecurrenceFields'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

const fieldCompact = '!px-3 !py-2'
const formCompactClass =
  '[&_label>span:first-child]:mb-1 [&_label>span:first-child]:text-xs [&_input]:py-2 [&_textarea]:min-h-0 [&_textarea]:py-2'

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

  const setServiceAtIndex = useCallback(
    (index: number, id: string) => {
      const next = [...serviceIds]
      if (index === 0 && id === '') {
        const hadService = serviceIds[0] !== ''
        if (hadService) {
          onDraftChange({ serviceIds: [], serviceDurations: [], startTime: '' })
        }
        return
      }
      next[index] = id
      const selectedService = services.find((s) => s.id === id)
      const newDurations = [...(draft.serviceDurations.length === next.length ? draft.serviceDurations : [])]
      if (selectedService) {
        newDurations[index] = selectedService.durationMinutes
      }
      onDraftChange({ serviceIds: next, serviceDurations: newDurations })
    },
    [serviceIds, draft.serviceDurations, services, onDraftChange],
  )

  const addService = useCallback(() => {
    const next = [...serviceIds.filter((s) => s !== ''), '']
    onDraftChange({ serviceIds: next, serviceDurations: draft.serviceDurations })
  }, [serviceIds, draft.serviceDurations, onDraftChange])

  const removeService = useCallback(
    (index: number) => {
      const next = serviceIds.filter((_, i) => i !== index)
      const cleaned = next.filter((s) => s !== '')
      const durations = draft.serviceDurations.length === serviceIds.length
        ? draft.serviceDurations.filter((_, i) => i !== index)
        : []
      onDraftChange({
        serviceIds: cleaned,
        serviceDurations: durations,
        startTime: cleaned.length === 0 ? '' : draft.startTime,
      })
    },
    [serviceIds, draft, onDraftChange],
  )

  const setServiceDuration = useCallback(
    (index: number, duration: number | null) => {
      const durations = [...(draft.serviceDurations.length === draft.serviceIds.length ? draft.serviceDurations : [])]
      durations[index] = duration
      onDraftChange({ serviceDurations: durations })
    },
    [draft.serviceDurations, draft.serviceIds.length, onDraftChange],
  )

  return (
    <form
      onSubmit={onSubmit}
      className={compact ? `space-y-3 ${formCompactClass}` : 'space-y-4'}
    >
      {hint && !compact && <p className={typography.caption}>{hint}</p>}

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
            compact={compact}
            variant="staff"
            services={services}
            serviceId={serviceId}
            loading={services.length === 0}
            onServiceChange={(id) => setServiceAtIndex(index, id)}
          />
          {serviceId && (
            <div>
              <label className={`${compact ? 'text-xs' : 'text-sm'} mb-0.5 block font-medium text-charcoal-muted`}>
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
                className="w-full border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold disabled:opacity-50"
                placeholder="Automática"
              />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addService}
        className="flex w-full items-center justify-center gap-1 border border-dashed border-gold/40 px-3 py-2 text-xs text-gold transition-colors hover:border-gold hover:bg-gold/5"
      >
        <span className="text-sm leading-none">+</span> Añadir tratamiento
      </button>

      {compact ? (
        <div>
          <label className={timeLabelCn}>Hora</label>
          <select
            required
            value={draft.startTime}
            onChange={(e) => onDraftChange({ startTime: e.target.value })}
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
            onChange={(e) => onDraftChange({ startTime: e.target.value })}
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
    </form>
  )
}
