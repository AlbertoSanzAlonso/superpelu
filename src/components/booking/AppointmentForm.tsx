import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ServiceCategoryPickerPublic } from '@/components/shared/ServiceCategoryPickerPublic'
import {
  useAppointmentForm,
  type AppointmentFormOptions,
} from '@/hooks/useAppointmentForm'
import { formatAppointmentTimeRange } from '@/lib/bookingOccupancy'
import { formatDisplayDate, getBookableDates } from '@/lib/dates'
import { countServicesInCategory } from '@/lib/servicePicker'
import type { Appointment } from '@/types/booking'
import { typography } from '@/styles/typography'

const bookableDates = getBookableDates(35)

const BOOKING_STEPS = [
  '¿Qué te apetece hoy?',
  'Tu tratamiento',
  'Profesional',
  'Día y Hora',
  'Datos y confirmación',
] as const

type AppointmentFormProps = AppointmentFormOptions & {
  submitLabel?: string
  onConfirmed?: (appointment: Appointment) => void
}

export function AppointmentForm({
  submitLabel = 'Confirmar cita',
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

  const [step, setStep] = useState(0)
  const [pickedCategoryId, setPickedCategoryId] = useState('')

  const goPrev = useCallback(() => {
    setStep((current) => {
      if (current === 2 && pickedCategoryId) {
        const count = countServicesInCategory(form.services, pickedCategoryId)
        if (count === 1) return 0
      }
      return Math.max(current - 1, 0)
    })
  }, [pickedCategoryId, form.services])

  const handleCategorySelected = useCallback(
    (categoryId: string) => {
      const count = countServicesInCategory(form.services, categoryId)
      setStep(count === 1 ? 2 : 1)
    },
    [form.services],
  )

  const handleServiceSelected = useCallback(() => {
    setStep(2)
  }, [])

  const handleStaffSelected = useCallback((staffId: string) => {
    form.setStaffId(staffId)
    setStep(3)
  }, [form.setStaffId])

  const handleTimeSelected = useCallback(
    (slot: string) => {
      form.setStartTime(slot)
      setStep(4)
    },
    [form.setStartTime],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await form.submit()
  }

  const pickerProps = {
    services: form.services,
    serviceId: form.serviceId,
    loading: form.servicesLoading,
    error: form.servicesError,
    onRetry: () => void form.loadServices(),
    onServiceChange: form.setServiceId,
    categoryId: pickedCategoryId,
    onCategoryChange: setPickedCategoryId,
  }

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto max-w-lg md:max-w-4xl">
      {step > 0 && (
        <button
          type="button"
          onClick={goPrev}
          className="ui-rounded absolute left-0 top-0 flex h-9 w-9 cursor-pointer items-center justify-center border border-gold/30 text-lg leading-none text-gold transition-colors hover:border-gold/60 hover:bg-gold/5 focus:outline-none focus:ring-2 focus:ring-gold/70"
          aria-label="Paso anterior"
        >
          ‹
        </button>
      )}

      <div className={`mb-8 text-center ${step > 0 ? 'pt-1' : ''}`}>
        <p className={`${typography.caption} mb-2`}>
          Paso {step + 1} de {BOOKING_STEPS.length}
        </p>
        <h2 className={typography.h2}>{BOOKING_STEPS[step]}</h2>
        <div className="mt-5 flex justify-center gap-2" aria-hidden>
          {BOOKING_STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === step ? 'w-7 bg-gold' : index < step ? 'w-2.5 bg-gold/60' : 'w-2.5 bg-gold/20'
              }`}
            />
          ))}
        </div>
      </div>

      <div key={step} className="booking-step-enter">
        {step === 0 && (
          <ServiceCategoryPickerPublic
            {...pickerProps}
            visibleSection="category"
            onCategorySelected={handleCategorySelected}
          />
        )}

        {step === 1 && (
          <ServiceCategoryPickerPublic
            {...pickerProps}
            visibleSection="service"
            onServiceSelected={handleServiceSelected}
          />
        )}

        {step === 2 && (
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
                      onChange={() => handleStaffSelected(member.id)}
                      className="mt-1 accent-gold"
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
        )}

        {step === 3 && (
          <div className="space-y-8">
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
                        onChange={() => handleTimeSelected(slot)}
                        className="sr-only"
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
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
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

            {form.selectedStaff && form.selectedService && (
              <p className={`${typography.caption} text-center`}>
                {form.selectedStaff.name} · {form.selectedService.nameEs}
                {form.date && form.startTime && (
                  <>
                    {' '}
                    · {formatDisplayDate(form.date)} · {form.startTime}
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {form.error && (
        <p className="mt-6 text-center text-sm text-red-700" role="alert">
          {form.error}
        </p>
      )}

      {step === BOOKING_STEPS.length - 1 && (
        <Button
          type="submit"
          variant="solid"
          size="lg"
          className="mt-10 w-full"
          disabled={form.submitting || !form.canSubmit}
        >
          {form.submitting ? 'Guardando…' : submitLabel}
        </Button>
      )}
    </form>
  )
}
