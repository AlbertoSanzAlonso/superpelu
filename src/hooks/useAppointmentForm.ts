import { useCallback, useEffect, useState } from 'react'
import {
  createAppointment,
  fetchServices,
  fetchSlots,
  fetchStaffForService,
  ApiError,
} from '@/lib/api'
import type { Appointment, BookableService, StaffMember } from '@/types/booking'

export type AppointmentFormOptions = {
  initialDate?: string
  initialStaffId?: string
  initialServiceId?: string
  initialStartTime?: string
  onSuccess?: (appointment: Appointment) => void
}

export function useAppointmentForm(options: AppointmentFormOptions = {}) {
  const onSuccess = options.onSuccess

  const [services, setServices] = useState<BookableService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [serviceId, setServiceId] = useState(options.initialServiceId ?? '')
  const [staffOptions, setStaffOptions] = useState<StaffMember[]>([])
  const [staffId, setStaffId] = useState(options.initialStaffId ?? '')
  const [date, setDate] = useState(options.initialDate ?? '')
  const [startTime, setStartTime] = useState(options.initialStartTime ?? '')
  const [slots, setSlots] = useState<string[]>([])

  const [loadingStaff, setLoadingStaff] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [staffError, setStaffError] = useState('')
  const [slotsError, setSlotsError] = useState('')

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedService = services.find((s) => s.id === serviceId)
  const selectedStaff = staffOptions.find((s) => s.id === staffId)

  const canSubmit = Boolean(
    serviceId && staffId && date && startTime && customerName.trim() && customerPhone.trim(),
  )

  useEffect(() => {
    setServicesLoading(true)
    fetchServices()
      .then((res) => {
        setServices(res.services)
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false))
  }, [options.initialServiceId])

  useEffect(() => {
    if (!serviceId) {
      setStaffOptions([])
      if (!options.initialStaffId) setStaffId('')
      return
    }

    setLoadingStaff(true)
    setStaffError('')
    if (!options.initialDate) {
      setDate('')
      setStartTime('')
      setSlots([])
    }

    fetchStaffForService(serviceId)
      .then((res) => {
        setStaffOptions(res.staff)
        if (options.initialStaffId && res.staff.some((s) => s.id === options.initialStaffId)) {
          setStaffId(options.initialStaffId)
        } else if (res.staff.length === 1) {
          setStaffId(res.staff[0].id)
        } else if (!res.staff.some((s) => s.id === staffId)) {
          setStaffId('')
        }
        if (res.staff.length === 0) {
          setStaffError('No hay profesionales para este servicio.')
        }
      })
      .catch((err) => {
        setStaffOptions([])
        setStaffError(
          err instanceof ApiError ? err.message : 'No se pudo cargar el equipo.',
        )
      })
      .finally(() => setLoadingStaff(false))
  }, [serviceId, options.initialStaffId, options.initialDate, staffId])

  useEffect(() => {
    if (!date || !serviceId || !staffId) {
      setSlots([])
      return
    }

    setLoadingSlots(true)
    if (!options.initialStartTime) setStartTime('')
    setSlotsError('')

    fetchSlots(date, serviceId, staffId)
      .then((res) => {
        setSlots(res.slots)
        if (options.initialStartTime && res.slots.includes(options.initialStartTime)) {
          setStartTime(options.initialStartTime)
        }
        if (res.slots.length === 0) {
          setSlotsError('No quedan huecos libres ese día con este profesional.')
        }
      })
      .catch((err) => {
        setSlots([])
        setSlotsError(err instanceof ApiError ? err.message : 'No se pudieron cargar horarios.')
      })
      .finally(() => setLoadingSlots(false))
  }, [date, serviceId, staffId, options.initialStartTime])

  const resetForm = useCallback(() => {
    setServiceId('')
    setStaffId('')
    setDate('')
    setStartTime('')
    setSlots([])
    setError('')
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setNotes('')
  }, [services])

  const submit = useCallback(async () => {
    if (!canSubmit) return null

    setError('')
    setSubmitting(true)

    try {
      const { appointment } = await createAppointment({
        serviceId,
        staffId,
        date,
        startTime,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        notes: notes || undefined,
      })
      onSuccess?.(appointment)
      return appointment
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cita')
      return null
    } finally {
      setSubmitting(false)
    }
  }, [
    canSubmit,
    serviceId,
    staffId,
    date,
    startTime,
    customerName,
    customerPhone,
    customerEmail,
    notes,
    onSuccess,
  ])

  return {
    services,
    servicesLoading,
    serviceId,
    setServiceId,
    staffOptions,
    staffId,
    setStaffId,
    date,
    setDate,
    startTime,
    setStartTime,
    slots,
    loadingStaff,
    loadingSlots,
    staffError,
    slotsError,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerEmail,
    setCustomerEmail,
    notes,
    setNotes,
    error,
    submitting,
    canSubmit,
    selectedService,
    selectedStaff,
    resetForm,
    submit,
  }
}
