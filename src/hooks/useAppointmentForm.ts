import { useCallback, useEffect, useMemo, useState } from 'react'
import { publicAppointmentErrorMessage } from '@/i18n/publicAppointmentErrors'
import { useTranslation } from '@/i18n/useTranslation'
import {
  createAppointment,
  fetchBookingChainContinuation,
  fetchServiceDaySlots,
  fetchServices,
  fetchStaffAtSlot,
  ApiError,
} from '@/lib/api'
import { buildFlexibleServiceStartTimes } from '@/lib/booking/combo'
import { isValidSpanishPhone } from '@/lib/customer/phone'
import type {
  Appointment,
  BookableService,
  BookingChainSegmentPlan,
  StaffMember,
} from '@/types/booking'

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
  const [staffAssignments, setStaffAssignments] = useState<string[]>([])
  const [chainSegments, setChainSegments] = useState<BookingChainSegmentPlan[]>([])
  const [chainNextStaff, setChainNextStaff] = useState<StaffMember[]>([])
  const [chainNextIndex, setChainNextIndex] = useState<number | null>(null)
  const [chainNextStartTime, setChainNextStartTime] = useState('')
  const [chainNeedsTimeChange, setChainNeedsTimeChange] = useState(false)
  const [serviceStartOverrides, setServiceStartOverrides] = useState<(string | undefined)[]>([])
  const [chainPostpone, setChainPostpone] = useState<{
    serviceIndex: number
    idealStartTime: string
    slots: string[]
  } | null>(null)
  const [chainConflict, setChainConflict] = useState(false)
  const [chainAvailableStaffIds, setChainAvailableStaffIds] = useState<string[]>([])

  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingStaffAtSlot, setLoadingStaffAtSlot] = useState(false)
  const [loadingChain, setLoadingChain] = useState(false)
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
  const chainComplete =
    !hasMultipleServices || staffAssignments.length === serviceIds.length

  const canSubmit = Boolean(
    serviceIds.length > 0 &&
      date &&
      startTime &&
      customerName.trim() &&
      customerPhone.trim() &&
      (hasMultipleServices
        ? staffAssignments.length === serviceIds.length
        : Boolean(staffId)),
  )

  const resetChainSelection = useCallback(() => {
    setStaffAssignments([])
    setChainSegments([])
    setChainNextStaff([])
    setChainNextIndex(null)
    setChainNextStartTime('')
    setChainNeedsTimeChange(false)
    setServiceStartOverrides([])
    setChainPostpone(null)
    setChainConflict(false)
    setChainAvailableStaffIds([])
    setStaffIdState('')
  }, [])

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
      setSlots([])
      setStaffAtSlot([])
    }
    resetChainSelection()
  }, [options.initialDate, resetChainSelection])

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
      setStaffAtSlot([])
      setStaffAtSlotError('')
      resetChainSelection()
    },
    [resetChainSelection],
  )

  const setStartTime = useCallback(
    (value: string) => {
      setStartTimeState(value)
      setStaffAtSlot([])
      setStaffAtSlotError('')
      resetChainSelection()
    },
    [resetChainSelection],
  )

  const setStaffId = useCallback((id: string) => {
    setStaffIdState(id)
  }, [])

  const applyChainResponse = useCallback((res: Awaited<ReturnType<typeof fetchBookingChainContinuation>>) => {
    setChainSegments(res.segments)
    if (res.complete) {
      setChainNextStaff([])
      setChainNextIndex(null)
      setChainNextStartTime('')
      setChainPostpone(null)
      setChainConflict(false)
      setChainAvailableStaffIds([])
      setChainNeedsTimeChange(false)
      return true
    }
    if (res.needsTimeChange && !res.next && !res.postpone) {
      setChainNeedsTimeChange(true)
      setChainNextStaff([])
      setChainNextIndex(null)
      setChainNextStartTime('')
      setChainPostpone(null)
      setChainConflict(false)
      setChainAvailableStaffIds([])
      setStaffAssignments([])
      setStaffIdState('')
      setChainSegments([])
      setServiceStartOverrides([])
      return false
    }
    setChainNeedsTimeChange(res.needsTimeChange)
    setChainConflict(Boolean(res.conflict))
    setChainPostpone(res.postpone ?? null)
    if (res.next) {
      setChainNextStaff(res.next.staff)
      setChainNextIndex(res.next.serviceIndex)
      setChainNextStartTime(res.next.startTime)
      setChainAvailableStaffIds(res.next.availableStaffIds)
    } else {
      setChainNextStaff([])
      setChainNextIndex(res.postpone?.serviceIndex ?? null)
      setChainNextStartTime(res.postpone?.idealStartTime ?? '')
      setChainAvailableStaffIds([])
    }
    return false
  }, [])

  const pickChainStaff = useCallback(
    async (id: string): Promise<boolean> => {
      if (!date || !startTime || serviceIds.length < 2) return false
      const nextAssignments = [...staffAssignments, id]
      setLoadingChain(true)
      try {
        const res = await fetchBookingChainContinuation(
          date,
          serviceIds,
          startTime,
          nextAssignments,
          serviceStartOverrides,
        )
        // Si la profesional elegida no encaja, el API vuelve a pedir el mismo
        // índice (o solo horas posteriores): no guardar esa asignación.
        if (!res.complete) {
          const retryIndex = res.next?.serviceIndex ?? res.postpone?.serviceIndex
          if (retryIndex === staffAssignments.length) {
            applyChainResponse(res)
            return false
          }
        }
        setStaffAssignments(nextAssignments)
        if (staffAssignments.length === 0) {
          setStaffIdState(id)
        }
        return applyChainResponse(res)
      } catch {
        setChainNeedsTimeChange(true)
        setStaffAssignments([])
        setStaffIdState('')
        setChainPostpone(null)
        setChainConflict(false)
        setChainAvailableStaffIds([])
        return false
      } finally {
        setLoadingChain(false)
      }
    },
    [date, serviceIds, startTime, staffAssignments, serviceStartOverrides, applyChainResponse],
  )

  const pickPostponeSlot = useCallback(
    async (serviceIndex: number, slot: string): Promise<void> => {
      if (!date || !startTime || serviceIds.length < 2) return
      const overrides = [...serviceStartOverrides]
      while (overrides.length < serviceIds.length) overrides.push(undefined)
      overrides[serviceIndex] = slot
      const keptAssignments = staffAssignments.slice(0, serviceIndex)
      setServiceStartOverrides(overrides)
      setStaffAssignments(keptAssignments)
      if (serviceIndex === 0) {
        setStaffIdState(keptAssignments[0] ?? '')
      }
      setLoadingChain(true)
      try {
        const res = await fetchBookingChainContinuation(
          date,
          serviceIds,
          startTime,
          keptAssignments,
          overrides,
        )
        applyChainResponse(res)
      } catch {
        setChainNeedsTimeChange(true)
      } finally {
        setLoadingChain(false)
      }
    },
    [
      date,
      serviceIds,
      startTime,
      serviceStartOverrides,
      staffAssignments,
      applyChainResponse,
    ],
  )

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
    resetChainSelection()
    setError('')
    setFieldErrors({})
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setNotes('')
  }, [resetChainSelection])

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
      const primaryStaffId = hasMultipleServices ? staffAssignments[0]! : staffId
      const serviceStartTimes = hasMultipleServices
        ? buildFlexibleServiceStartTimes(
            selectedServices.map((service) => ({
              id: service.id,
              durationMinutes: service.durationMinutes,
              categoryId: service.categoryId,
            })),
            startTime,
            serviceStartOverrides,
          )
        : undefined
      const { appointment, appointments } = await createAppointment({
        serviceIds,
        staffId: primaryStaffId,
        staffAssignments: hasMultipleServices ? staffAssignments : undefined,
        serviceStartTimes,
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
    staffAssignments,
    serviceStartOverrides,
    selectedServices,
    hasMultipleServices,
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
    staffAssignments,
    chainSegments,
    chainNextStaff,
    chainNextIndex,
    chainNextStartTime,
    chainNeedsTimeChange,
    chainPostpone,
    chainConflict,
    chainAvailableStaffIds,
    serviceStartOverrides,
    chainComplete,
    loadingChain,
    pickChainStaff,
    pickPostponeSlot,
    resetChainSelection,
    resetForm,
    submit,
  }
}

export type AppointmentFormApi = ReturnType<typeof useAppointmentForm>
