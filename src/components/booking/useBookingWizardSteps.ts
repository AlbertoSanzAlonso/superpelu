import { useCallback, useState } from 'react'
import type { AppointmentFormApi } from '@/hooks/useAppointmentForm'
import { countServicesInCategory, servicesInCategory } from '@/lib/servicePicker'

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
      if (current === 1 && form.serviceIds.length > 0) return 0
      if (current === 1 && pickedCategoryId) {
        const count = countServicesInCategory(form.services, pickedCategoryId)
        if (count === 1) return 0
      }
      return Math.max(current - 1, 0)
    })
  }, [
    step,
    form.startTime,
    form.date,
    form.setStartTime,
    form.setDate,
    pickedCategoryId,
    form.services,
    form.serviceIds.length,
    form.staffAssignments.length,
    form.resetChainSelection,
  ])

  const handleCategorySelected = useCallback(
    (categoryId: string) => {
      const inCategory = servicesInCategory(form.services, categoryId)
      if (form.serviceIds.length > 0) {
        setStep(1)
        return
      }
      if (inCategory.length === 1) {
        form.setServiceIds([inCategory[0].id])
        setStep(SCHEDULE_STEP)
        return
      }
      setStep(1)
    },
    [form.services, form.serviceIds.length, form.setServiceIds],
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
    handleContinueWithServices,
    handleTimeSelected,
    handleStaffSelected,
  }
}
