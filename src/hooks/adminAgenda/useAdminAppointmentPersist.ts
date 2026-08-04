import { useCallback, useState } from 'react'
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
import type { EditingScheduleBaseline } from './types'
import { appointmentScheduleChanged } from './types'
import type { ConfirmDialogState } from '@/components/ui/ConfirmDialog'

type PersistDeps = {
  adminToken: string
  date: string
  activeStaffId: string | null
  aptDraft: AppointmentDraft
  editingId: string | null
  editingScheduleBaseline: EditingScheduleBaseline | null
  forceSchedule?: boolean
  closeAppointmentDetail: () => void
  resetAppointmentForm: () => void
  clearSelection: () => void
  load: () => Promise<StaffDaySchedule[] | null>
  setError: (message: string) => void
  setWhatsAppNotifyDialogOpen: (open: boolean) => void
  setWhatsAppNotifyContext: (context: 'edit' | 'move' | 'cancel') => void
  setAppointmentFormOpen: (open: boolean) => void
  markAppointmentSnapshots?: (appointments: Iterable<import('@/types/booking').Appointment>) => void
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void
}

export function useAdminAppointmentPersist({
  adminToken,
  date,
  activeStaffId,
  aptDraft,
  editingId,
  editingScheduleBaseline,
  forceSchedule = false,
  closeAppointmentDetail,
  resetAppointmentForm,
  clearSelection,
  load,
  setError,
  setWhatsAppNotifyDialogOpen,
  setWhatsAppNotifyContext,
  setAppointmentFormOpen,
  markAppointmentSnapshots,
  setConfirmDialog,
}: PersistDeps) {
  const [seriesConflictOpen, setSeriesConflictOpen] = useState(false)
  const [seriesConflictPreview, setSeriesConflictPreview] = useState<SeriesPreviewResult | null>(null)
  const [seriesConflictBusy, setSeriesConflictBusy] = useState(false)

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
    return { staffAssignments, serviceDurations, serviceStartTimes }
  }

  const doPersistAppointment = useCallback(
    async (notifyCustomerWhatsApp?: boolean, forceScheduleOverride = false): Promise<boolean> => {
      if (!activeStaffId || !adminToken) return false
      const allowForcedSchedule = forceScheduleOverride || forceSchedule
      setError('')
      try {
        const filteredServiceIds = aptDraft.serviceIds.filter((s) => s !== '')
        const { staffAssignments, serviceDurations, serviceStartTimes } =
          buildAlignedServiceFields(filteredServiceIds)
        if (editingId) {
          const { appointment } = await updateAdminAppointment(editingId, adminToken, {
            staffId: activeStaffId,
            staffAssignments,
            serviceIds: filteredServiceIds,
            serviceStartTimes,
            serviceDurations,
            serviceId: filteredServiceIds[0] || '',
            date,
            startTime: aptDraft.startTime,
            customerFirstName: aptDraft.customerFirstName,
            customerLastName: aptDraft.customerLastName,
            customerPhone: aptDraft.customerPhone,
            customerEmail: aptDraft.customerEmail || undefined,
            customerNotes: aptDraft.customerNotes || undefined,
            notes: aptDraft.notes || undefined,
            customerLocale: aptDraft.customerLocale,
            notifyCustomerWhatsApp,
            forceSchedule: true,
          })
          markAppointmentSnapshots?.([appointment])
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
                startTime: aptDraft.startTime,
                customerFirstName: aptDraft.customerFirstName,
                customerLastName: aptDraft.customerLastName,
                customerPhone: aptDraft.customerPhone,
                customerEmail: aptDraft.customerEmail || undefined,
                customerNotes: aptDraft.customerNotes || undefined,
                notes: aptDraft.notes || undefined,
                customerLocale: aptDraft.customerLocale,
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

          const { appointment } = await createAdminAppointment(
            {
              staffId: activeStaffId,
              staffAssignments,
              serviceIds: filteredServiceIds,
              serviceStartTimes,
              serviceDurations,
              date,
              startTime: aptDraft.startTime,
              customerFirstName: aptDraft.customerFirstName,
              customerLastName: aptDraft.customerLastName,
              customerPhone: aptDraft.customerPhone,
              customerEmail: aptDraft.customerEmail || undefined,
              customerNotes: aptDraft.customerNotes || undefined,
              notes: aptDraft.notes || undefined,
              customerLocale: aptDraft.customerLocale,
              scope: aptDraft.recurrenceScope === 'weekly' ? 'weekly' : undefined,
              endDate:
                aptDraft.recurrenceScope === 'weekly' && aptDraft.recurrenceEndDate
                  ? aptDraft.recurrenceEndDate
                  : undefined,
              forceSchedule: allowForcedSchedule,
            },
            adminToken,
          )
          markAppointmentSnapshots?.([appointment])
        }
        setWhatsAppNotifyDialogOpen(false)
        setAppointmentFormOpen(false)
        closeAppointmentDetail()
        resetAppointmentForm()
        clearSelection()
        await load()
        return true
      } catch (err) {
        if (
          !allowForcedSchedule &&
          err instanceof ApiError &&
          /horario no disponible|no está disponible/i.test(err.message)
        ) {
          setConfirmDialog({
            title: 'El horario no está disponible',
            message:
              'Ese horario está ocupado o fuera del horario laboral. ¿Quieres agendarla de todas formas?',
            confirmLabel: 'Agendar de todas formas',
            destructive: false,
            onConfirm: async () => {
              setConfirmDialog(null)
              await doPersistAppointment(notifyCustomerWhatsApp, true)
            },
          })
          return false
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar la cita')
        return false
      }
    },
    [
      activeStaffId,
      adminToken,
      editingId,
      aptDraft,
      date,
      forceSchedule,
      resetAppointmentForm,
      closeAppointmentDetail,
      clearSelection,
      load,
      setError,
      markAppointmentSnapshots,
      setWhatsAppNotifyDialogOpen,
      setAppointmentFormOpen,
      setConfirmDialog,
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
      return persistAppointment()
    },
    [
      activeStaffId,
      adminToken,
      editingId,
      editingScheduleBaseline,
      date,
      aptDraft.startTime,
      persistAppointment,
      setWhatsAppNotifyDialogOpen,
      setWhatsAppNotifyContext,
    ],
  )

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
          const { appointment } = await createAdminAppointment(
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
              customerLocale: aptDraft.customerLocale,
              scope: 'weekly',
              endDate: aptDraft.recurrenceEndDate || undefined,
              conflictResolutions: resolutions,
            },
            adminToken,
          )
        markAppointmentSnapshots?.([appointment])
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
      markAppointmentSnapshots,
      setWhatsAppNotifyDialogOpen,
      setAppointmentFormOpen,
    ],
  )

  return {
    persistAppointment,
    saveAppointment,
    seriesConflictOpen,
    seriesConflictPreview,
    seriesConflictBusy,
    closeSeriesConflictModal,
    resolveSeriesConflicts,
  }
}
