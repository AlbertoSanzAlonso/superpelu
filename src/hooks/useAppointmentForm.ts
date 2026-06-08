import { useCallback, useEffect, useMemo, useState } from 'react'
import { publicAppointmentErrorMessage } from '@/i18n/publicAppointmentErrors'
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
  onSuccess?: (appointment: Appointment, appointments?: Appointment[]) => void
}

export function useAppointmentForm(options: AppointmentFormOptions = {}) {
  const { t, locale } = useTranslation()
  const errors = t.booking.errors
  const onSuccess = options.onSuccess

  const [services, setServices] = useState<BookableService[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState('')
  const [serviceIds, setServiceIdsState] = useState<string[]>(
    options.initialServiceId ? [options.initialServiceId] : [],
  )
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

  const hasMultipleServices = serviceIds.length > 1

  const selectedServices = useMemo(
    () =>
      serviceIds
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is BookableService => s != null),
    [serviceIds, services],
  )
  const selectedStaff = staffAtSlot.find((s) => s.id === staffId)

  const canSubmit = Boolean(
    serviceIds.length > 0 && staffId && date && startTime && customerName.trim() && customerPhone.trim(),
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
      .catch(() => {
        setServices([])
        setServicesError(errors.serverConnection)
      })
      .finally(() => setServicesLoading(false))
  }, [errors.noServicesOnline, errors.serverConnection])

  useEffect(() => {
    void loadServices()
  }, [loadServices])

  const resetScheduleSelection = useCallback(() => {
    if (!options.initialDate) {
      setDateState('')
      setStartTimeState('')
      setStaffIdState('')
      setSlots([])
      setStaffAtSlot([])
    }
  }, [options.initialDate])

  const setServiceIds = useCallback(
    (ids: string[]) => {
      setServiceIdsState(ids)
      resetScheduleSelection()
    },
    [resetScheduleSelection],
  )

  const toggleServiceId = useCallback(
    (id: string) => {
      setServiceIdsState((current) => {
        if (current.includes(id)) {
          return current.filter((item) => item !== id)
        }
        return [...current, id]
      })
      resetScheduleSelection()
    },
    [resetScheduleSelection],
  )

  const removeServiceId = useCallback(
    (id: string) => {
      setServiceIdsState((current) => current.filter((item) => item !== id))
      resetScheduleSelection()
    },
    [resetScheduleSelection],
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
    if (serviceIds.length === 0) {
      setSlots([])
      setStaffAtSlot([])
      return
    }
    if (!options.initialDate) {
      resetScheduleSelection()
    }
  }, [serviceIds, options.initialDate, resetScheduleSelection])

  useEffect(() => {
    if (!date || serviceIds.length === 0) {
      setSlots([])
      return
    }

    setLoadingSlots(true)
    if (!options.initialStartTime) setStartTimeState('')
    setSlotsError('')
    setStaffAtSlot([])
    if (!options.initialStaffId) setStaffIdState('')

    fetchServiceDaySlots(date, serviceIds)
      .then((res) => {
        setSlots(res.slots)
        if (options.initialStartTime && res.slots.includes(options.initialStartTime)) {
          setStartTimeState(options.initialStartTime)
        }
        if (res.slots.length === 0) {
          setSlotsError(hasMultipleServices ? errors.chainedNoSlots : errors.noSlots)
        }
      })
      .catch(() => {
        setSlots([])
        setSlotsError(errors.loadSlots)
      })
      .finally(() => setLoadingSlots(false))
  }, [
    date,
    serviceIds,
    options.initialStartTime,
    options.initialStaffId,
    errors.noSlots,
    errors.chainedNoSlots,
    errors.loadSlots,
    hasMultipleServices,
  ])

  useEffect(() => {
    if (!date || serviceIds.length === 0 || !startTime) {
      setStaffAtSlot([])
      return
    }

    setLoadingStaffAtSlot(true)
    if (!options.initialStaffId) setStaffIdState('')
    setStaffAtSlotError('')

    fetchStaffAtSlot(date, serviceIds, startTime)
      .then((res) => {
        setStaffAtSlot(res.staff)
        if (options.initialStaffId && res.staff.some((s) => s.id === options.initialStaffId)) {
          setStaffIdState(options.initialStaffId)
        } else if (res.staff.length === 0) {
          setStaffAtSlotError(
            hasMultipleServices ? errors.chainedNoStaffAtSlot : errors.noStaffAtSlot,
          )
        }
      })
      .catch(() => {
        setStaffAtSlot([])
        setStaffAtSlotError(errors.loadStaff)
      })
      .finally(() => setLoadingStaffAtSlot(false))
  }, [
    date,
    serviceIds,
    startTime,
    options.initialStaffId,
    errors.noStaffAtSlot,
    errors.chainedNoStaffAtSlot,
    errors.loadStaff,
    hasMultipleServices,
  ])

  const resetForm = useCallback(() => {
    setServiceIdsState([])
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
      const { appointment, appointments } = await createAppointment({
        serviceIds,
        staffId,
        date,
        startTime,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        notes: notes || undefined,
        locale,
      })
      onSuccess?.(appointment, appointments)
      return appointment
    } catch (err) {
      if (err instanceof ApiError && err.code) {
        setError(publicAppointmentErrorMessage(err.code, locale) ?? errors.createFailed)
      } else {
        setError(errors.createFailed)
      }
      return null
    } finally {
      setSubmitting(false)
    }
  }, [
    validateCustomerFields,
    canSubmit,
    serviceIds,
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
    serviceIds,
    setServiceIds,
    toggleServiceId,
    removeServiceId,
    selectedServices,
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
    selectedStaff,
    hasMultipleServices,
    resetForm,
    submit,
  }
}
