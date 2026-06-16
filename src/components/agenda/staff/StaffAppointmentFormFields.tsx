import { useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { AdminServicePickerMulti } from '@/components/shared/AdminServicePickerMulti'
import { AppointmentCustomerEntry } from '@/components/agenda/AppointmentCustomerEntry'
import { AppointmentCustomerFields } from '@/components/agenda/AppointmentCustomerFields'
import { AppointmentRecurrenceFields } from '@/components/agenda/AppointmentRecurrenceFields'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import type { BookableService } from '@/types/booking'
import { useTranslation } from '@/i18n/useTranslation'
import { serviceDisplayName } from '@/i18n/helpers'
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
  /** Admin: buscar cliente existente al crear cita. */
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
  const { locale } = useTranslation()
  const timeOptions = [...new Set([...slots, ...(draft.startTime ? [draft.startTime] : [])])].sort()
  const selectCn = compact
    ? 'w-full border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold disabled:opacity-50'
    : 'w-full border border-gold/30 bg-cream px-3 py-2 text-sm outline-none focus:border-gold disabled:opacity-50'
  const timeLabelCn = compact ? `${typography.label} mb-0.5 block text-xs` : `${typography.label} mb-1 block`

  const selectedServiceNames = useMemo(() => {
    return draft.serviceIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is BookableService => s != null)
  }, [draft.serviceIds, services])

  function toggleServiceId(id: string) {
    const next = draft.serviceIds.includes(id)
      ? draft.serviceIds.filter((s) => s !== id)
      : [...draft.serviceIds, id]
    onDraftChange({ serviceIds: next, startTime: next.length === 0 ? '' : draft.startTime })
  }

  const hasServices = draft.serviceIds.length > 0

  return (
    <form
      onSubmit={onSubmit}
      className={compact ? `space-y-3 ${formCompactClass}` : 'space-y-4'}
    >
      {hint && !compact && <p className={typography.caption}>{hint}</p>}

      {compact ? (
        <div className="space-y-3">
          <AdminServicePickerMulti
            services={services}
            serviceIds={draft.serviceIds}
            onToggleService={toggleServiceId}
            loading={services.length === 0}
          />
          <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="self-end">
              <label className={`${typography.label} mb-0.5 block text-xs text-charcoal-muted`}>
                Tratamientos seleccionados
              </label>
              <div className="min-h-[2rem] rounded border border-gold/20 bg-cream px-2.5 py-1 text-xs text-charcoal-muted">
                {selectedServiceNames.length > 0 ? (
                  <span>{selectedServiceNames.map((s) => serviceDisplayName(s, locale)).join(', ')}</span>
                ) : (
                  <span className="italic">Ninguno</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <AdminServicePickerMulti
            services={services}
            serviceIds={draft.serviceIds}
            onToggleService={toggleServiceId}
            loading={services.length === 0}
          />
          <div className="grid gap-3 sm:grid-cols-2">
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
                  {hasServices ? 'Elige hora' : 'Primero elige los tratamientos'}
                </option>
                {timeOptions.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
            <div className="self-end">
              <label className={`${typography.label} mb-0.5 block text-xs text-charcoal-muted`}>
                Tratamientos ({selectedServiceNames.length})
              </label>
              <div className="min-h-[2rem] rounded border border-gold/20 bg-cream px-2.5 py-1 text-xs text-charcoal-muted">
                {selectedServiceNames.length > 0 ? (
                  <span className="text-gold">{selectedServiceNames.map((s) => serviceDisplayName(s, locale)).join(', ')}</span>
                ) : (
                  <span className="italic">Ninguno</span>
                )}
              </div>
            </div>
          </div>
        </>
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
