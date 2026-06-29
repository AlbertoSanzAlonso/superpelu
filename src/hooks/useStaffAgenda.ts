import { useCallback, useEffect, useState } from 'react'
import {
  appointmentToDraft,
  EMPTY_APPOINTMENT_DRAFT,
  type AppointmentDraft,
} from '@/components/agenda/staff/types'
import {
  createMyAppointment,
  createMyBlock,
  deleteMyAppointment,
  markMyAppointmentNoShow,
  deleteMyBlock,
  fetchMyBlockSeries,
  fetchMyAppointmentSeries,
  fetchMySchedule,
  updateMyBlock,
  fetchMyServices,
  fetchMySlots,
  updateMyAppointment,
  previewMySeriesConflicts,
} from '@/lib/api/staff'
import { ApiError } from '@/lib/api'
import type { SeriesPreviewResult, SeriesConflictResolution } from '@/lib/api/admin'
import {
  blockGroupsFromGridSummary,
  singleFreeTimeFromGridSummary,
  summarizeScheduleGridSelection,
} from '@/lib/agenda/gridSelection'
import { useAgendaDate } from '@/hooks/useAgendaDate'
import { useAgendaConfirm } from '@/hooks/agenda/useAgendaConfirm'
import { useAgendaGridTimes } from '@/hooks/agenda/useAgendaGridTimes'
import { useAgendaPendingBlockCreate } from '@/hooks/agenda/useAgendaPendingBlockCreate'
import { useAgendaBlockDetailView } from '@/hooks/agenda/useAgendaBlockDetailView'
import type {
  BookableService,
  DayScheduleAppointment,
  DayScheduleBlock,
  StaffDaySchedule,
} from '@/types/booking'
import type { AppointmentSeriesMeta, AppointmentSeriesMode } from '@/types/appointmentSeries'

export function useStaffAgenda(token: string) {
  const { date, setDate } = useAgendaDate()
  const [schedule, setSchedule] = useState<StaffDaySchedule | null>(null)
  const [services, setServices] = useState<BookableService[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [slotsOverHours, setSlotsOverHours] = useState<string[]>([])
  const [serviceSlotsPerIndex, setServiceSlotsPerIndex] = useState<string[][]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gridActionsBusy, setGridActionsBusy] = useState(false)

  const gridSelection = useAgendaGridTimes(date)
  const blockCreate = useAgendaPendingBlockCreate()
  const confirmUi = useAgendaConfirm()

  const [aptDraft, setAptDraft] = useState<AppointmentDraft>({ ...EMPTY_APPOINTMENT_DRAFT })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false)
  const [noShowBusy, setNoShowBusy] = useState(false)
  const [pendingNoShowId, setPendingNoShowId] = useState<string | null>(null)
  const [cancelScopeOpen, setCancelScopeOpen] = useState(false)
  const [cancelScopeSeries, setCancelScopeSeries] = useState<AppointmentSeriesMeta | null>(null)
  const [cancelScopeGroupCount, setCancelScopeGroupCount] = useState<number>(0)
  const [cancelScopeGroupServices, setCancelScopeGroupServices] = useState<string[]>([])
  const [seriesConflictOpen, setSeriesConflictOpen] = useState(false)
  const [seriesConflictPreview, setSeriesConflictPreview] = useState<SeriesPreviewResult | null>(null)
  const [seriesConflictBusy, setSeriesConflictBusy] = useState(false)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [pendingRemoveSuccess, setPendingRemoveSuccess] = useState<(() => void) | undefined>()

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
        serviceIds: d.serviceIds.length > 0 ? d.serviceIds : [],
      }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [date, token])

  const blockDetail = useAgendaBlockDetailView<DayScheduleBlock>({
    fetchSeries: (blockId) => fetchMyBlockSeries(token, blockId),
    updateNote: (blockId, note, mode) => updateMyBlock(token, blockId, { note, mode }),
    remove: (blockId, mode) => deleteMyBlock(token, blockId, mode),
    reload: load,
    setError,
  })

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const filteredIds = aptDraft.serviceIds.filter((s) => s !== '')
    if (filteredIds.length === 0 || !date) {
      setSlots([])
      return
    }
    fetchMySlots(token, date, filteredIds, editingId ?? undefined)
      .then((r) => {
        setSlots(r.slots)
        setSlotsOverHours(r.slotsOverHours)
      })
      .catch(() => {
        setSlots([])
        setSlotsOverHours([])
      })
  }, [token, date, aptDraft.serviceIds.join(','), editingId])

  // Slots disponibles por servicio individual (para tratamientos adicionales)
  useEffect(() => {
    const filteredIds = aptDraft.serviceIds.filter((s) => s !== '')
    if (filteredIds.length <= 1 || !date) {
      setServiceSlotsPerIndex([])
      return
    }
    Promise.all(
      filteredIds.map((id, i) =>
        i === 0
          ? Promise.resolve([] as string[])
          : fetchMySlots(token, date, [id], editingId ?? undefined)
              .then((r) => [...r.slots, ...r.slotsOverHours])
              .catch(() => [] as string[]),
      ),
    ).then((results) => setServiceSlotsPerIndex(results))
  }, [token, date, aptDraft.serviceIds.join(','), editingId])

  const resetAppointmentForm = useCallback((keepServiceIds = true) => {
    setEditingId(null)
    setAptDraft((d) => ({
      ...EMPTY_APPOINTMENT_DRAFT,
      serviceIds: keepServiceIds ? d.serviceIds : [],
    }))
  }, [])

  const startEditAppointment = useCallback((apt: DayScheduleAppointment) => {
    setEditingId(apt.id)
    setAptDraft(appointmentToDraft(apt))
  }, [])

  const selectFreeSlot = useCallback(
    (time: string) => {
      setEditingId(null)
      gridSelection.clear()
      setAptDraft((d) => ({
        ...EMPTY_APPOINTMENT_DRAFT,
        serviceIds: d.serviceIds.length > 0 ? d.serviceIds : [],
        startTime: time,
      }))
    },
    [gridSelection],
  )

  const gridSummary = useCallback(() => {
    if (!schedule) {
      return { freeTimes: [], blockIds: [], hasAppointment: false }
    }
    return summarizeScheduleGridSelection(schedule, date, gridSelection.times)
  }, [schedule, date, gridSelection.times])

  const requestBlockSelectedGridSlots = useCallback(() => {
    const groups = blockGroupsFromGridSummary(gridSummary())
    if (groups) blockCreate.openWithGroups(groups)
  }, [gridSummary, blockCreate])

  const confirmBlockWithNote = useCallback(
    async (note?: string) => {
      if (blockCreate.pendingGroups.length === 0) return
      setGridActionsBusy(true)
      setError('')
      try {
        for (const range of blockCreate.pendingGroups) {
          await createMyBlock(token, {
            date,
            startTime: range.startTime,
            endTime: range.endTime,
            note,
          })
        }
        blockCreate.closeAfterSuccess()
        gridSelection.clear()
        await load()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo bloquear')
      } finally {
        setGridActionsBusy(false)
      }
    },
    [blockCreate, token, date, gridSelection, load],
  )

  const openBlockDetail = useCallback(
    (block: DayScheduleBlock) => {
      blockDetail.open(block, block.id, gridSelection.clear)
    },
    [blockDetail, gridSelection.clear],
  )

  const saveBlockNote = useCallback(
    async (note: string, mode: 'single' | 'series') => {
      if (!blockDetail.viewing) return
      await blockDetail.saveNote(blockDetail.viewing.id, note, mode)
    },
    [blockDetail],
  )

  const deleteViewingBlock = useCallback(
    async (mode: 'single' | 'series') => {
      if (!blockDetail.viewing) return
      await blockDetail.deleteBlock(blockDetail.viewing.id, mode)
    },
    [blockDetail],
  )

  const unblockSelectedGridSlots = useCallback(async () => {
    const { blockIds } = gridSummary()
    if (blockIds.length === 0) return

    if (!window.confirm(`¿Quitar ${blockIds.length} bloqueo(s) seleccionado(s)?`)) return

    setGridActionsBusy(true)
    setError('')
    try {
      for (const id of blockIds) {
        await deleteMyBlock(token, id)
      }
      gridSelection.clear()
      await load()
    } catch {
      setError('No se pudo quitar el bloqueo')
    } finally {
      setGridActionsBusy(false)
    }
  }, [gridSummary, token, gridSelection, load])

  const createAppointmentFromGridSelection = useCallback((): string | undefined => {
    return singleFreeTimeFromGridSummary(gridSummary())
  }, [gridSummary])

  const doSave = useCallback(
    async (forceSchedule = false, conflictResolutions?: SeriesConflictResolution[]): Promise<boolean> => {
      const filteredIds = aptDraft.serviceIds.filter(Boolean)
      try {
        const normalizedStartTimes =
          aptDraft.serviceStartTimes.length === filteredIds.length &&
          aptDraft.serviceStartTimes.some((t) => t !== '')
            ? aptDraft.serviceStartTimes.map((t, i) => (i === 0 && !t ? aptDraft.startTime : t))
            : aptDraft.serviceStartTimes

        if (editingId) {
          await updateMyAppointment(token, editingId, {
            serviceIds: filteredIds,
            serviceStartTimes: normalizedStartTimes,
            serviceDurations: aptDraft.serviceDurations,
            date,
            startTime: aptDraft.startTime,
            customerFirstName: aptDraft.customerFirstName,
            customerLastName: aptDraft.customerLastName,
            customerPhone: aptDraft.customerPhone,
            customerEmail: aptDraft.customerEmail || null,
            customerNotes: aptDraft.customerNotes || null,
            notes: aptDraft.notes || null,
            customerLocale: aptDraft.customerLocale,
            forceSchedule,
          })
        } else {
          const isMultiTreatmentSeries = filteredIds.length > 1 && aptDraft.recurrenceScope === 'weekly'

          if (isMultiTreatmentSeries && !conflictResolutions) {
            const preview = await previewMySeriesConflicts(token, {
              serviceIds: filteredIds,
              serviceStartTimes: normalizedStartTimes.length > 0 ? normalizedStartTimes : undefined,
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
              endDate: aptDraft.recurrenceEndDate || undefined,
            })
            if (preview.conflicts.length > 0) {
              setSeriesConflictPreview(preview)
              setSeriesConflictOpen(true)
              return false
            }
          }

          await createMyAppointment(token, {
            serviceIds: filteredIds,
            serviceStartTimes: normalizedStartTimes,
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
            scope: aptDraft.recurrenceScope === 'weekly' ? 'weekly' : undefined,
            endDate:
              aptDraft.recurrenceScope === 'weekly' && aptDraft.recurrenceEndDate
                ? aptDraft.recurrenceEndDate
                : undefined,
            forceSchedule,
            ...(conflictResolutions ? { conflictResolutions } : {}),
          })
        }
        resetAppointmentForm()
        await load()
        return true
      } catch (err) {
        if (
          !forceSchedule &&
          err instanceof ApiError &&
          /horario no disponible|no está disponible/i.test(err.message)
        ) {
          confirmUi.setConfirmDialog({
            title: 'El horario no está disponible',
            message:
              'Ese horario está ocupado o fuera del horario laboral. ¿Quieres agendarla de todas formas?',
            confirmLabel: 'Agendar de todas formas',
            destructive: false,
            onConfirm: async () => {
              confirmUi.closeConfirmDialog()
              await doSave(true)
            },
          })
          return false
        }
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar la cita')
        return false
      }
    },
    [aptDraft, date, editingId, load, resetAppointmentForm, token, confirmUi],
  )

  const saveAppointment = useCallback(
    async (e: React.FormEvent): Promise<boolean> => {
      e.preventDefault()
      setError('')
      return doSave()
    },
    [doSave],
  )

  const closeNoShowDialog = useCallback(() => {
    if (noShowBusy) return
    setNoShowDialogOpen(false)
    setPendingNoShowId(null)
  }, [noShowBusy])

  const persistNoShow = useCallback(
    async (sendWhatsApp: boolean) => {
      if (!pendingNoShowId) return
      setError('')
      setNoShowBusy(true)
      try {
        await markMyAppointmentNoShow(token, pendingNoShowId, { sendWhatsApp })
        setNoShowDialogOpen(false)
        setPendingNoShowId(null)
        resetAppointmentForm()
        await load()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo registrar la inasistencia')
      } finally {
        setNoShowBusy(false)
      }
    },
    [pendingNoShowId, token, resetAppointmentForm, load],
  )

  const markNoShowById = useCallback((id: string) => {
    setPendingNoShowId(id)
    setNoShowDialogOpen(true)
  }, [])

  const closeCancelScopeModal = useCallback(() => {
    setCancelScopeOpen(false)
    setCancelScopeSeries(null)
    setCancelScopeGroupCount(0)
    setCancelScopeGroupServices([])
    setPendingRemoveId(null)
    setPendingRemoveSuccess(undefined)
  }, [])

  const confirmRemoveScope = useCallback(
    (mode: AppointmentSeriesMode) => {
      if (!pendingRemoveId) return
      setCancelScopeOpen(false)
      const count = cancelScopeSeries?.count ?? 1
      const groupCount = cancelScopeGroupCount
      confirmUi.setConfirmDialog({
        title:
          mode === 'series'
            ? '¿Eliminar todas las citas periódicas?'
            : mode === 'group'
              ? '¿Eliminar toda la visita?'
              : '¿Eliminar este tratamiento?',
        message:
          mode === 'series'
            ? `Se eliminarán ${count} citas de la serie. Se avisará al cliente por WhatsApp y al salón por email.`
            : mode === 'group'
              ? `Se eliminarán los ${groupCount} tratamientos de esta visita. Se avisará al cliente y al salón.`
              : 'Se avisará al cliente por WhatsApp y al salón por email. Si la cita era mañana, no se enviará el recordatorio automático.',
        confirmLabel: mode === 'series' ? 'Eliminar todas' : mode === 'group' ? 'Eliminar visita' : 'Eliminar tratamiento',
        destructive: true,
        onConfirm: async () => {
          setError('')
          try {
            await deleteMyAppointment(token, pendingRemoveId, mode)
            if (editingId === pendingRemoveId) resetAppointmentForm()
            pendingRemoveSuccess?.()
            setPendingRemoveId(null)
            setCancelScopeSeries(null)
            setCancelScopeGroupCount(0)
            setCancelScopeGroupServices([])
            setPendingRemoveSuccess(undefined)
            await load()
          } catch {
            setError('No se pudo eliminar la cita')
          }
        },
      })
    },
    [
      pendingRemoveId,
      cancelScopeSeries,
      confirmUi,
      token,
      editingId,
      resetAppointmentForm,
      pendingRemoveSuccess,
      load,
    ],
  )

  const removeAppointment = useCallback(
    (id: string, onSuccess?: () => void) => {
      void (async () => {
        const apt = schedule?.appointments.find((a) => a.id === id)

        // Detectar si pertenece a una visita multi-tratamiento
        if (apt?.bookingGroupId) {
          const siblingsInGroup = (schedule?.appointments ?? []).filter(
            (a) =>
              a.bookingGroupId === apt.bookingGroupId &&
              a.status === 'confirmed' &&
              a.colorGroupRole !== 'wash',
          )
          if (siblingsInGroup.length > 1) {
            const groupServices = siblingsInGroup.map((a) => a.serviceName ?? '').filter(Boolean)
            setPendingRemoveId(id)
            setCancelScopeGroupCount(siblingsInGroup.length)
            setCancelScopeGroupServices(groupServices)
            if (apt.seriesId) {
              try {
                const series = await fetchMyAppointmentSeries(token, id)
                if (series.count > 1) setCancelScopeSeries(series)
              } catch { /* continuar sin serie */ }
            }
            setPendingRemoveSuccess(() => onSuccess)
            setCancelScopeOpen(true)
            return
          }
        }

        if (apt?.seriesId) {
          try {
            const series = await fetchMyAppointmentSeries(token, id)
            if (series.count > 1) {
              setPendingRemoveId(id)
              setCancelScopeSeries(series)
              setPendingRemoveSuccess(() => onSuccess)
              setCancelScopeOpen(true)
              return
            }
          } catch {
            /* continuar con confirmación simple */
          }
        }

        confirmUi.setConfirmDialog({
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
      })()
    },
    [schedule, token, editingId, load, resetAppointmentForm, confirmUi],
  )

  return {
    date,
    setDate,
    schedule,
    services,
    slots,
    slotsOverHours,
    serviceSlotsPerIndex,
    loading,
    error,
    aptDraft,
    setAptDraft,
    editingId,
    saveAppointment,
    startEditAppointment,
    selectFreeSlot,
    selectedGridTimes: gridSelection.times,
    toggleGridSlot: gridSelection.toggle,
    clearGridSelection: gridSelection.clear,
    blockCreateModalOpen: blockCreate.modalOpen,
    pendingBlockGroups: blockCreate.pendingGroups,
    requestBlockSelectedGridSlots,
    cancelBlockCreateModal: blockCreate.cancel,
    confirmBlockWithNote,
    viewingBlock: blockDetail.viewing,
    viewingBlockSeries: blockDetail.series,
    viewingBlockSeriesLoading: blockDetail.seriesLoading,
    blockDetailBusy: blockDetail.busy,
    openBlockDetail,
    closeBlockDetail: blockDetail.close,
    saveBlockNote,
    deleteViewingBlock,
    unblockSelectedGridSlots,
    createAppointmentFromGridSelection,
    gridActionsBusy,
    removeAppointment,
    markNoShowById,
    noShowDialogOpen,
    noShowBusy,
    closeNoShowDialog,
    persistNoShow,
    resetAppointmentForm,
    confirmDialog: confirmUi.confirmDialog,
    confirmBusy: confirmUi.confirmBusy,
    closeConfirmDialog: confirmUi.closeConfirmDialog,
    runConfirmDialog: confirmUi.runConfirmDialog,
    cancelScopeOpen,
    cancelScopeSeries,
    cancelScopeGroupCount,
    cancelScopeGroupServices,
    closeCancelScopeModal,
    confirmRemoveScope,
    seriesConflictOpen,
    seriesConflictPreview,
    seriesConflictBusy,
    closeSeriesConflictModal: () => {
      setSeriesConflictOpen(false)
      setSeriesConflictPreview(null)
    },
    resolveSeriesConflicts: async (resolutions: SeriesConflictResolution[]) => {
      setSeriesConflictBusy(true)
      try {
        await doSave(false, resolutions)
        setSeriesConflictOpen(false)
        setSeriesConflictPreview(null)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar la cita')
      } finally {
        setSeriesConflictBusy(false)
      }
    },
  }
}
