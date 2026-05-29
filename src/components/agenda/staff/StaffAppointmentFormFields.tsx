import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ServiceCategoryPicker } from '@/components/shared/ServiceCategoryPicker'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import type { BookableService } from '@/types/booking'
import { typography } from '@/styles/typography'

const fieldCompact = '!px-3 !py-2'
const formCompactClass =
  '[&_label>span:first-child]:mb-1 [&_label>span:first-child]:text-xs [&_input]:py-2 [&_textarea]:min-h-0 [&_textarea]:py-2'

type Props = {
  editingId: string | null
  draft: AppointmentDraft
  services: BookableService[]
  slots: string[]
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onCancelAppointment?: () => void
  hint?: string
  /** Layout más denso para modal en escritorio (sin scroll). */
  compact?: boolean
}

export function StaffAppointmentFormFields({
  editingId,
  draft,
  services,
  slots,
  onDraftChange,
  onSubmit,
  onClose,
  onCancelAppointment,
  hint,
  compact = false,
}: Props) {
  const timeOptions = [...new Set([...slots, ...(draft.startTime ? [draft.startTime] : [])])].sort()
  const selectCn = compact
    ? 'w-full border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold disabled:opacity-50'
    : 'w-full border border-gold/30 bg-cream px-3 py-2 text-sm outline-none focus:border-gold disabled:opacity-50'
  const timeLabelCn = compact ? `${typography.label} mb-0.5 block text-xs` : `${typography.label} mb-1 block`

  return (
    <form
      onSubmit={onSubmit}
      className={compact ? `space-y-3 ${formCompactClass}` : 'space-y-4'}
    >
      {hint && !compact && <p className={typography.caption}>{hint}</p>}

      {compact ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <ServiceCategoryPicker
              compact
              variant="staff"
              services={services}
              serviceId={draft.serviceId}
              loading={services.length === 0}
              onServiceChange={(id) => onDraftChange({ serviceId: id })}
            />
          </div>
          <div>
            <label className={timeLabelCn}>Hora</label>
            <select
              required
              value={draft.startTime}
              onChange={(e) => onDraftChange({ startTime: e.target.value })}
              className={selectCn}
              disabled={!draft.serviceId}
            >
              <option value="">
                {draft.serviceId ? 'Elige hora' : 'Tratamiento primero'}
              </option>
              {timeOptions.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <>
          <ServiceCategoryPicker
            variant="staff"
            services={services}
            serviceId={draft.serviceId}
            loading={services.length === 0}
            onServiceChange={(id) => onDraftChange({ serviceId: id })}
          />
          <div>
            <label className={timeLabelCn}>Hora</label>
            <select
              required
              value={draft.startTime}
              onChange={(e) => onDraftChange({ startTime: e.target.value })}
              className={selectCn}
              disabled={!draft.serviceId}
            >
              <option value="">
                {draft.serviceId ? 'Elige hora' : 'Primero elige el tratamiento'}
              </option>
              {timeOptions.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'gap-4 sm:grid-cols-2'}`}>
        <Input
          label="Nombre"
          required
          value={draft.customerFirstName}
          onChange={(e) => onDraftChange({ customerFirstName: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="given-name"
        />
        <Input
          label="Apellidos"
          value={draft.customerLastName}
          onChange={(e) => onDraftChange({ customerLastName: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="family-name"
        />
        <Input
          label="Teléfono"
          required
          type="tel"
          value={draft.customerPhone}
          onChange={(e) => onDraftChange({ customerPhone: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="tel"
        />
        <Input
          label="Email"
          type="email"
          value={draft.customerEmail}
          onChange={(e) => onDraftChange({ customerEmail: e.target.value })}
          className={compact ? fieldCompact : undefined}
          autoComplete="email"
        />
      </div>

      <Textarea
        label="Notas"
        rows={compact ? 2 : 3}
        value={draft.notes}
        onChange={(e) => onDraftChange({ notes: e.target.value })}
        className={compact ? fieldCompact : undefined}
      />

      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button type="submit" variant="solid" size="sm" disabled={services.length === 0}>
          {editingId ? 'Guardar cambios' : 'Confirmar cita'}
        </Button>
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
