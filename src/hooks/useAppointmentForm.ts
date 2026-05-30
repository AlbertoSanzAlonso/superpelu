import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/useTranslation'
import {
  createAppointment,
  fetchServices,
  fetchSlots,
  fetchStaffForService,
  ApiError,
} from '@/lib/api'
import { isValidSpanishPhone } from '@/lib/phone'
import type { Appointment, BookableService, StaffMember } from '@/types/booking'

export type AppointmentFormOptions = {
  initialDate?: string
  initialStaffId?: string
  initialServiceId?: string
  initialStartTime?: string
  onSuccess?: (appointment: Appointment) => void
}

export function useAppointmentForm(options: AppointmentFormOptions = {}) {
  const { t, locale } = useTranslation()
  const errors = t.booking.errors
  const onSuccess = options.onSuccess

  const [services, setServices] = useState<BookableService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState('')
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

  const [customerName, setCustomerNameState] = useState('')
  const [customerPhone, setCustomerPhoneState] = useState('')

  const setCustomerName = useCallback((value: string) => {
    setCustomerNameState(value)
    setFieldErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev))
  }, [])

  const setCustomerPhone = useCallback((value: string) => {
    setCustomerPhoneState(value)
    setFieldErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev))
  }, [])
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({})
  const [submitting, setSubmitting] = useState(false)

  const selectedService = services.find((s) => s.id === serviceId)
  const selectedStaff = staffOptions.find((s) => s.id === staffId)

  const canSubmit = Boolean(
    serviceId && staffId && date && startTime && customerName.trim() && customerPhone.trim(),
  )

  const loadServices = useCallback(() => {
    setServicesLoading(true)
    setServicesError('')
    return fetchServices()
      .then((res) => {
        setServices(res.services)
        if (res.services.length === 0) {
          setServicesError(errors.noServicesOnline)
        }
      })
      .catch((err) => {
        setServices([])
        setServicesError(
          err instanceof ApiError ? err.message : errors.serverConnection,
        )
      })
      .finally(() => setServicesLoading(false))
  }, [errors.noServicesOnline, errors.serverConnection])

  useEffect(() => {
    void loadServices()
  }, [loadServices])

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
          setStaffError(errors.noStaff)
        }
      })
      .catch((err) => {
        setStaffOptions([])
        setStaffError(err instanceof ApiError ? err.message : errors.loadStaff)
      })
      .finally(() => setLoadingStaff(false))
  }, [serviceId, options.initialStaffId, options.initialDate, staffId, errors.noStaff, errors.loadStaff])

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
          setSlotsError(errors.noSlots)
        }
      })
      .catch((err) => {
        setSlots([])
        setSlotsError(err instanceof ApiError ? err.message : errors.loadSlots)
      })
      .finally(() => setLoadingSlots(false))
  }, [date, serviceId, staffId, options.initialStartTime, errors.noSlots, errors.loadSlots])

  const resetForm = useCallback(() => {
    setServiceId('')
    setStaffId('')
    setDate('')
    setStartTime('')
    setSlots([])
    setError('')
    setFieldErrors({})
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setNotes('')
  }, [services])

  const validateCustomerFields = useCallback(() => {
    const next: { name?: string; phone?: string } = {}
    if (!customerName.trim()) {
      next.name = errors.nameRequired
    }
    if (!customerPhone.trim()) {
      next.phone = errors.phoneRequired
    } else if (!isValidSpanishPhone(customerPhone)) {
      next.phone = errors.phoneInvalid
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }, [customerName, customerPhone, errors.nameRequired, errors.phoneInvalid, errors.phoneRequired])

  const submit = useCallback(async () => {
    setError('')
    if (!validateCustomerFields()) return null
    if (!canSubmit) return null

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
        locale,
      })
      onSuccess?.(appointment)
      return appointment
    } catch (err) {
      setError(err instanceof Error ? err.message : errors.createFailed)
      return null
    } finally {
      setSubmitting(false)
    }
  }, [
    validateCustomerFields,
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
    errors.createFailed,
    locale,
  ])

  return {
    services,
    servicesLoading,
    servicesError,
    loadServices,
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
    fieldErrors,
    submitting,
    canSubmit,
    selectedService,
    selectedStaff,
    resetForm,
    submit,
  }
}
