import { useCallback, useRef, useState } from 'react'
import {
  ApiError,
  createAdminAppointment,
  previewSeriesConflicts,
  updateAdminAppointment,
} from '@/lib/api'
import type { AppointmentDraft } from '@/components/agenda/staff/types'
import type { StaffDaySchedule } from '@/types/booking'
import type {
  SeriesPreviewResult,
  SeriesConflictResolution,
} from '@/lib/api'
import type { Locale } from '@/i18n/types'
import { shouldAskForeignPhoneLocale } from '@/hooks/useForeignPhoneLocalePrompt'
import type { EditingScheduleBaseline } from './types'
import { appointmentScheduleChanged } from './types'

type PersistDeps = {
  adminToken: string
  date: string
  activeStaffId: string | null
  aptDraft: AppointmentDraft
  editingId: string | null
  editingScheduleBaseline: EditingScheduleBaseline | null
  closeAppointmentDetail: () => void
  resetAppointmentForm: () => void
  clearSelection: () => void
  load: () => Promise<StaffDaySchedule[] | null>
  setError: (message: string) => void
  setWhatsAppNotifyDialogOpen: (open: boolean) => void
  setWhatsAppNotifyContext: (context: 'edit' | 'move' | 'cancel') => void
  setAppointmentFormOpen: (open: boolean) => void
  resyncAppointmentSnapshots?: (options?: { notify?: boolean }) => Promise<void>
}

export function useAdminAppointmentPersist({
  adminToken,
  date,
  activeStaffId,
  aptDraft,
  editingId,
  editingScheduleBaseline,
  closeAppointmentDetail,
  resetAppointmentForm,
  clearSelection,
  load,
  setError,
  setWhatsAppNotifyDialogOpen,
  setWhatsAppNotifyContext,
  setAppointmentFormOpen,
  resyncAppointmentSnapshots,
}: PersistDeps) {
  const [seriesConflictOpen, setSeriesConflictOpen] = useState(false)
  const [seriesConflictPreview, setSeriesConflictPreview] = useState<SeriesPreviewResult | null>(null)
  const [seriesConflictBusy, setSeriesConflictBusy] = useState(false)
  const [foreignPhoneLocalePromptOpen, setForeignPhoneLocalePromptOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const createLocaleRef = useRef<Locale>(aptDraft.customerLocale)

  function buildAlignedServiceFields(filteredServiceIds: string[]) {
    const keptIndexes = aptDraft.serviceIds
      .map((id, index) => (id !== '' ? index : -1))
      .filter((index) => index >= 0)
    const staffAssignments =
      aptDraft.staffAssignments.length === aptDraft.serviceIds.length
        ? keptIndexes.map((index) => aptDraft.staffAssignments[index] || activeStaffId!)
        : filteredServiceIds.map(() => activeStaffId!)
    const serviceDurations =
      aptDraft.serviceDurations.length === aptDraft.serviceIds.length
        ? keptIndexes.map((index) => aptDraft.serviceDurations[index] ?? null)
        : aptDraft.serviceDurations.length === filteredServiceIds.length
          ? aptDraft.serviceDurations
          : undefined
    const rawStartTimes =
      aptDraft.serviceStartTimes.length === aptDraft.serviceIds.length
        ? keptIndexes.map((index) => aptDraft.serviceStartTimes[index] ?? '')
        : aptDraft.serviceStartTimes.length === filteredServiceIds.length
          ? aptDraft.serviceStartTimes
          : []
    const serviceStartTimes =
      rawStartTimes.length === filteredServiceIds.length && rawStartTimes.some((t) => t !== '')
        ? rawStartTimes.map((t, i) => (i === 0 && !t ? aptDraft.startTime : t))
        : undefined
    const visitStartTime =
      serviceStartTimes?.[0] || aptDraft.startTime
    return { staffAssignments, serviceDurations, serviceStartTimes, visitStartTime }
  }

  const doPersistAppointment = useCallback(
    async (
      notifyCustomerWhatsApp?: boolean,
      customerLocaleOverride?: Locale,
    ): Promise<boolean> => {
      if (!activeStaffId || !adminToken) return false
      if (isSubmitting) return false
      setIsSubmitting(true)
      const customerLocale = customerLocaleOverride ?? aptDraft.customerLocale
      createLocaleRef.current = customerLocale
      setError('')
      try {
        const filteredServiceIds = aptDraft.serviceIds.filter((s) => s !== '')
        const { staffAssignments, serviceDurations, serviceStartTimes, visitStartTime } =
          buildAlignedServiceFields(filteredServiceIds)
        if (editingId) {
          await updateAdminAppointment(editingId, adminToken, {
            staffId: activeStaffId,
            staffAssignments,
            serviceIds: filteredServiceIds,
            serviceStartTimes,
            serviceDurations,
            serviceId: filteredServiceIds[0] || '',
            date,
            startTime: visitStartTime,
            customerFirstName: aptDraft.customerFirstName,
            customerLastName: aptDraft.customerLastName,
            customerPhone: aptDraft.customerPhone,
            customerEmail: aptDraft.customerEmail || undefined,
            customerNotes: aptDraft.customerNotes || undefined,
            notes: aptDraft.notes || undefined,
            customerLocale,
            notifyCustomerWhatsApp,
            forceSchedule: true,
          })
          await resyncAppointmentSnapshots?.({ notify: true })
        } else {
          const isMultiTreatmentSeries =
            filteredServiceIds.length > 1 && aptDraft.recurrenceScope === 'weekly'

          if (isMultiTreatmentSeries) {
            const preview = await previewSeriesConflicts(
              {
                staffId: activeStaffId,
                serviceIds: filteredServiceIds,
                serviceStartTimes,
                serviceDurations,
                date,
                startTime: visitStartTime,
                customerFirstName: aptDraft.customerFirstName,
                customerLastName: aptDraft.customerLastName,
                customerPhone: aptDraft.customerPhone,
                customerEmail: aptDraft.customerEmail || undefined,
                customerNotes: aptDraft.customerNotes || undefined,
                notes: aptDraft.notes || undefined,
                customerLocale,
                scope: 'weekly',
                endDate: aptDraft.recurrenceEndDate || undefined,
              },
              adminToken,
            )

            if (preview.conflicts.length > 0) {
              setSeriesConflictPreview(preview)
              setSeriesConflictOpen(true)
              return false
            }
          }

          await createAdminAppointment(
            {
              staffId: activeStaffId,
              staffAssignments,
              serviceIds: filteredServiceIds,
              serviceStartTimes,
              serviceDurations,
              date,
              startTime: visitStartTime,
              customerFirstName: aptDraft.customerFirstName,
              customerLastName: aptDraft.customerLastName,
              customerPhone: aptDraft.customerPhone,
              customerEmail: aptDraft.customerEmail || undefined,
              customerNotes: aptDraft.customerNotes || undefined,
              notes: aptDraft.notes || undefined,
              customerLocale,
              scope: aptDraft.recurrenceScope === 'weekly' ? 'weekly' : undefined,
              endDate:
                aptDraft.recurrenceScope === 'weekly' && aptDraft.recurrenceEndDate
                  ? aptDraft.recurrenceEndDate
                  : undefined,
              forceSchedule: true,
            },
            adminToken,
          )
          await resyncAppointmentSnapshots?.({ notify: true })
        }
        setWhatsAppNotifyDialogOpen(false)
        setAppointmentFormOpen(false)
        closeAppointmentDetail()
        resetAppointmentForm()
        clearSelection()
        await load()
        return true
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar la cita')
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      activeStaffId,
      adminToken,
      editingId,
      isSubmitting,
      aptDraft,
      date,
      resetAppointmentForm,
      closeAppointmentDetail,
      clearSelection,
      load,
      setError,
      resyncAppointmentSnapshots,
      setWhatsAppNotifyDialogOpen,
      setAppointmentFormOpen,
    ],
  )

  const persistAppointment = useCallback(
    async (notifyCustomerWhatsApp?: boolean): Promise<boolean> => {
      return doPersistAppointment(notifyCustomerWhatsApp)
    },
    [doPersistAppointment],
  )

  const saveAppointment = useCallback(
    async (e: React.FormEvent): Promise<boolean> => {
      e.preventDefault()
      if (!activeStaffId || !adminToken) return false
      if (editingId) {
        const scheduleChanged =
          editingScheduleBaseline !== null &&
          appointmentScheduleChanged(editingScheduleBaseline, {
            staffId: activeStaffId,
            date,
            startTime: aptDraft.startTime,
          })
        if (scheduleChanged) {
          setWhatsAppNotifyContext('edit')
          setWhatsAppNotifyDialogOpen(true)
          return false
        }
        return persistAppointment()
      }
      if (shouldAskForeignPhoneLocale(aptDraft.customerPhone, aptDraft.customerLocale)) {
        setForeignPhoneLocalePromptOpen(true)
        return false
      }
      return persistAppointment()
    },
    [
      activeStaffId,
      adminToken,
      editingId,
      editingScheduleBaseline,
      date,
      aptDraft.startTime,
      aptDraft.customerPhone,
      aptDraft.customerLocale,
      persistAppointment,
      setWhatsAppNotifyDialogOpen,
      setWhatsAppNotifyContext,
    ],
  )

  const acceptForeignPhoneLocale = useCallback(async () => {
    setForeignPhoneLocalePromptOpen(false)
    await doPersistAppointment(undefined, 'en')
  }, [doPersistAppointment])

  const declineForeignPhoneLocale = useCallback(async () => {
    setForeignPhoneLocalePromptOpen(false)
    await doPersistAppointment(undefined, 'es')
  }, [doPersistAppointment])

  const closeForeignPhoneLocalePrompt = useCallback(() => {
    setForeignPhoneLocalePromptOpen(false)
  }, [])

  const closeSeriesConflictModal = useCallback(() => {
    if (seriesConflictBusy) return
    setSeriesConflictOpen(false)
    setSeriesConflictPreview(null)
  }, [seriesConflictBusy])

  const resolveSeriesConflicts = useCallback(
    async (resolutions: SeriesConflictResolution[]): Promise<boolean> => {
      if (!activeStaffId || !adminToken) return false
      setError('')
      setSeriesConflictBusy(true)
      try {
        const filteredServiceIds = aptDraft.serviceIds.filter((s) => s !== '')
        await createAdminAppointment(
          {
            staffId: activeStaffId,
            serviceIds: filteredServiceIds,
            serviceStartTimes: aptDraft.serviceStartTimes,
            serviceDurations: aptDraft.serviceDurations,
            date,
            startTime: aptDraft.startTime,
            customerFirstName: aptDraft.customerFirstName,
            customerLastName: aptDraft.customerLastName,
            customerPhone: aptDraft.customerPhone,
            customerEmail: aptDraft.customerEmail || undefined,
            customerNotes: aptDraft.customerNotes || undefined,
            notes: aptDraft.notes || undefined,
            customerLocale: createLocaleRef.current,
            scope: 'weekly',
            endDate: aptDraft.recurrenceEndDate || undefined,
            forceSchedule: true,
            conflictResolutions: resolutions,
          },
          adminToken,
        )
        await resyncAppointmentSnapshots?.({ notify: true })
        setSeriesConflictOpen(false)
        setSeriesConflictPreview(null)
        setWhatsAppNotifyDialogOpen(false)
        setAppointmentFormOpen(false)
        closeAppointmentDetail()
        resetAppointmentForm()
        clearSelection()
        await load()
        return true
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo crear la serie')
        return false
      } finally {
        setSeriesConflictBusy(false)
      }
    },
    [
      activeStaffId,
      adminToken,
      aptDraft,
      date,
      resetAppointmentForm,
      closeAppointmentDetail,
      clearSelection,
      load,
      setError,
      resyncAppointmentSnapshots,
      setWhatsAppNotifyDialogOpen,
      setAppointmentFormOpen,
    ],
  )

  return {
    persistAppointment,
    saveAppointment,
    isSubmitting,
    foreignPhoneLocalePromptOpen,
    acceptForeignPhoneLocale,
    declineForeignPhoneLocale,
    closeForeignPhoneLocalePrompt,
    seriesConflictOpen,
    seriesConflictPreview,
    seriesConflictBusy,
    closeSeriesConflictModal,
    resolveSeriesConflicts,
  }
}
