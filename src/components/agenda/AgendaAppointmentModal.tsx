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
  onMarkNoShow?: () => void
  /** Historial de citas del cliente (solo administración). */
  showCustomerHistory?: boolean
  adminToken?: string
  reviewRequestSentAt?: string | null
  onReviewRequestSent?: (sentAt: string) => void
  onCustomerRegisteredChange?: (registered: boolean, reviewRequestSentAt?: string | null) => void
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
  onMarkNoShow,
  showCustomerHistory = false,
  adminToken,
  reviewRequestSentAt = null,
  onReviewRequestSent,
  onCustomerRegisteredChange,
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

  const timeOptions = [...new Set([...slots, ...(draft.startTime ? [draft.startTime] : [])])].sort()
  const selectCn =
    'w-full cursor-pointer border border-gold/30 bg-cream px-3 py-1.5 text-sm outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-50'
  const showReviewRequest = showCustomerHistory

  const serviceIds = draft.serviceIds.length > 0 ? draft.serviceIds : ['']
  const hasServices = draft.serviceIds.length > 0 && draft.serviceIds[0] !== ''

  const setServiceAtIndex = useCallback(
    (index: number, id: string) => {
      const next = [...serviceIds]
      if (index === 0 && id === '') {
        const hadService = serviceIds[0] !== ''
        if (hadService) {
          onDraftChange({ serviceIds: [], serviceStartTimes: [], startTime: '' })
        }
        return
      }
      next[index] = id
      onDraftChange({
        serviceIds: next,
        serviceStartTimes: draft.serviceStartTimes.length === next.length ? draft.serviceStartTimes : [],
      })
    },
    [serviceIds, draft.serviceStartTimes, onDraftChange],
  )

  const setServiceStartTime = useCallback(
    (index: number, time: string) => {
      const times = [...(draft.serviceStartTimes.length === draft.serviceIds.length ? draft.serviceStartTimes : [])]
      times[index] = time
      onDraftChange({ serviceStartTimes: times })
    },
    [draft.serviceStartTimes, draft.serviceIds.length, onDraftChange],
  )

  const addService = useCallback(() => {
    onDraftChange({ serviceIds: [...serviceIds.filter((s) => s !== ''), ''] })
  }, [serviceIds, onDraftChange])

  const removeService = useCallback(
    (index: number) => {
      const next = serviceIds.filter((_, i) => i !== index)
      const cleaned = next.filter((s) => s !== '')
      const times = draft.serviceStartTimes.length === serviceIds.length
        ? draft.serviceStartTimes.filter((_, i) => i !== index)
        : []
      onDraftChange({
        serviceIds: cleaned,
        serviceStartTimes: times,
        startTime: cleaned.length === 0 ? '' : draft.startTime,
      })
    },
    [serviceIds, draft, onDraftChange],
  )

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
                              {draft.startTime ? 'Automática (encadenada)' : 'Elige hora primero'}
                            </option>
                            {timeOptions.map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </select>
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

                  <div>
                    <label className={`${typography.label} mb-0.5 block text-xs`}>
                      Hora de la cita
                    </label>
                    <select
                      required
                      value={draft.startTime}
                      onChange={(e) => {
                        onDraftChange({
                          startTime: e.target.value,
                          serviceStartTimes: [],
                        })
                      }}
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
