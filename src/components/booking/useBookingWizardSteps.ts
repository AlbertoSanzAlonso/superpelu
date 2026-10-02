import { useCallback, useState } from 'react'
import type { AppointmentFormApi } from '@/hooks/useAppointmentForm'
import {
  bookableOnlineInCategory,
  isBookableOnline,
} from '@/lib/catalog/servicePicker'
import type { BookableService } from '@/types/booking'

export const SCHEDULE_STEP = 2
export const CONFIRM_STEP = 3

export function useBookingWizardSteps(form: AppointmentFormApi) {
  const [step, setStep] = useState(0)
  const [pickedCategoryId, setPickedCategoryId] = useState('')

  const goPrev = useCallback(() => {
    if (step === SCHEDULE_STEP && form.staffAssignments.length > 0) {
      form.resetChainSelection()
      return
    }
    if (step === SCHEDULE_STEP && form.startTime) {
      form.setStartTime('')
      return
    }
    if (step === SCHEDULE_STEP && form.date) {
      form.setDate('')
      return
    }
    setStep((current) => {
      if (current === SCHEDULE_STEP) return 1
      if (current === 1) {
        setPickedCategoryId('')
        return 0
      }
      return Math.max(current - 1, 0)
    })
  }, [
    step,
    form.startTime,
    form.date,
    form.setStartTime,
    form.setDate,
    form.staffAssignments.length,
    form.resetChainSelection,
  ])

  const handleCategorySelected = useCallback(
    (categoryId: string) => {
      const bookable = bookableOnlineInCategory(form.services, categoryId)
      if (form.serviceIds.length > 0) {
        setStep(1)
        return
      }
      if (bookable.length === 0) {
        // Solo teléfono/WhatsApp (como mechas): mostrar explicación, no agenda.
        setStep(1)
        return
      }
      if (bookable.length === 1) {
        form.setServiceIds([bookable[0].id])
        setStep(SCHEDULE_STEP)
        return
      }
      setStep(1)
    },
    [form.services, form.serviceIds.length, form.setServiceIds],
  )

  const handleServicePickedFromSearch = useCallback(
    (service: BookableService) => {
      const categoryId = service.categoryId ?? ''
      if (categoryId) setPickedCategoryId(categoryId)

      if (!isBookableOnline(service)) {
        setStep(1)
        return
      }

      form.toggleServiceId(service.id)
      // Paso de servicios: ver selección, añadir otro o continuar.
      setStep(1)
    },
    [form.toggleServiceId],
  )

  const handleContinueWithServices = useCallback(() => {
    if (form.serviceIds.length > 0) setStep(SCHEDULE_STEP)
  }, [form.serviceIds.length])

  const handleTimeSelected = useCallback(
    (slot: string) => {
      form.setStartTime(slot)
    },
    [form.setStartTime],
  )

  const handleStaffSelected = useCallback(
    async (staffId: string) => {
      if (form.hasMultipleServices) {
        const done = await form.pickChainStaff(staffId)
        if (done) setStep(CONFIRM_STEP)
        return
      }
      form.setStaffId(staffId)
      setStep(CONFIRM_STEP)
    },
    [form.hasMultipleServices, form.pickChainStaff, form.setStaffId],
  )

  return {
    step,
    setStep,
    pickedCategoryId,
    setPickedCategoryId,
    goPrev,
    handleCategorySelected,
    handleServicePickedFromSearch,
    handleContinueWithServices,
    handleTimeSelected,
    handleStaffSelected,
  }
}
