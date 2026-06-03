import { useMemo, useState } from 'react'
import {
  CustomerAppointmentHistoryModal,
  customerHistoryModalTitle,
} from '@/components/customers/CustomerAppointmentHistoryModal'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import { ServiceCategoryPicker } from '@/components/shared/ServiceCategoryPicker'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { formatCustomerDisplayName } from '@/lib/customerName'
import { formatDisplayDate } from '@/lib/dates'
import { formatPhoneDisplay, normalizePhone } from '@/lib/phone'
import { WashPhaseIcon } from '@/components/agenda/WashPhaseIcon'
import { COLOR_GROUP_ROLE, isColorGroupWashRow } from '@/lib/bookingOccupancy'
import { appointmentBlockBarClass } from '@/lib/serviceCategoryColors'
import type { BookableService, DayScheduleAppointment } from '@/types/booking'
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
  appointment: DayScheduleAppointment
  customerRegistered: boolean
  draft: AppointmentDraft
  services: BookableService[]
  slots: string[]
  saving?: boolean
  onModeChange: (mode: 'view' | 'edit') => void
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  onCancelAppointment?: () => void
  /** Historial de citas del cliente (solo administración). */
  showCustomerHistory?: boolean
  adminToken?: string
}

function dash(value: string | null | undefined): string {
  const t = value?.trim()
  return t ? t : '—'
}

function whatsappHref(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, '')
  return `https://wa.me/${digits}`
}

function ServiceBlocks({
  appointment,
  staffName,
  services,
}: {
  appointment: DayScheduleAppointment
  staffName: string
  services: BookableService[]
}) {
  const linked = appointment.colorGroupLinked
  const colorRole = appointment.colorGroupRole === 'color'
  const washRole = appointment.colorGroupRole === 'wash'

  type Block = {
    startTime: string
    endTime: string
    serviceName: string
    serviceId: string
    categoryId: string | null
    colorGroupRole?: string | null
    staffLabel: string
    nameEn?: string
  }

  const blocks: Block[] = []

  if (colorRole && linked) {
    const colorEn = services.find((s) => s.id === appointment.serviceId)?.nameEn ?? ''
    const washEn = services.find((s) => s.id === linked.serviceId)?.nameEn ?? ''
    blocks.push({
      startTime: appointment.startTime,
      endTime: appointment.occupiedSlots[0]?.endTime ?? appointment.endTime,
      serviceName: appointment.serviceName,
      serviceId: appointment.serviceId,
      categoryId: appointment.categoryId,
      staffLabel: staffName,
      nameEn: colorEn,
    })
    blocks.push({
      startTime: linked.startTime,
      endTime: linked.endTime,
      serviceName: linked.serviceName,
      serviceId: linked.serviceId,
      categoryId: linked.categoryId,
      colorGroupRole: COLOR_GROUP_ROLE.wash,
      staffLabel: linked.staffName,
      nameEn: washEn,
    })
  } else if (washRole && linked) {
    const colorEn = services.find((s) => s.id === linked.serviceId)?.nameEn ?? ''
    const washEn = services.find((s) => s.id === appointment.serviceId)?.nameEn ?? ''
    blocks.push({
      startTime: linked.startTime,
      endTime: linked.endTime,
      serviceName: linked.serviceName,
      serviceId: linked.serviceId,
      categoryId: linked.categoryId,
      staffLabel: linked.staffName,
      nameEn: colorEn,
    })
    blocks.push({
      startTime: appointment.startTime,
      endTime: appointment.occupiedSlots[0]?.endTime ?? appointment.endTime,
      serviceName: appointment.serviceName,
      serviceId: appointment.serviceId,
      categoryId: appointment.categoryId,
      colorGroupRole: COLOR_GROUP_ROLE.wash,
      staffLabel: staffName,
      nameEn: washEn,
    })
  } else {
    const serviceEn = services.find((s) => s.id === appointment.serviceId)?.nameEn ?? ''
    const slots =
      appointment.occupiedSlots.length > 0
        ? appointment.occupiedSlots
        : [{ startTime: appointment.startTime, endTime: appointment.endTime }]
    for (const slot of slots) {
      blocks.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        serviceName: appointment.serviceName,
        serviceId: appointment.serviceId,
        categoryId: appointment.categoryId,
        staffLabel: staffName,
        nameEn: serviceEn,
      })
    }
  }

  return (
    <ul className="space-y-2">
      {blocks.map((block, i) => (
        <li
          key={`${block.startTime}-${block.serviceId}-${i}`}
          className={`rounded px-3 py-2 text-sm font-medium leading-snug ${appointmentBlockBarClass(
            block.categoryId,
            block.serviceId,
            block.colorGroupRole,
          )}`}
        >
          <span className="tabular-nums">
            {block.startTime}
            {block.endTime !== block.startTime ? ` – ${block.endTime}` : ''}
          </span>
          {' — '}
          {isColorGroupWashRow(block.colorGroupRole) && (
            <WashPhaseIcon className="mr-0.5 inline h-3.5 w-3.5 align-[-2px] opacity-90" title="Lavado" />
          )}
          {isColorGroupWashRow(block.colorGroupRole) ? 'Lavar color' : block.serviceName}
          {block.nameEn ? ` - ${block.nameEn}` : ''} ({block.staffLabel})
        </li>
      ))}
    </ul>
  )
}

function ClientPanelView({
  draft,
  customerRegistered,
  showCustomerHistory,
  adminToken,
  onEditClient,
}: {
  draft: AppointmentDraft
  customerRegistered: boolean
  showCustomerHistory: boolean
  adminToken?: string
  onEditClient: () => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const displayName = formatCustomerDisplayName(
    draft.customerFirstName,
    draft.customerLastName,
  )
  const phone = draft.customerPhone

  return (
    <div className="rounded-lg border border-gold/20 bg-charcoal/[0.04] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-charcoal">{displayName || '—'}</p>
            {customerRegistered && (
              <button
                type="button"
                onClick={onEditClient}
                className="inline-flex cursor-pointer items-center justify-center rounded p-0.5 text-lg leading-none text-charcoal/80 transition-colors hover:bg-gold/10 hover:text-gold"
                aria-label="Editar cliente"
                title="Editar datos del cliente"
              >
                ✎
              </button>
            )}
          </div>
          {customerRegistered && (
            <p className={`${typography.caption} mt-0.5 text-charcoal-muted`}>
              Cliente en tu listado
            </p>
          )}
        </div>
        {phone && (
          <div className="flex shrink-0 gap-1.5">
            <a
              href={whatsappHref(phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/35 text-charcoal-muted hover:border-gold hover:text-gold"
              aria-label="WhatsApp"
              title="WhatsApp"
            >
              💬
            </a>
            <a
              href={`tel:${normalizePhone(phone)}`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/35 text-charcoal-muted hover:border-gold hover:text-gold"
              aria-label="Llamar"
              title="Llamar"
            >
              📞
            </a>
          </div>
        )}
      </div>

      <dl className="space-y-2.5 text-sm">
        <div>
          <dt className={typography.label}>Móvil</dt>
          <dd className="mt-0.5 tabular-nums">{phone ? formatPhoneDisplay(phone) : '—'}</dd>
        </div>
        <div>
          <dt className={typography.label}>Correo electrónico</dt>
          <dd className="mt-0.5 break-all">{dash(draft.customerEmail)}</dd>
        </div>
        <div>
          <dt className={typography.label}>Observaciones del cliente (ficha)</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-charcoal-muted">
            {dash(draft.customerNotes)}
          </dd>
        </div>
        <div>
          <dt className={typography.label}>Observaciones de la cita</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-charcoal-muted">{dash(draft.notes)}</dd>
        </div>
      </dl>

      {showCustomerHistory && phone && adminToken && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            Historial de citas
          </Button>
          <CustomerAppointmentHistoryModal
            open={historyOpen}
            adminToken={adminToken}
            phone={phone}
            customerLabel={customerHistoryModalTitle(
              draft.customerFirstName,
              draft.customerLastName,
            )}
            onClose={() => setHistoryOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

function ClientPanelEdit({
  draft,
  customerRegistered,
  onDraftChange,
}: {
  draft: AppointmentDraft
  customerRegistered: boolean
  onDraftChange: (patch: Partial<AppointmentDraft>) => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-gold/20 bg-charcoal/[0.04] p-4">
      <p className={`${typography.label} text-gold`}>
        {customerRegistered ? 'Datos del cliente' : 'Datos del cliente en esta cita'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Nombre"
          required
          value={draft.customerFirstName}
          onChange={(e) => onDraftChange({ customerFirstName: e.target.value })}
          className="!px-3 !py-2"
        />
        <Input
          label="Apellidos"
          value={draft.customerLastName}
          onChange={(e) => onDraftChange({ customerLastName: e.target.value })}
          className="!px-3 !py-2"
        />
        <Input
          label="Móvil"
          required
          type="tel"
          value={draft.customerPhone}
          onChange={(e) => onDraftChange({ customerPhone: e.target.value })}
          className="!px-3 !py-2"
          autoComplete="tel"
        />
        <Input
          label="Correo electrónico"
          type="email"
          value={draft.customerEmail}
          onChange={(e) => onDraftChange({ customerEmail: e.target.value })}
          className="!px-3 !py-2"
        />
      </div>
      {customerRegistered && (
        <Textarea
          label="Observaciones (ficha cliente)"
          rows={2}
          value={draft.customerNotes}
          onChange={(e) => onDraftChange({ customerNotes: e.target.value })}
          className="!px-3 !py-2"
        />
      )}
      <Textarea
        label="Observaciones de la cita"
        rows={2}
        value={draft.notes}
        onChange={(e) => onDraftChange({ notes: e.target.value })}
        className="!px-3 !py-2"
      />
    </div>
  )
}

export function AgendaAppointmentModal({
  open,
  mode,
  date,
  staffId,
  staffName,
  staffOptions,
  onStaffChange,
  appointment,
  customerRegistered,
  draft,
  services,
  slots,
  saving = false,
  onModeChange,
  onDraftChange,
  onSubmit,
  onClose,
  onCancelAppointment,
  showCustomerHistory = false,
  adminToken,
}: Props) {
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

  if (!open) return null

  const timeOptions = [...new Set([...slots, ...(draft.startTime ? [draft.startTime] : [])])].sort()
  const selectCn =
    'w-full cursor-pointer border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-50'

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
                  <ServiceBlocks
                    appointment={appointment}
                    staffName={staffName}
                    services={services}
                  />
                </section>
                <section>
                  <ClientPanelView
                    draft={draft}
                    customerRegistered={customerRegistered}
                    showCustomerHistory={showCustomerHistory}
                    adminToken={adminToken}
                    onEditClient={() => onModeChange('edit')}
                  />
                </section>
              </div>
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-gold/15 px-4 py-3 sm:px-5">
              <Button type="button" variant="solid" size="sm" onClick={() => onModeChange('edit')}>
                Editar
              </Button>
              {onCancelAppointment && (
                <button
                  type="button"
                  onClick={onCancelAppointment}
                  className="cursor-pointer text-sm text-charcoal-muted underline-offset-2 hover:text-red-800 hover:underline"
                >
                  Eliminar
                </button>
              )}
            </footer>
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
                  {staffOptions.length > 0 && (
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
                  <ServiceCategoryPicker
                    compact
                    variant="staff"
                    services={services}
                    serviceId={draft.serviceId}
                    loading={services.length === 0}
                    onServiceChange={(id) => onDraftChange({ serviceId: id })}
                  />
                  <div>
                    <label className={`${typography.label} mb-0.5 block text-xs`}>Hora</label>
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
                </section>
                <section>
                  <ClientPanelEdit
                    draft={draft}
                    customerRegistered={customerRegistered}
                    onDraftChange={onDraftChange}
                  />
                </section>
              </div>
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-gold/15 px-4 py-3 sm:px-5">
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
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}
