import { useCallback, useEffect, useState } from 'react'
import type { ConfirmDialogState } from '@/components/ui/ConfirmDialog'
import {
  appointmentToDraft,
  EMPTY_APPOINTMENT_DRAFT,
  type AppointmentDraft,
} from '@/components/agenda/staff/types'
import {
  ApiError,
  cancelAppointment,
  createAdminAppointment,
  createAdminBlock,
  deleteAdminBlock,
  fetchAdminBlockSeries,
  updateAdminBlock,
  fetchAdminSlots,
  fetchDaySchedule,
  fetchCustomerDetail,
  fetchStaffServicesForAdmin,
  updateAdminAppointment,
} from '@/lib/api'
import type { BlockScope, BlockSeriesMeta, PendingBlockGroup } from '@/types/blocks'
import {
  buildStaffDayGrid,
  groupContiguousSlotTimes,
  summarizeGridSelection,
} from '@/lib/timeGrid'
import type {
  BookableService,
  DayScheduleAppointment,
  DayScheduleBlock,
  StaffDaySchedule,
} from '@/types/booking'

export type AdminColumnSelection = {
  staffId: string
  staffName: string
  times: Set<string>
}

export function useAdminAgenda(adminToken: string, date: string) {
  const [schedules, setSchedules] = useState<StaffDaySchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gridActionsBusy, setGridActionsBusy] = useState(false)

  const [selection, setSelection] = useState<AdminColumnSelection | null>(null)
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

  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [pendingBlockGroups, setPendingBlockGroups] = useState<PendingBlockGroup[]>([])
  const [unblockModal, setUnblockModal] = useState<{
    blockIds: string[]
    series: BlockSeriesMeta
  } | null>(null)
  const [viewingBlock, setViewingBlock] = useState<{
    staffId: string
    staffName: string
    block: DayScheduleBlock
  } | null>(null)
  const [viewingBlockSeries, setViewingBlockSeries] = useState<BlockSeriesMeta | null>(null)
  const [viewingBlockSeriesLoading, setViewingBlockSeriesLoading] = useState(false)
  const [blockDetailBusy, setBlockDetailBusy] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [whatsAppNotifyDialogOpen, setWhatsAppNotifyDialogOpen] = useState(false)
  const [whatsAppNotifyBusy, setWhatsAppNotifyBusy] = useState(false)

  const load = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchDaySchedule(date, adminToken)
      setSchedules(res.schedules)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Sesión de administración no válida.')
      } else {
        setError('No se pudo cargar la agenda.')
      }
    } finally {
      setLoading(false)
    }
  }, [adminToken, date])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setSelection(null)
    setAppointmentFormOpen(false)
    setEditingId(null)
    setViewingAppointment(null)
    setDetailEditMode(false)
    setActiveStaffId(null)
    setAptDraft({ ...EMPTY_APPOINTMENT_DRAFT })
  }, [date])

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
  }, [services])

  const clearSelection = useCallback(() => setSelection(null), [])

  const toggleSlot = useCallback(
    (staffId: string, staffName: string, time: string) => {
      setSelection((prev) => {
        if (prev?.staffId !== staffId) {
          return { staffId, staffName, times: new Set([time]) }
        }
        const next = new Set(prev.times)
        if (next.has(time)) next.delete(time)
        else next.add(time)
        if (next.size === 0) return null
        return { staffId, staffName, times: next }
      })
    },
    [],
  )

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
    [services],
  )

  const openNewAppointmentForActiveStaff = useCallback(() => {
    if (!activeStaffId) return
    openNewAppointment(activeStaffId, '')
  }, [activeStaffId, openNewAppointment])

  const closeAppointmentDetail = useCallback(() => {
    setViewingAppointment(null)
    setDetailEditMode(false)
    setEditingId(null)
    setDetailCustomerRegistered(false)
    setAptDraft({ ...EMPTY_APPOINTMENT_DRAFT })
  }, [])

  const openAppointmentDetail = useCallback(
    (staffId: string, apt: DayScheduleAppointment) => {
      const staffName = schedules.find((s) => s.staffId === staffId)?.staffName ?? ''
      setActiveStaffId(staffId)
      setSelection(null)
      setEditingId(apt.id)
      setDetailEditMode(false)
      setViewingAppointment({ staffId, staffName, apt })
      setAptDraft(appointmentToDraft(apt))
      setDetailCustomerRegistered(false)

      if (!adminToken || !apt.customerPhone) return
      fetchCustomerDetail(adminToken, apt.customerPhone)
        .then((detail) => {
          setDetailCustomerRegistered(true)
          setAptDraft(
            appointmentToDraft(apt, {
              email: detail.customer.email,
              notes: detail.customer.notes,
            }),
          )
        })
        .catch(() => {
          setDetailCustomerRegistered(false)
        })
    },
    [adminToken, schedules],
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

  const selectionSummary = useCallback(() => {
    if (!selection) {
      return { freeTimes: [], blockIds: [], hasAppointment: false }
    }
    const schedule = schedules.find((s) => s.staffId === selection.staffId)
    if (!schedule) {
      return { freeTimes: [], blockIds: [], hasAppointment: false }
    }
    const cells = buildStaffDayGrid(schedule, date)
    return summarizeGridSelection(selection.times, cells)
  }, [selection, schedules, date])

  const requestBlockSelectedSlots = useCallback(() => {
    if (!selection) return
    const schedule = schedules.find((s) => s.staffId === selection.staffId)
    if (!schedule) return
    const cells = buildStaffDayGrid(schedule, date)
    const { freeTimes } = summarizeGridSelection(selection.times, cells)
    const groups = groupContiguousSlotTimes(freeTimes)
    if (groups.length === 0) return
    setPendingBlockGroups(groups)
    setBlockModalOpen(true)
  }, [selection, schedules, date])

  const cancelBlockModal = useCallback(() => {
    setBlockModalOpen(false)
    setPendingBlockGroups([])
  }, [])

  const confirmBlockWithScope = useCallback(
    async (scope: BlockScope, endDate?: string, note?: string) => {
      if (!selection || !adminToken || pendingBlockGroups.length === 0) return
      setGridActionsBusy(true)
      setError('')
      try {
        for (const group of pendingBlockGroups) {
          await createAdminBlock(adminToken, {
            staffId: selection.staffId,
            date,
            startTime: group.startTime,
            endTime: group.endTime,
            scope,
            endDate,
            note,
          })
        }
        setBlockModalOpen(false)
        setPendingBlockGroups([])
        clearSelection()
        await load()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo bloquear')
      } finally {
        setGridActionsBusy(false)
      }
    },
    [selection, adminToken, pendingBlockGroups, date, clearSelection, load],
  )

  const unblockSelectedSlots = useCallback(async () => {
    if (!selection || !adminToken) return
    const schedule = schedules.find((s) => s.staffId === selection.staffId)
    if (!schedule) return
    const cells = buildStaffDayGrid(schedule, date)
    const { blockIds } = summarizeGridSelection(selection.times, cells)
    if (blockIds.length === 0) return

    setGridActionsBusy(true)
    setError('')
    try {
      const firstMeta = await fetchAdminBlockSeries(adminToken, blockIds[0])
      if (firstMeta.count <= 1) {
        for (const id of blockIds) {
          await deleteAdminBlock(id, adminToken, 'single')
        }
        clearSelection()
        await load()
        return
      }

      setUnblockModal({ blockIds, series: firstMeta })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo comprobar el bloqueo')
    } finally {
      setGridActionsBusy(false)
    }
  }, [selection, adminToken, schedules, date, clearSelection, load])

  const cancelUnblockModal = useCallback(() => {
    setUnblockModal(null)
  }, [])

  const confirmUnblockWithMode = useCallback(
    async (mode: 'single' | 'series') => {
      if (!unblockModal || !adminToken) return
      setGridActionsBusy(true)
      setError('')
      try {
        const ids =
          mode === 'series' && unblockModal.series.seriesId
            ? [unblockModal.blockIds[0]]
            : unblockModal.blockIds

        for (const id of ids) {
          await deleteAdminBlock(id, adminToken, mode)
        }
        setUnblockModal(null)
        clearSelection()
        await load()
      } catch {
        setError('No se pudo quitar el bloqueo')
      } finally {
        setGridActionsBusy(false)
      }
    },
    [unblockModal, adminToken, clearSelection, load],
  )

  const createAppointmentFromSelection = useCallback(() => {
    if (!selection) return
    const schedule = schedules.find((s) => s.staffId === selection.staffId)
    if (!schedule) return
    const cells = buildStaffDayGrid(schedule, date)
    const { freeTimes } = summarizeGridSelection(selection.times, cells)
    if (freeTimes.length !== 1) return
    openNewAppointment(selection.staffId, selection.staffName, freeTimes[0])
  }, [selection, schedules, date, openNewAppointment])

  const persistAppointment = useCallback(
    async (notifyCustomerWhatsApp?: boolean): Promise<boolean> => {
      if (!activeStaffId || !adminToken) return false
      setError('')
      try {
        if (editingId) {
          await updateAdminAppointment(editingId, adminToken, {
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
            notifyCustomerWhatsApp,
          })
        } else {
          await createAdminAppointment(
            {
              staffId: activeStaffId,
              serviceId: aptDraft.serviceId,
              date,
              startTime: aptDraft.startTime,
              customerFirstName: aptDraft.customerFirstName,
              customerLastName: aptDraft.customerLastName,
              customerPhone: aptDraft.customerPhone,
              customerEmail: aptDraft.customerEmail || undefined,
              customerNotes: aptDraft.customerNotes || aptDraft.notes || undefined,
              notes: aptDraft.notes || undefined,
            },
            adminToken,
          )
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
    ],
  )

  const saveAppointment = useCallback(
    async (e: React.FormEvent): Promise<boolean> => {
      e.preventDefault()
      if (!activeStaffId || !adminToken) return false
      if (editingId) {
        setWhatsAppNotifyDialogOpen(true)
        return false
      }
      return persistAppointment()
    },
    [activeStaffId, adminToken, editingId, persistAppointment],
  )

  const closeWhatsAppNotifyDialog = useCallback(() => {
    if (whatsAppNotifyBusy) return
    setWhatsAppNotifyDialogOpen(false)
  }, [whatsAppNotifyBusy])

  const confirmSaveWithWhatsAppNotify = useCallback(async () => {
    setWhatsAppNotifyBusy(true)
    try {
      await persistAppointment(true)
    } finally {
      setWhatsAppNotifyBusy(false)
    }
  }, [persistAppointment])

  const confirmSaveWithoutWhatsAppNotify = useCallback(async () => {
    setWhatsAppNotifyBusy(true)
    try {
      await persistAppointment(false)
    } finally {
      setWhatsAppNotifyBusy(false)
    }
  }, [persistAppointment])

  const closeConfirmDialog = useCallback(() => {
    if (confirmBusy) return
    setConfirmDialog(null)
  }, [confirmBusy])

  const runConfirmDialog = useCallback(async () => {
    if (!confirmDialog) return
    setConfirmBusy(true)
    try {
      await confirmDialog.onConfirm()
      setConfirmDialog(null)
    } finally {
      setConfirmBusy(false)
    }
  }, [confirmDialog])

  const cancelAppointmentById = useCallback(
    (id: string) => {
      setConfirmDialog({
        title: '¿Cancelar esta cita?',
        message:
          'Se avisará al cliente por WhatsApp y al salón por email. Si la cita era mañana, no se enviará el recordatorio automático.',
        confirmLabel: 'Cancelar cita',
        destructive: true,
        onConfirm: async () => {
          setError('')
          try {
            await cancelAppointment(id, adminToken)
            setAppointmentFormOpen(false)
            closeAppointmentDetail()
            resetAppointmentForm()
            await load()
          } catch {
            setError('No se pudo cancelar la cita')
          }
        },
      })
    },
    [adminToken, load, resetAppointmentForm, closeAppointmentDetail],
  )

  const openBlockDetail = useCallback(
    (staffId: string, block: DayScheduleBlock) => {
      const staffName = schedules.find((s) => s.staffId === staffId)?.staffName ?? ''
      setSelection(null)
      setViewingBlock({ staffId, staffName, block })
      setViewingBlockSeries(null)
      setViewingBlockSeriesLoading(true)
      void fetchAdminBlockSeries(adminToken, block.id)
        .then(setViewingBlockSeries)
        .catch(() => setViewingBlockSeries(null))
        .finally(() => setViewingBlockSeriesLoading(false))
    },
    [adminToken, schedules],
  )

  const closeBlockDetail = useCallback(() => {
    setViewingBlock(null)
    setViewingBlockSeries(null)
    setViewingBlockSeriesLoading(false)
  }, [])

  const saveBlockNote = useCallback(
    async (note: string, mode: 'single' | 'series') => {
      if (!viewingBlock || !adminToken) return
      setBlockDetailBusy(true)
      setError('')
      try {
        await updateAdminBlock(adminToken, viewingBlock.block.id, { note, mode })
        closeBlockDetail()
        await load()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
      } finally {
        setBlockDetailBusy(false)
      }
    },
    [viewingBlock, adminToken, closeBlockDetail, load],
  )

  const deleteViewingBlock = useCallback(
    async (mode: 'single' | 'series') => {
      if (!viewingBlock || !adminToken) return
      setBlockDetailBusy(true)
      setError('')
      try {
        await deleteAdminBlock(viewingBlock.block.id, adminToken, mode)
        closeBlockDetail()
        await load()
      } catch {
        setError('No se pudo quitar el bloqueo')
      } finally {
        setBlockDetailBusy(false)
      }
    },
    [viewingBlock, adminToken, closeBlockDetail, load],
  )

  return {
    schedules,
    loading,
    error,
    setError,
    load,
    selection,
    selectionSummary: selectionSummary(),
    toggleSlot,
    clearSelection,
    gridActionsBusy,
    blockModalOpen,
    pendingBlockGroups,
    requestBlockSelectedSlots,
    cancelBlockModal,
    confirmBlockWithScope,
    unblockModal,
    cancelUnblockModal,
    confirmUnblockWithMode,
    unblockSelectedSlots,
    createAppointmentFromSelection,
    appointmentFormOpen,
    setAppointmentFormOpen,
    activeStaffId,
    scheduleForActiveStaff,
    services,
    slots,
    aptDraft,
    setAptDraft,
    editingId,
    resetAppointmentForm,
    selectStaff,
    openNewAppointment,
    openNewAppointmentForActiveStaff,
    viewingAppointment,
    detailEditMode,
    detailCustomerRegistered,
    openAppointmentDetail,
    closeAppointmentDetail,
    startDetailEdit,
    setDetailEditMode,
    changeDetailStaff,
    saveAppointment,
    whatsAppNotifyDialogOpen,
    whatsAppNotifyBusy,
    closeWhatsAppNotifyDialog,
    confirmSaveWithWhatsAppNotify,
    confirmSaveWithoutWhatsAppNotify,
    cancelAppointmentById,
    viewingBlock,
    viewingBlockSeries,
    viewingBlockSeriesLoading,
    blockDetailBusy,
    openBlockDetail,
    closeBlockDetail,
    saveBlockNote,
    deleteViewingBlock,
    confirmDialog,
    confirmBusy,
    closeConfirmDialog,
    runConfirmDialog,
    formSlotTime:
      appointmentFormOpen && !editingId && activeStaffId ? aptDraft.startTime || null : null,
    formStaffId: appointmentFormOpen && !editingId ? activeStaffId : null,
  }
}
