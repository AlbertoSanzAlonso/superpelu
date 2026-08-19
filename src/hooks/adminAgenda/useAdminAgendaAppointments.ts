import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  appointmentToDraft,
  EMPTY_APPOINTMENT_DRAFT,
  type AppointmentDraft,
} from '@/components/agenda/staff/types'
import {
  ApiError,
  cancelAppointment,
  markAppointmentNoShow,
  fetchAdminAppointmentSeries,
  fetchAdminMultiSlots,
  fetchStaffAtSlotAdmin,
  fetchCustomerDetail,
  fetchStaffServicesForAdmin,
} from '@/lib/api'
import type {
  BookableService,
  DayScheduleAppointment,
  StaffDaySchedule,
} from '@/types/booking'
import type { AdminColumnSelection, EditingScheduleBaseline } from './types'
import type { ConfirmDialogState } from '@/components/ui/ConfirmDialog'
import type { AppointmentSeriesMeta, AppointmentSeriesMode } from '@/types/appointmentSeries'
import { useAdminAppointmentPersist } from './useAdminAppointmentPersist'

type AppointmentsDeps = {
  adminToken: string
  date: string
  schedules: StaffDaySchedule[]
  selection: AdminColumnSelection | null
  clearSelection: () => void
  setSelection: (value: AdminColumnSelection | null) => void
  load: (opts?: { silent?: boolean }) => Promise<StaffDaySchedule[] | null>
  setError: (message: string) => void
  setConfirmDialog: (dialog: ConfirmDialogState | null) => void
  resyncAppointmentSnapshots?: (options?: { notify?: boolean }) => Promise<void>
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
  resyncAppointmentSnapshots,
}: AppointmentsDeps) {
  const [activeStaffId, setActiveStaffId] = useState<string | null>(null)
  const [services, setServices] = useState<BookableService[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [slotsOverHours, setSlotsOverHours] = useState<string[]>([])
  const availabilityRequestId = useRef(0)
  const [serviceSlotsPerIndex, setServiceSlotsPerIndex] = useState<string[][]>([])
  const [serviceAlternativeStaff, setServiceAlternativeStaff] = useState<
    ({ id: string; name: string } | null)[]
  >([])
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
  const [cancelScopeOpen, setCancelScopeOpen] = useState(false)
  const [cancelScopeSeries, setCancelScopeSeries] = useState<AppointmentSeriesMeta | null>(null)
  const [cancelScopeGroupCount, setCancelScopeGroupCount] = useState<number>(0)
  const [cancelScopeGroupServices, setCancelScopeGroupServices] = useState<string[]>([])
  const [pendingCancelMode, setPendingCancelMode] = useState<AppointmentSeriesMode>('single')

  const scheduleForActiveStaff = schedules.find((s) => s.staffId === activeStaffId) ?? null

  useEffect(() => {
    if (!activeStaffId || !adminToken) {
      setServices([])
      return
    }
    fetchStaffServicesForAdmin(activeStaffId, adminToken)
      .then((r) => {
        setServices(r.services)
      })
      .catch(() => setServices([]))
  }, [activeStaffId, adminToken])

  /** Conserva en el picker los tratamientos del draft aunque el staff activo no los liste. */
  const servicesForPicker = useMemo(() => {
    const byId = new Map(services.map((s) => [s.id, s]))
    const allApts = schedules.flatMap((s) => s.appointments)
    for (const id of aptDraft.serviceIds) {
      if (!id || byId.has(id)) continue
      const fromSchedule = allApts.find((a) => a.serviceId === id)
      const fromView =
        viewingAppointment?.apt.serviceId === id ? viewingAppointment.apt : undefined
      const apt = fromSchedule ?? fromView
      if (!apt) continue
      byId.set(id, {
        id: apt.serviceId,
        nameEs: apt.serviceName,
        nameEn: apt.serviceName,
        durationMinutes: apt.durationMinutes,
        categoryId: apt.categoryId,
      })
    }
    return Array.from(byId.values())
  }, [services, aptDraft.serviceIds, schedules, viewingAppointment])

  useEffect(() => {
    const filteredIds = aptDraft.serviceIds.filter((s) => s !== '')
    const effectiveDate = (editingId && aptDraft.date) ? aptDraft.date : date
    if (!activeStaffId || filteredIds.length === 0 || !effectiveDate || !adminToken) {
      setSlots([])
      setSlotsOverHours([])
      return
    }

    const requestId = ++availabilityRequestId.current

    fetchAdminMultiSlots(
      effectiveDate,
      filteredIds,
      activeStaffId,
      adminToken,
      editingId ?? undefined,
      aptDraft.serviceDurations,
    )
      .then((r) => {
        if (requestId !== availabilityRequestId.current) return
        setSlots(r.slots)
        setSlotsOverHours(r.slotsOverHours)
      })
      .catch(() => {
        if (requestId !== availabilityRequestId.current) return
        setSlots([])
        setSlotsOverHours([])
      })
  }, [
    activeStaffId,
    aptDraft.serviceIds.join(','),
    aptDraft.serviceDurations.join(','),
    aptDraft.date,
    date,
    adminToken,
    editingId,
  ])

  // Slots disponibles por servicio individual (para tratamientos adicionales)
  useEffect(() => {
    const filteredIds = aptDraft.serviceIds.filter((s) => s !== '')
    const effectiveDate = (editingId && aptDraft.date) ? aptDraft.date : date
    if (!activeStaffId || filteredIds.length <= 1 || !effectiveDate || !adminToken) {
      setServiceSlotsPerIndex([])
      return
    }
    Promise.all(
      filteredIds.map((id, i) => {
        if (i === 0) return Promise.resolve([] as string[])
        const staffForService = aptDraft.staffAssignments[i] || activeStaffId
        const durationForService = [aptDraft.serviceDurations[i] ?? null]
        return fetchAdminMultiSlots(
          effectiveDate,
          [id],
          staffForService,
          adminToken,
          editingId ?? undefined,
          durationForService,
        )
          .then((r) => [...r.slots, ...r.slotsOverHours])
          .catch(() => [] as string[])
      }),
    ).then((results) => setServiceSlotsPerIndex(results))
  }, [
    activeStaffId,
    aptDraft.serviceIds.join(','),
    aptDraft.staffAssignments.join(','),
    aptDraft.serviceDurations.join(','),
    aptDraft.date,
    date,
    adminToken,
    editingId,
  ])

  // Profesionales alternativos cuando un tratamiento adicional tiene hora ocupada
  useEffect(() => {
    const filteredIds = aptDraft.serviceIds.filter((s) => s !== '')
    const effectiveDate = (editingId && aptDraft.date) ? aptDraft.date : date
    if (!activeStaffId || filteredIds.length <= 1 || !effectiveDate || !adminToken || serviceSlotsPerIndex.length === 0) {
      setServiceAlternativeStaff([])
      return
    }
    Promise.all(
      filteredIds.map(async (id, i) => {
        if (i === 0) return null
        const selectedTime = aptDraft.serviceStartTimes[i]
        if (!selectedTime) return null
        const freeForThis = serviceSlotsPerIndex[i] ?? []
        if (freeForThis.includes(selectedTime)) return null
        const assignedStaffId = aptDraft.staffAssignments[i] || activeStaffId
        return fetchStaffAtSlotAdmin(effectiveDate, id, selectedTime, adminToken)
          .then((r) => r.staff.filter((s) => s.id !== assignedStaffId)[0] ?? null)
          .catch(() => null)
      }),
    ).then((results) => setServiceAlternativeStaff(results))
  }, [
    activeStaffId,
    aptDraft.serviceIds.join(','),
    aptDraft.serviceStartTimes.join(','),
    aptDraft.staffAssignments.join(','),
    aptDraft.date,
    date,
    adminToken,
    serviceSlotsPerIndex,
  ])

  const resetAppointmentForm = useCallback(() => {
    setEditingId(null)
    setError('')
    setAptDraft({ ...EMPTY_APPOINTMENT_DRAFT })
  }, [setError])

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
    setError('')
    setAptDraft({ ...EMPTY_APPOINTMENT_DRAFT })
  }, [setError])

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

      // Si pertenece a un grupo multi-tratamiento, cargar todos los hermanos
      let siblings: DayScheduleAppointment[] | undefined
      if (apt.bookingGroupId) {
        const allApts = schedules.flatMap((s) => s.appointments)
        const groupApts = allApts.filter(
          (a) => a.bookingGroupId === apt.bookingGroupId && a.colorGroupRole !== 'wash',
        )
        if (groupApts.length > 1) {
          siblings = groupApts
        }
      }

      setAptDraft(appointmentToDraft(apt, undefined, siblings, date))
      setDetailCustomerRegistered(false)

      if (!adminToken || !apt.customerPhone) return
      fetchCustomerDetail(adminToken, apt.customerPhone)
        .then((detail) => {
          setDetailCustomerRegistered(true)
          setDetailReviewRequestSentAt(detail.customer.reviewRequestSentAt ?? null)
          setAptDraft((prev) => ({
            ...appointmentToDraft(
              apt,
              { email: detail.customer.email, notes: detail.customer.notes, locale: detail.customer.locale },
              siblings,
              date,
            ),
            notes: prev.notes,
            serviceIds: prev.serviceIds,
            serviceStartTimes: prev.serviceStartTimes,
            serviceDurations: prev.serviceDurations,
            staffAssignments: prev.staffAssignments,
            startTime: prev.startTime,
            date: prev.date,
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

  const syncDetailActiveStaff = useCallback(
    (nextStaffId: string) => {
      const staffName = schedules.find((s) => s.staffId === nextStaffId)?.staffName ?? ''
      setActiveStaffId(nextStaffId)
      setViewingAppointment((prev) => (prev ? { ...prev, staffId: nextStaffId, staffName } : null))
    },
    [schedules],
  )

  const changeDetailStaff = useCallback(
    (nextStaffId: string) => {
      const previousStaffId = activeStaffId
      syncDetailActiveStaff(nextStaffId)
      setAptDraft((d) => {
        const ids = d.serviceIds.filter((s) => s !== '')
        if (ids.length === 0) return d
        if (d.staffAssignments.length === d.serviceIds.length) {
          return {
            ...d,
            staffAssignments: d.staffAssignments.map((id) =>
              !id || id === previousStaffId ? nextStaffId : id,
            ),
          }
        }
        return {
          ...d,
          staffAssignments: d.serviceIds.map((serviceId) => (serviceId ? nextStaffId : '')),
        }
      })
    },
    [activeStaffId, syncDetailActiveStaff],
  )

  const createAppointmentFromSelection = useCallback(() => {
    if (!selection || selection.times.size !== 1) return
    const startTime = [...selection.times][0]
    if (!startTime) return
    openNewAppointment(selection.staffId, selection.staffName, startTime)
  }, [selection, openNewAppointment])

  const persist = useAdminAppointmentPersist({
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
  })

  const persistCancel = useCallback(
    async (notifyCustomerWhatsApp: boolean): Promise<boolean> => {
      if (!pendingCancelId || !adminToken) return false
      setError('')
      try {
        await cancelAppointment(pendingCancelId, adminToken, {
          notifyCustomerWhatsApp,
          mode: pendingCancelMode,
        })
        await resyncAppointmentSnapshots?.({ notify: true })
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
      pendingCancelMode,
      adminToken,
      closeAppointmentDetail,
      resetAppointmentForm,
      load,
      setError,
      resyncAppointmentSnapshots,
    ],
  )

  const closeWhatsAppNotifyDialog = useCallback(() => {
    if (whatsAppNotifyBusy) return
    setWhatsAppNotifyDialogOpen(false)
    setPendingCancelId(null)
  }, [whatsAppNotifyBusy])

  const closeCancelScopeModal = useCallback(() => {
    setCancelScopeOpen(false)
    setCancelScopeSeries(null)
    setCancelScopeGroupCount(0)
    setCancelScopeGroupServices([])
    setPendingCancelId(null)
  }, [])

  const confirmCancelScope = useCallback(
    (mode: AppointmentSeriesMode) => {
      setPendingCancelMode(mode)
      setCancelScopeOpen(false)
      setWhatsAppNotifyContext('cancel')
      setWhatsAppNotifyDialogOpen(true)
    },
    [],
  )

  const cancelAppointmentById = useCallback(
    (id: string) => {
      void (async () => {
        const apt =
          viewingAppointment?.apt.id === id
            ? viewingAppointment.apt
            : schedules.flatMap((s) => s.appointments).find((a) => a.id === id)

        // Detectar si pertenece a una visita multi-tratamiento
        if (apt?.bookingGroupId) {
          const siblingsInGroup = schedules
            .flatMap((s) => s.appointments)
            .filter(
              (a) =>
                a.bookingGroupId === apt.bookingGroupId &&
                a.status === 'confirmed' &&
                a.colorGroupRole !== 'wash',
            )
          if (siblingsInGroup.length > 1) {
            const groupServices = siblingsInGroup.map((a) => a.serviceName ?? '').filter(Boolean)
            setPendingCancelId(id)
            setCancelScopeGroupCount(siblingsInGroup.length)
            setCancelScopeGroupServices(groupServices)
            // Si además tiene serie, cargar también la serie
            if (apt.seriesId && adminToken) {
              try {
                const series = await fetchAdminAppointmentSeries(adminToken, id)
                if (series.count > 1) setCancelScopeSeries(series)
              } catch { /* continuar sin serie */ }
            }
            setCancelScopeOpen(true)
            return
          }
        }

        if (apt?.seriesId && adminToken) {
          try {
            const series = await fetchAdminAppointmentSeries(adminToken, id)
            if (series.count > 1) {
              setPendingCancelId(id)
              setCancelScopeSeries(series)
              setCancelScopeOpen(true)
              return
            }
          } catch {
            /* continuar */
          }
        }

        setPendingCancelMode('single')
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
      })()
    },
    [viewingAppointment, schedules, adminToken, setConfirmDialog],
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
    setCancelScopeOpen(false)
    setCancelScopeSeries(null)
    setCancelScopeGroupCount(0)
    setCancelScopeGroupServices([])
  }, [])

  return {
    activeStaffId,
    scheduleForActiveStaff,
    services: servicesForPicker,
    slots,
    slotsOverHours,
    serviceSlotsPerIndex,
    serviceAlternativeStaff,
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
    syncDetailActiveStaff,
    createAppointmentFromSelection,
    persistAppointment: persist.persistAppointment,
    saveAppointment: persist.saveAppointment,
    isSubmitting: persist.isSubmitting,
    foreignPhoneLocalePromptOpen: persist.foreignPhoneLocalePromptOpen,
    acceptForeignPhoneLocale: persist.acceptForeignPhoneLocale,
    declineForeignPhoneLocale: persist.declineForeignPhoneLocale,
    closeForeignPhoneLocalePrompt: persist.closeForeignPhoneLocalePrompt,
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
    cancelScopeOpen,
    cancelScopeSeries,
    cancelScopeGroupCount,
    cancelScopeGroupServices,
    closeCancelScopeModal,
    confirmCancelScope,
    seriesConflictOpen: persist.seriesConflictOpen,
    seriesConflictPreview: persist.seriesConflictPreview,
    seriesConflictBusy: persist.seriesConflictBusy,
    closeSeriesConflictModal: persist.closeSeriesConflictModal,
    resolveSeriesConflicts: persist.resolveSeriesConflicts,
  }
}
