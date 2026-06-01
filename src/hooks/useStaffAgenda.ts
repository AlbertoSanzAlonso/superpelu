import { useCallback, useEffect, useState } from 'react'
import type { ConfirmDialogState } from '@/components/ui/ConfirmDialog'
import {
  appointmentToDraft,
  EMPTY_APPOINTMENT_DRAFT,
  type AppointmentDraft,
} from '@/components/agenda/staff/types'
import {
  createMyAppointment,
  createMyBlock,
  deleteMyAppointment,
  deleteMyBlock,
  fetchMyBlockSeries,
  fetchMySchedule,
  updateMyBlock,
  fetchMyServices,
  fetchMySlots,
  updateMyAppointment,
} from '@/lib/staffApi'
import { ApiError } from '@/lib/api'
import {
  buildStaffDayGrid,
  groupContiguousSlotTimes,
  summarizeGridSelection,
} from '@/lib/timeGrid'
import { useAgendaDate } from '@/hooks/useAgendaDate'
import type {
  BookableService,
  DayScheduleAppointment,
  DayScheduleBlock,
  StaffDaySchedule,
} from '@/types/booking'
import type { BlockSeriesMeta, PendingBlockGroup } from '@/types/blocks'

export function useStaffAgenda(token: string) {
  const { date, setDate } = useAgendaDate()
  const [schedule, setSchedule] = useState<StaffDaySchedule | null>(null)
  const [services, setServices] = useState<BookableService[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [aptDraft, setAptDraft] = useState<AppointmentDraft>({ ...EMPTY_APPOINTMENT_DRAFT })
  const [editingId, setEditingId] = useState<string | null>(null)

  const [selectedGridTimes, setSelectedGridTimes] = useState<Set<string>>(() => new Set())
  const [gridActionsBusy, setGridActionsBusy] = useState(false)
  const [blockCreateModalOpen, setBlockCreateModalOpen] = useState(false)
  const [pendingBlockGroups, setPendingBlockGroups] = useState<PendingBlockGroup[]>([])
  const [viewingBlock, setViewingBlock] = useState<DayScheduleBlock | null>(null)
  const [viewingBlockSeries, setViewingBlockSeries] = useState<BlockSeriesMeta | null>(null)
  const [viewingBlockSeriesLoading, setViewingBlockSeriesLoading] = useState(false)
  const [blockDetailBusy, setBlockDetailBusy] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [schedRes, svcRes] = await Promise.all([
        fetchMySchedule(date, token),
        fetchMyServices(token),
      ])
      setSchedule(schedRes.schedule)
      setServices(svcRes.services)
      setAptDraft((d) => ({
        ...d,
        serviceId: d.serviceId || '',
      }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [date, token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setSelectedGridTimes(new Set())
  }, [date])

  useEffect(() => {
    if (!aptDraft.serviceId || !date) {
      setSlots([])
      return
    }
    fetchMySlots(token, date, aptDraft.serviceId, editingId ?? undefined)
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]))
  }, [token, date, aptDraft.serviceId, editingId])

  const resetAppointmentForm = useCallback((keepServiceId = true) => {
    setEditingId(null)
    setAptDraft((d) => ({
      ...EMPTY_APPOINTMENT_DRAFT,
      serviceId: keepServiceId ? d.serviceId : '',
    }))
  }, [services])

  const startEditAppointment = useCallback((apt: DayScheduleAppointment) => {
    setEditingId(apt.id)
    setAptDraft(appointmentToDraft(apt))
  }, [])

  const clearGridSelection = useCallback(() => {
    setSelectedGridTimes(new Set())
  }, [])

  const toggleGridSlot = useCallback((time: string) => {
    setSelectedGridTimes((prev) => {
      const next = new Set(prev)
      if (next.has(time)) next.delete(time)
      else next.add(time)
      return next
    })
  }, [])

  const selectFreeSlot = useCallback(
    (time: string) => {
      setEditingId(null)
      clearGridSelection()
      setAptDraft((d) => ({
        ...EMPTY_APPOINTMENT_DRAFT,
        serviceId: d.serviceId || '',
        startTime: time,
      }))
    },
    [clearGridSelection, services],
  )

  const requestBlockSelectedGridSlots = useCallback(() => {
    if (!schedule) return
    const cells = buildStaffDayGrid(schedule, date)
    const { freeTimes, hasAppointment } = summarizeGridSelection(selectedGridTimes, cells)
    if (hasAppointment || freeTimes.length === 0) return
    const groups = groupContiguousSlotTimes(freeTimes)
    setPendingBlockGroups(groups)
    setBlockCreateModalOpen(true)
  }, [schedule, date, selectedGridTimes])

  const cancelBlockCreateModal = useCallback(() => {
    setBlockCreateModalOpen(false)
    setPendingBlockGroups([])
  }, [])

  const confirmBlockWithNote = useCallback(
    async (note?: string) => {
      if (pendingBlockGroups.length === 0) return
      setGridActionsBusy(true)
      setError('')
      try {
        for (const range of pendingBlockGroups) {
          await createMyBlock(token, {
            date,
            startTime: range.startTime,
            endTime: range.endTime,
            note,
          })
        }
        setBlockCreateModalOpen(false)
        setPendingBlockGroups([])
        clearGridSelection()
        await load()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo bloquear')
      } finally {
        setGridActionsBusy(false)
      }
    },
    [pendingBlockGroups, token, date, clearGridSelection, load],
  )

  const openBlockDetail = useCallback(
    (block: DayScheduleBlock) => {
      clearGridSelection()
      setViewingBlock(block)
      setViewingBlockSeries(null)
      setViewingBlockSeriesLoading(true)
      void fetchMyBlockSeries(token, block.id)
        .then(setViewingBlockSeries)
        .catch(() => setViewingBlockSeries(null))
        .finally(() => setViewingBlockSeriesLoading(false))
    },
    [token, clearGridSelection],
  )

  const closeBlockDetail = useCallback(() => {
    setViewingBlock(null)
    setViewingBlockSeries(null)
    setViewingBlockSeriesLoading(false)
  }, [])

  const saveBlockNote = useCallback(
    async (note: string, mode: 'single' | 'series') => {
      if (!viewingBlock) return
      setBlockDetailBusy(true)
      setError('')
      try {
        await updateMyBlock(token, viewingBlock.id, { note, mode })
        closeBlockDetail()
        await load()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
      } finally {
        setBlockDetailBusy(false)
      }
    },
    [viewingBlock, token, closeBlockDetail, load],
  )

  const deleteViewingBlock = useCallback(
    async (mode: 'single' | 'series') => {
      if (!viewingBlock) return
      setBlockDetailBusy(true)
      setError('')
      try {
        await deleteMyBlock(token, viewingBlock.id, mode)
        closeBlockDetail()
        await load()
      } catch {
        setError('No se pudo quitar el bloqueo')
      } finally {
        setBlockDetailBusy(false)
      }
    },
    [viewingBlock, token, closeBlockDetail, load],
  )

  const unblockSelectedGridSlots = useCallback(async () => {
    if (!schedule) return
    const cells = buildStaffDayGrid(schedule, date)
    const { blockIds } = summarizeGridSelection(selectedGridTimes, cells)
    if (blockIds.length === 0) return

    if (!confirm(`¿Quitar ${blockIds.length} bloqueo(s) seleccionado(s)?`)) return

    setGridActionsBusy(true)
    setError('')
    try {
      for (const id of blockIds) {
        await deleteMyBlock(token, id)
      }
      clearGridSelection()
      await load()
    } catch {
      setError('No se pudo quitar el bloqueo')
    } finally {
      setGridActionsBusy(false)
    }
  }, [schedule, date, selectedGridTimes, token, clearGridSelection, load])

  const createAppointmentFromGridSelection = useCallback((): string | undefined => {
    if (!schedule) return undefined
    const cells = buildStaffDayGrid(schedule, date)
    const { freeTimes } = summarizeGridSelection(selectedGridTimes, cells)
    if (freeTimes.length !== 1) return undefined
    return freeTimes[0]
  }, [schedule, date, selectedGridTimes])

  const saveAppointment = useCallback(
    async (e: React.FormEvent): Promise<boolean> => {
      e.preventDefault()
      setError('')
      try {
        if (editingId) {
          await updateMyAppointment(token, editingId, {
            serviceId: aptDraft.serviceId,
            date,
            startTime: aptDraft.startTime,
            customerFirstName: aptDraft.customerFirstName,
            customerLastName: aptDraft.customerLastName,
            customerPhone: aptDraft.customerPhone,
            customerEmail: aptDraft.customerEmail || null,
            customerNotes: aptDraft.customerNotes || null,
            notes: aptDraft.notes || null,
          })
        } else {
          await createMyAppointment(token, {
            serviceId: aptDraft.serviceId,
            date,
            startTime: aptDraft.startTime,
            customerFirstName: aptDraft.customerFirstName,
            customerLastName: aptDraft.customerLastName,
            customerPhone: aptDraft.customerPhone,
            customerEmail: aptDraft.customerEmail || undefined,
            customerNotes: aptDraft.customerNotes || aptDraft.notes || undefined,
            notes: aptDraft.notes || undefined,
          })
        }
        resetAppointmentForm()
        await load()
        return true
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar la cita')
        return false
      }
    },
    [aptDraft, date, editingId, load, resetAppointmentForm, token],
  )

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

  const removeAppointment = useCallback(
    (id: string, onSuccess?: () => void) => {
      setConfirmDialog({
        title: '¿Eliminar esta cita?',
        message:
          'Se avisará al cliente por WhatsApp y al salón por email. Si la cita era mañana, no se enviará el recordatorio automático.',
        confirmLabel: 'Eliminar cita',
        destructive: true,
        onConfirm: async () => {
          setError('')
          try {
            await deleteMyAppointment(token, id)
            if (editingId === id) resetAppointmentForm()
            await load()
            onSuccess?.()
          } catch {
            setError('No se pudo eliminar la cita')
          }
        },
      })
    },
    [editingId, load, resetAppointmentForm, token],
  )

  return {
    date,
    setDate,
    schedule,
    services,
    slots,
    loading,
    error,
    aptDraft,
    setAptDraft,
    editingId,
    saveAppointment,
    startEditAppointment,
    selectFreeSlot,
    selectedGridTimes,
    toggleGridSlot,
    clearGridSelection,
    blockCreateModalOpen,
    pendingBlockGroups,
    requestBlockSelectedGridSlots,
    cancelBlockCreateModal,
    confirmBlockWithNote,
    viewingBlock,
    viewingBlockSeries,
    viewingBlockSeriesLoading,
    blockDetailBusy,
    openBlockDetail,
    closeBlockDetail,
    saveBlockNote,
    deleteViewingBlock,
    unblockSelectedGridSlots,
    createAppointmentFromGridSelection,
    gridActionsBusy,
    removeAppointment,
    resetAppointmentForm,
    confirmDialog,
    confirmBusy,
    closeConfirmDialog,
    runConfirmDialog,
  }
}
