import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/useTranslation'
import {
  createAppointment,
  fetchServiceDaySlots,
  fetchServices,
  fetchStaffAtSlot,
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
  const [serviceId, setServiceIdState] = useState(options.initialServiceId ?? '')
  const [staffId, setStaffIdState] = useState(options.initialStaffId ?? '')
  const [date, setDateState] = useState(options.initialDate ?? '')
  const [startTime, setStartTimeState] = useState(options.initialStartTime ?? '')
  const [slots, setSlots] = useState<string[]>([])
  const [staffAtSlot, setStaffAtSlot] = useState<StaffMember[]>([])

  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingStaffAtSlot, setLoadingStaffAtSlot] = useState(false)
  const [slotsError, setSlotsError] = useState('')
  const [staffAtSlotError, setStaffAtSlotError] = useState('')

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
  const selectedStaff = staffAtSlot.find((s) => s.id === staffId)

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

  const setServiceId = useCallback(
    (id: string) => {
      setServiceIdState(id)
      if (!options.initialDate) {
        setDateState('')
        setStartTimeState('')
        setStaffIdState('')
        setSlots([])
        setStaffAtSlot([])
      }
    },
    [options.initialDate],
  )

  const setDate = useCallback(
    (value: string) => {
      setDateState(value)
      setStartTimeState('')
      setStaffIdState('')
      setStaffAtSlot([])
      setStaffAtSlotError('')
    },
    [],
  )

  const setStartTime = useCallback((value: string) => {
    setStartTimeState(value)
    setStaffIdState('')
    setStaffAtSlot([])
    setStaffAtSlotError('')
  }, [])

  const setStaffId = useCallback((id: string) => {
    setStaffIdState(id)
  }, [])

  useEffect(() => {
    if (!serviceId) {
      setSlots([])
      setStaffAtSlot([])
      return
    }
    if (!options.initialDate) {
      setDateState('')
      setStartTimeState('')
      setStaffIdState('')
      setSlots([])
      setStaffAtSlot([])
    }
  }, [serviceId, options.initialDate])

  useEffect(() => {
    if (!date || !serviceId) {
      setSlots([])
      return
    }

    setLoadingSlots(true)
    if (!options.initialStartTime) setStartTimeState('')
    setSlotsError('')
    setStaffAtSlot([])
    if (!options.initialStaffId) setStaffIdState('')

    fetchServiceDaySlots(date, serviceId)
      .then((res) => {
        setSlots(res.slots)
        if (options.initialStartTime && res.slots.includes(options.initialStartTime)) {
          setStartTimeState(options.initialStartTime)
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
  }, [date, serviceId, options.initialStartTime, options.initialStaffId, errors.noSlots, errors.loadSlots])

  useEffect(() => {
    if (!date || !serviceId || !startTime) {
      setStaffAtSlot([])
      return
    }

    setLoadingStaffAtSlot(true)
    if (!options.initialStaffId) setStaffIdState('')
    setStaffAtSlotError('')

    fetchStaffAtSlot(date, serviceId, startTime)
      .then((res) => {
        setStaffAtSlot(res.staff)
        if (options.initialStaffId && res.staff.some((s) => s.id === options.initialStaffId)) {
          setStaffIdState(options.initialStaffId)
        } else if (res.staff.length === 0) {
          setStaffAtSlotError(errors.noStaffAtSlot)
        }
      })
      .catch((err) => {
        setStaffAtSlot([])
        setStaffAtSlotError(err instanceof ApiError ? err.message : errors.loadStaff)
      })
      .finally(() => setLoadingStaffAtSlot(false))
  }, [date, serviceId, startTime, options.initialStaffId, errors.noStaffAtSlot, errors.loadStaff])

  const resetForm = useCallback(() => {
    setServiceIdState('')
    setStaffIdState('')
    setDateState('')
    setStartTimeState('')
    setSlots([])
    setStaffAtSlot([])
    setError('')
    setFieldErrors({})
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setNotes('')
  }, [])

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
    staffAtSlot,
    staffId,
    setStaffId,
    date,
    setDate,
    startTime,
    setStartTime,
    slots,
    loadingStaffAtSlot,
    loadingSlots,
    staffAtSlotError,
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
