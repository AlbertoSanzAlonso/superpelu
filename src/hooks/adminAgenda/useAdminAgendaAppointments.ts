import { useCallback, useEffect, useState } from 'react'
import {
  appointmentToDraft,
  EMPTY_APPOINTMENT_DRAFT,
  type AppointmentDraft,
} from '@/components/agenda/staff/types'
import {
  ApiError,
  cancelAppointment,
  markAppointmentNoShow,
  createAdminAppointment,
  fetchAdminSlots,
  fetchCustomerDetail,
  fetchStaffServicesForAdmin,
  updateAdminAppointment,
} from '@/lib/api'
import {
  singleFreeTimeFromGridSummary,
  summarizeStaffColumnGridSelection,
} from '@/lib/agendaGridSelection'
import type {
  BookableService,
  DayScheduleAppointment,
  StaffDaySchedule,
} from '@/types/booking'
import type { AdminColumnSelection } from './types'
import type { ConfirmDialogState } from '@/components/ui/ConfirmDialog'

type EditingScheduleBaseline = {
  staffId: string
  appointmentDate: string
  startTime: string
}

function appointmentScheduleChanged(
  baseline: EditingScheduleBaseline,
  current: { staffId: string; date: string; startTime: string },
): boolean {
  return (
    baseline.appointmentDate !== current.date ||
    baseline.startTime !== current.startTime ||
    baseline.staffId !== current.staffId
  )
}

type AppointmentsDeps = {
  adminToken: string
  date: string
  schedules: StaffDaySchedule[]
  selection: AdminColumnSelection | null
  clearSelection: () => void
  setSelection: (value: AdminColumnSelection | null) => void
  load: () => Promise<void>
  setError: (message: string) => void
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void
  markAppointmentsKnown?: (ids: Iterable<string>) => void
}

export function useAdminAgendaAppointments({
  adminToken,
  date,
  schedules,
  selection,
  clearSelection,
  setSelection,
  load,
  setError,
  setConfirmDialog,
  markAppointmentsKnown,
}: AppointmentsDeps) {
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null)
  const [services, setServices] = useState<BookableService[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [aptDraft, setAptDraft] = useState<AppointmentDraft>({ ...EMPTY_APPOINTMENT_DRAFT })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false)
  const [viewingAppointment, setViewingAppointment] = useState<{
    staffId: string
    staffName: string
    apt: DayScheduleAppointment
  } | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [detailCustomerRegistered, setDetailCustomerRegistered] = useState(false)
  const [detailReviewRequestSentAt, setDetailReviewRequestSentAt] = useState<string | null>(null)
  const [editingScheduleBaseline, setEditingScheduleBaseline] =
    useState<EditingScheduleBaseline | null>(null)

  const [whatsAppNotifyDialogOpen, setWhatsAppNotifyDialogOpen] = useState(false)
  const [whatsAppNotifyBusy, setWhatsAppNotifyBusy] = useState(false)
  const [whatsAppNotifyContext, setWhatsAppNotifyContext] = useState<'edit' | 'move' | 'cancel'>(
    'edit',
  )
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false)
  const [noShowBusy, setNoShowBusy] = useState(false)
  const [pendingNoShowId, setPendingNoShowId] = useState<string | null>(null)

  const scheduleForActiveStaff = schedules.find((s) => s.staffId === activeStaffId) ?? null

  useEffect(() => {
    if (!activeStaffId || !adminToken) {
      setServices([])
      return
    }
    fetchStaffServicesForAdmin(activeStaffId, adminToken)
      .then((r) => {
        setServices(r.services)
        setAptDraft((prev) => ({
          ...prev,
          serviceId: prev.serviceId || '',
        }))
      })
      .catch(() => setServices([]))
  }, [activeStaffId, adminToken])

  useEffect(() => {
    if (!activeStaffId || !aptDraft.serviceId || !date || !adminToken) {
      setSlots([])
      return
    }
    fetchAdminSlots(date, aptDraft.serviceId, activeStaffId, adminToken, editingId ?? undefined)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
  }, [activeStaffId, aptDraft.serviceId, date, adminToken, editingId])

  const resetAppointmentForm = useCallback(() => {
    setEditingId(null)
    setAptDraft({ ...EMPTY_APPOINTMENT_DRAFT })
  }, [])

  const selectStaff = useCallback((staffId: string) => {
    setActiveStaffId(staffId)
  }, [])

  const openNewAppointment = useCallback(
    (staffId: string, _staffName: string, time?: string) => {
      setActiveStaffId(staffId)
      setSelection(null)
      setEditingId(null)
      setAptDraft({
        ...EMPTY_APPOINTMENT_DRAFT,
        startTime: time ?? '',
      })
      setAppointmentFormOpen(true)
    },
    [setSelection],
  )

  const openNewAppointmentForActiveStaff = useCallback(() => {
    if (!activeStaffId) return
    openNewAppointment(activeStaffId, '')
  }, [activeStaffId, openNewAppointment])

  const closeAppointmentDetail = useCallback(() => {
    setViewingAppointment(null)
    setDetailEditMode(false)
    setEditingId(null)
    setEditingScheduleBaseline(null)
    setDetailCustomerRegistered(false)
    setDetailReviewRequestSentAt(null)
    setAptDraft({ ...EMPTY_APPOINTMENT_DRAFT })
  }, [])

  const openAppointmentDetail = useCallback(
    (staffId: string, apt: DayScheduleAppointment) => {
      const staffName = schedules.find((s) => s.staffId === staffId)?.staffName ?? ''
      setActiveStaffId(staffId)
      setSelection(null)
      setEditingId(apt.id)
      setEditingScheduleBaseline({
        staffId,
        appointmentDate: date,
        startTime: apt.startTime,
      })
      setDetailEditMode(false)
      setViewingAppointment({ staffId, staffName, apt })
      setAptDraft(appointmentToDraft(apt))
      setDetailCustomerRegistered(false)

      if (!adminToken || !apt.customerPhone) return
      fetchCustomerDetail(adminToken, apt.customerPhone)
        .then((detail) => {
          setDetailCustomerRegistered(true)
          setDetailReviewRequestSentAt(detail.customer.reviewRequestSentAt ?? null)
          setAptDraft((prev) => ({
            ...appointmentToDraft(apt, {
              email: detail.customer.email,
              notes: detail.customer.notes,
              locale: detail.customer.locale,
            }),
            notes: prev.notes,
          }))
        })
        .catch(() => {
          setDetailCustomerRegistered(false)
          setDetailReviewRequestSentAt(null)
        })
    },
    [adminToken, schedules, setSelection],
  )

  const startDetailEdit = useCallback(() => {
    setDetailEditMode(true)
  }, [])

  const changeDetailStaff = useCallback(
    (staffId: string) => {
      const staffName = schedules.find((s) => s.staffId === staffId)?.staffName ?? ''
      setActiveStaffId(staffId)
      setViewingAppointment((prev) => (prev ? { ...prev, staffId, staffName } : null))
    },
    [schedules],
  )

  useEffect(() => {
    if (!detailEditMode || !viewingAppointment || services.length === 0) return
    if (aptDraft.serviceId && !services.some((s) => s.id === aptDraft.serviceId)) {
      setAptDraft((d) => ({ ...d, serviceId: '', startTime: '' }))
    }
  }, [services, aptDraft.serviceId, detailEditMode, viewingAppointment])

  const createAppointmentFromSelection = useCallback(() => {
    if (!selection) return
    const summary = summarizeStaffColumnGridSelection(
      schedules,
      selection.staffId,
      date,
      selection.times,
    )
    const startTime = singleFreeTimeFromGridSummary(summary)
    if (!startTime) return
    openNewAppointment(selection.staffId, selection.staffName, startTime)
  }, [selection, schedules, date, openNewAppointment])

  const persistAppointment = useCallback(
    async (notifyCustomerWhatsApp?: boolean): Promise<boolean> => {
      if (!activeStaffId || !adminToken) return false
      setError('')
      try {
        if (editingId) {
          const { appointment } = await updateAdminAppointment(editingId, adminToken, {
            staffId: activeStaffId,
            serviceId: aptDraft.serviceId,
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
          })
          markAppointmentsKnown?.([appointment.id])
        } else {
          const { appointment } = await createAdminAppointment(
            {
              staffId: activeStaffId,
              serviceId: aptDraft.serviceId,
              date,
              startTime: aptDraft.startTime,
              customerFirstName: aptDraft.customerFirstName,
              customerLastName: aptDraft.customerLastName,
              customerPhone: aptDraft.customerPhone,
              customerEmail: aptDraft.customerEmail || undefined,
              customerNotes: aptDraft.customerNotes || undefined,
              notes: aptDraft.notes || undefined,
              customerLocale: aptDraft.customerLocale,
            },
            adminToken,
          )
          markAppointmentsKnown?.([appointment.id])
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
      }
    },
    [
      activeStaffId,
      adminToken,
      editingId,
      aptDraft,
      date,
      resetAppointmentForm,
      closeAppointmentDetail,
      clearSelection,
      load,
      setError,
      markAppointmentsKnown,
    ],
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
    ],
  )

  const closeWhatsAppNotifyDialog = useCallback(() => {
    if (whatsAppNotifyBusy) return
    setWhatsAppNotifyDialogOpen(false)
    setPendingCancelId(null)
  }, [whatsAppNotifyBusy])

  const persistCancel = useCallback(
    async (notifyCustomerWhatsApp: boolean): Promise<boolean> => {
      if (!pendingCancelId || !adminToken) return false
      setError('')
      try {
        await cancelAppointment(pendingCancelId, adminToken, { notifyCustomerWhatsApp })
        setWhatsAppNotifyDialogOpen(false)
        setPendingCancelId(null)
        setAppointmentFormOpen(false)
        closeAppointmentDetail()
        resetAppointmentForm()
        await load()
        return true
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cancelar la cita')
        return false
      }
    },
    [
      pendingCancelId,
      adminToken,
      closeAppointmentDetail,
      resetAppointmentForm,
      load,
      setError,
    ],
  )

  const cancelAppointmentById = useCallback(
    (id: string) => {
      setConfirmDialog({
        title: '¿Cancelar esta cita?',
        message:
          'La cita quedará cancelada. El salón recibirá un aviso por email. Si era mañana, no se enviará el recordatorio automático al cliente.',
        confirmLabel: 'Continuar',
        destructive: true,
        onConfirm: async () => {
          setPendingCancelId(id)
          setWhatsAppNotifyContext('cancel')
          setWhatsAppNotifyDialogOpen(true)
        },
      })
    },
    [setConfirmDialog],
  )

  const closeNoShowDialog = useCallback(() => {
    if (noShowBusy) return
    setNoShowDialogOpen(false)
    setPendingNoShowId(null)
  }, [noShowBusy])

  const persistNoShow = useCallback(
    async (sendWhatsApp: boolean): Promise<boolean> => {
      if (!pendingNoShowId || !adminToken) return false
      setError('')
      try {
        await markAppointmentNoShow(pendingNoShowId, adminToken, { sendWhatsApp })
        setNoShowDialogOpen(false)
        setPendingNoShowId(null)
        closeAppointmentDetail()
        resetAppointmentForm()
        await load()
        return true
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo registrar la inasistencia')
        return false
      }
    },
    [
      pendingNoShowId,
      adminToken,
      closeAppointmentDetail,
      resetAppointmentForm,
      load,
      setError,
    ],
  )

  const markNoShowById = useCallback((id: string) => {
    setPendingNoShowId(id)
    setNoShowDialogOpen(true)
  }, [])

  const resetAppointmentUi = useCallback(() => {
    setActiveStaffId(null)
    setAppointmentFormOpen(false)
    setEditingId(null)
    setViewingAppointment(null)
    setDetailEditMode(false)
    setDetailCustomerRegistered(false)
    setAptDraft({ ...EMPTY_APPOINTMENT_DRAFT })
    setWhatsAppNotifyDialogOpen(false)
    setPendingCancelId(null)
    setNoShowDialogOpen(false)
    setPendingNoShowId(null)
  }, [])

  return {
    activeStaffId,
    scheduleForActiveStaff,
    services,
    slots,
    aptDraft,
    setAptDraft,
    editingId,
    appointmentFormOpen,
    setAppointmentFormOpen,
    resetAppointmentForm,
    selectStaff,
    openNewAppointment,
    openNewAppointmentForActiveStaff,
    viewingAppointment,
    detailEditMode,
    setDetailEditMode,
    detailCustomerRegistered,
    setDetailCustomerRegistered,
    detailReviewRequestSentAt,
    setDetailReviewRequestSentAt,
    openAppointmentDetail,
    closeAppointmentDetail,
    startDetailEdit,
    changeDetailStaff,
    createAppointmentFromSelection,
    persistAppointment,
    saveAppointment,
    whatsAppNotifyDialogOpen,
    setWhatsAppNotifyDialogOpen,
    whatsAppNotifyBusy,
    setWhatsAppNotifyBusy,
    whatsAppNotifyContext,
    setWhatsAppNotifyContext,
    closeWhatsAppNotifyDialog,
    persistCancel,
    cancelAppointmentById,
    noShowDialogOpen,
    noShowBusy,
    setNoShowBusy,
    closeNoShowDialog,
    persistNoShow,
    markNoShowById,
    resetAppointmentUi,
    formSlotTime:
      appointmentFormOpen && !editingId && activeStaffId ? aptDraft.startTime || null : null,
    formStaffId: appointmentFormOpen && !editingId ? activeStaffId : null,
  }
}
