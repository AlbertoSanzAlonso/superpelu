import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ServiceCategoryPickerPublic } from '@/components/shared/ServiceCategoryPickerPublic'
import {
  useAppointmentForm,
  type AppointmentFormOptions,
} from '@/hooks/useAppointmentForm'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate, getBookableDates } from '@/lib/dates'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

const bookableDates = getBookableDates(35)

type AppointmentFormProps = AppointmentFormOptions & {
  submitLabel?: string
  showAgendaLink?: boolean
  onConfirmed?: (appointment: Appointment) => void
}

export function AppointmentForm({
  submitLabel = 'Confirmar cita',
  showAgendaLink = true,
  onConfirmed,
  onSuccess,
  ...formOptions
}: AppointmentFormProps) {
  const form = useAppointmentForm({
    ...formOptions,
    onSuccess: (apt) => {
      onSuccess?.(apt)
      onConfirmed?.(apt)
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await form.submit()
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-8">
      <ServiceCategoryPickerPublic
        services={form.services}
        serviceId={form.serviceId}
        loading={form.servicesLoading}
        onServiceChange={form.setServiceId}
      />

      <fieldset className="space-y-3">
        <legend className={`${typography.label} mb-2 block w-full text-center`}>
          Profesional
        </legend>
        {!form.serviceId ? (
          <p className={`${typography.caption} text-center`}>Primero elige tu tratamiento</p>
        ) : form.loadingStaff ? (
          <p className={`${typography.caption} text-center`}>Cargando equipo…</p>
        ) : form.staffOptions.length === 0 ? (
          <p
            className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
            role="status"
          >
            {form.staffError || 'No hay profesionales para este servicio.'}
          </p>
        ) : (
          <div className="grid gap-3">
            {form.staffOptions.map((member) => (
              <label
                key={member.id}
                className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${
                  form.staffId === member.id
                    ? 'border-gold bg-gold/5'
                    : 'border-gold/20 hover:border-gold/40'
                }`}
              >
                <input
                  type="radio"
                  name="staff"
                  value={member.id}
                  checked={form.staffId === member.id}
                  onChange={() => form.setStaffId(member.id)}
                  className="mt-1 accent-gold"
                  required
                />
                <span className="text-left">
                  <span className={`${typography.h3} block text-gold`}>{member.name}</span>
                  {member.role && <span className={typography.caption}>{member.role}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="apt-date" className={`${typography.label} mb-2 block`}>
          Día
        </label>
        <select
          id="apt-date"
          required
          disabled={!form.staffId}
          value={form.date}
          onChange={(e) => form.setDate(e.target.value)}
          className="w-full border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none focus:border-gold disabled:opacity-50"
        >
          <option value="">Selecciona un día</option>
          {bookableDates.map((d) => (
            <option key={d} value={d}>
              {formatDisplayDate(d)}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-3">
        <legend className={`${typography.label} mb-2 block w-full text-center`}>Hora</legend>
        {!form.date || !form.staffId ? (
          <p className={`${typography.caption} text-center`}>
            {!form.staffId ? 'Elige un profesional' : 'Primero elige un día'}
          </p>
        ) : form.loadingSlots ? (
          <p className={`${typography.caption} text-center`}>Cargando horarios…</p>
        ) : form.slots.length === 0 ? (
          <p
            className="rounded border border-amber-300/60 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950"
            role="status"
          >
            {form.slotsError || 'No hay huecos ese día.'}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {form.slots.map((slot) => (
              <label
                key={slot}
                className={`cursor-pointer border py-2 text-center text-sm transition-colors ${
                  form.startTime === slot
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-gold/20 hover:border-gold/50'
                }`}
              >
                <input
                  type="radio"
                  name="time"
                  value={slot}
                  checked={form.startTime === slot}
                  onChange={() => form.setStartTime(slot)}
                  className="sr-only"
                  required
                />
                {slot}
                {form.selectedService && (
                  <span className="mt-0.5 block text-[10px] leading-tight text-charcoal-muted">
                    {formatAppointmentTimeRange(
                      form.selectedService.id,
                      slot,
                      form.selectedService.durationMinutes,
                    )}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="space-y-4 border-t border-gold/15 pt-8">
        <Input
          label="Nombre completo"
          required
          value={form.customerName}
          onChange={(e) => form.setCustomerName(e.target.value)}
          autoComplete="name"
        />
        <Input
          label="Teléfono"
          type="tel"
          required
          value={form.customerPhone}
          onChange={(e) => form.setCustomerPhone(e.target.value)}
          autoComplete="tel"
          placeholder="600 000 000"
        />
        <Input
          label="Email (opcional)"
          type="email"
          value={form.customerEmail}
          onChange={(e) => form.setCustomerEmail(e.target.value)}
          autoComplete="email"
        />
        <Textarea
          label="Notas (opcional)"
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
          placeholder="Mechas, alergias, preferencias…"
        />
      </div>

      {form.error && (
        <p className="text-center text-sm text-red-700" role="alert">
          {form.error}
        </p>
      )}

      <Button
        type="submit"
        variant="solid"
        size="lg"
        className="w-full"
        disabled={form.submitting || !form.canSubmit}
      >
        {form.submitting ? 'Guardando…' : submitLabel}
      </Button>

      {form.selectedStaff && form.selectedService && (
        <p className={`${typography.caption} text-center`}>
          {form.selectedStaff.name} · {form.selectedService.nameEs}
        </p>
      )}

      {showAgendaLink && (
        <p className={`${typography.caption} text-center`}>
          ¿Eres del equipo?{' '}
          <Link to="/agenda" className="text-gold hover:text-gold-dark">
            Ver agenda interna
          </Link>
        </p>
      )}
    </form>
  )
}
