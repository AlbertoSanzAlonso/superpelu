import { useCallback, useEffect } from 'react'
import { useAgendaPolling } from '@/hooks/agenda/useAgendaPolling'
import { useAdminAgendaSchedule } from './useAdminAgendaSchedule'
import { useAdminAgendaSelection } from './useAdminAgendaSelection'
import { useAdminAgendaGridBlocks } from './useAdminAgendaGridBlocks'
import { useAdminAgendaAppointments } from './useAdminAgendaAppointments'
import { useAdminAgendaMoves } from './useAdminAgendaMoves'
import { useAgendaConfirm } from '@/hooks/agenda/useAgendaConfirm'
import { useAdminAppointmentNotifications } from './useAdminAppointmentNotifications'
import type { AgendaViewMode } from '@/lib/agenda/agendaView'

export type { AdminColumnSelection } from './types'
export type { AppointmentMoveDraft } from '@/lib/agenda/pendingMoves'

export function useAdminAgenda(
  adminToken: string,
  date: string,
  agendaView: AgendaViewMode = 'day',
) {
  const schedule = useAdminAgendaSchedule(adminToken, date, agendaView)
  const selectionState = useAdminAgendaSelection(schedule.schedules, date)
  const confirm = useAgendaConfirm()
  const notifications = useAdminAppointmentNotifications(adminToken)

  const appointments = useAdminAgendaAppointments({
    adminToken,
    date,
    schedules: schedule.schedules,
    selection: selectionState.selection,
    clearSelection: selectionState.clearSelection,
    setSelection: selectionState.setSelection,
    load: schedule.load,
    setError: schedule.setError,
    setConfirmDialog: confirm.setConfirmDialog,
    resyncAppointmentSnapshots: notifications.resyncAppointmentSnapshots,
  })

  const blocks = useAdminAgendaGridBlocks({
    adminToken,
    date,
    schedules: schedule.schedules,
    selection: selectionState.selection,
    clearSelection: selectionState.clearSelection,
    setSelection: selectionState.setSelection,
    load: schedule.load,
    setError: schedule.setError,
    setGridActionsBusy: schedule.setGridActionsBusy,
  })

  const moves = useAdminAgendaMoves({
    adminToken,
    date,
    schedules: schedule.schedules,
    load: schedule.load,
    setError: schedule.setError,
    setConfirmDialog: confirm.setConfirmDialog,
    clearSelection: selectionState.clearSelection,
    onMovesCommitted: () => appointments.setWhatsAppNotifyDialogOpen(false),
    resyncAppointmentSnapshots: notifications.resyncAppointmentSnapshots,
  })

  useEffect(() => {
    selectionState.resetSelection()
    appointments.resetAppointmentUi()
    moves.resetMoves()
  }, [date])

  const gridInteractionsLocked = moves.pendingMoves.length > 0

  const pollPaused =
    schedule.gridActionsBusy ||
    gridInteractionsLocked ||
    appointments.appointmentFormOpen ||
    appointments.detailEditMode ||
    appointments.whatsAppNotifyDialogOpen ||
    appointments.whatsAppNotifyBusy ||
    appointments.noShowDialogOpen ||
    appointments.noShowBusy ||
    appointments.seriesConflictOpen ||
    blocks.blockModalOpen ||
    blocks.unblockModal != null ||
    blocks.blockDetailBusy ||
    confirm.confirmDialog != null ||
    moves.moveBusy

  const reloadAgendaAndNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      await schedule.load(opts)
      if (!pollPaused) {
        await notifications.pollAppointmentChanges()
      }
    },
    [schedule.load, notifications.pollAppointmentChanges, pollPaused],
  )

  useAgendaPolling(reloadAgendaAndNotifications, {
    enabled: Boolean(adminToken),
    paused: pollPaused,
  })

  useEffect(() => {
    if (!gridInteractionsLocked) return
    selectionState.clearSelection()
    appointments.setAppointmentFormOpen(false)
    appointments.resetAppointmentForm()
  }, [gridInteractionsLocked])

  const toggleSlot = useCallback(
    (staffId: string, staffName: string, time: string) => {
      if (gridInteractionsLocked) return
      appointments.selectStaff(staffId)
      selectionState.toggleSlot(staffId, staffName, time)
    },
    [gridInteractionsLocked, appointments.selectStaff, selectionState.toggleSlot],
  )

  const applySlots = useCallback(
    (staffId: string, staffName: string, times: Set<string>) => {
      if (gridInteractionsLocked) return
      appointments.selectStaff(staffId)
      selectionState.applySlots(staffId, staffName, times)
    },
    [gridInteractionsLocked, appointments.selectStaff, selectionState.applySlots],
  )

  const requestBlockSelectedSlots = useCallback(() => {
    if (gridInteractionsLocked) return
    blocks.requestBlockSelectedSlots()
  }, [gridInteractionsLocked, blocks.requestBlockSelectedSlots])

  const unblockSelectedSlots = useCallback(async () => {
    if (gridInteractionsLocked) return
    await blocks.unblockSelectedSlots()
  }, [gridInteractionsLocked, blocks.unblockSelectedSlots])

  const createAppointmentFromSelection = useCallback(() => {
    if (gridInteractionsLocked) return
    appointments.createAppointmentFromSelection()
  }, [gridInteractionsLocked, appointments.createAppointmentFromSelection])

  const openNewAppointmentForActiveStaff = useCallback(() => {
    if (gridInteractionsLocked) return
    appointments.openNewAppointmentForActiveStaff()
  }, [gridInteractionsLocked, appointments.openNewAppointmentForActiveStaff])

  const requestSavePendingMoves = useCallback(() => {
    if (!moves.requestSavePendingMoves()) return
    appointments.setWhatsAppNotifyContext('move')
    appointments.setWhatsAppNotifyDialogOpen(true)
  }, [moves, appointments])

  const confirmSaveWithWhatsAppNotify = useCallback(async () => {
    appointments.setWhatsAppNotifyBusy(true)
    try {
      let ok = false
      if (appointments.whatsAppNotifyContext === 'move') {
        ok = await moves.commitPendingMoves(true)
      } else if (appointments.whatsAppNotifyContext === 'cancel') {
        ok = await appointments.persistCancel(true)
      } else if (appointments.whatsAppNotifyContext === 'edit') {
        ok = await appointments.persistAppointment(true)
      }
      if (!ok && appointments.whatsAppNotifyContext === 'move') {
        appointments.setWhatsAppNotifyDialogOpen(false)
      }
    } finally {
      appointments.setWhatsAppNotifyBusy(false)
    }
  }, [appointments, moves])

  const confirmSaveWithoutWhatsAppNotify = useCallback(async () => {
    appointments.setWhatsAppNotifyBusy(true)
    try {
      let ok = false
      if (appointments.whatsAppNotifyContext === 'move') {
        ok = await moves.commitPendingMoves(false)
      } else if (appointments.whatsAppNotifyContext === 'cancel') {
        ok = await appointments.persistCancel(false)
      } else if (appointments.whatsAppNotifyContext === 'edit') {
        ok = await appointments.persistAppointment(false)
      }
      if (!ok && appointments.whatsAppNotifyContext === 'move') {
        appointments.setWhatsAppNotifyDialogOpen(false)
      }
    } finally {
      appointments.setWhatsAppNotifyBusy(false)
    }
  }, [appointments, moves])

  return {
    schedules: schedule.schedules,
    salonWindows: schedule.salonWindows,
    dayBundles: schedule.dayBundles,
    viewDates: schedule.viewDates,
    agendaView,
    loadedDate: schedule.loadedDate,
    loading: schedule.loading,
    error: schedule.error,
    setError: schedule.setError,
    load: schedule.load,
    selection: selectionState.selection,
    selectionSummary: selectionState.selectionSummary(),
    toggleSlot,
    applySlots,
    clearSelection: selectionState.clearSelection,
    gridInteractionsLocked,
    gridActionsBusy: schedule.gridActionsBusy,
    blockModalOpen: blocks.blockModalOpen,
    pendingBlockGroups: blocks.pendingBlockGroups,
    requestBlockSelectedSlots,
    cancelBlockModal: blocks.cancelBlockModal,
    confirmBlockWithScope: blocks.confirmBlockWithScope,
    unblockModal: blocks.unblockModal,
    cancelUnblockModal: blocks.cancelUnblockModal,
    confirmUnblockWithMode: blocks.confirmUnblockWithMode,
    unblockSelectedSlots,
    createAppointmentFromSelection,
    appointmentFormOpen: appointments.appointmentFormOpen,
    setAppointmentFormOpen: appointments.setAppointmentFormOpen,
    activeStaffId: appointments.activeStaffId,
    scheduleForActiveStaff: appointments.scheduleForActiveStaff,
    services: appointments.services,
    slots: appointments.slots,
    slotsOverHours: appointments.slotsOverHours,
    slotsConflict: appointments.slotsConflict,
    dismissSlotsConflict: appointments.dismissSlotsConflict,
    confirmSlotsConflict: appointments.confirmSlotsConflict,
    serviceSlotsPerIndex: appointments.serviceSlotsPerIndex,
    serviceAlternativeStaff: appointments.serviceAlternativeStaff,
    aptDraft: appointments.aptDraft,
    setAptDraft: appointments.setAptDraft,
    editingId: appointments.editingId,
    resetAppointmentForm: appointments.resetAppointmentForm,
    selectStaff: appointments.selectStaff,
    openNewAppointment: appointments.openNewAppointment,
    openNewAppointmentForActiveStaff,
    viewingAppointment: appointments.viewingAppointment,
    detailEditMode: appointments.detailEditMode,
    detailCustomerRegistered: appointments.detailCustomerRegistered,
    setDetailCustomerRegistered: appointments.setDetailCustomerRegistered,
    detailReviewRequestSentAt: appointments.detailReviewRequestSentAt,
    setDetailReviewRequestSentAt: appointments.setDetailReviewRequestSentAt,
    openAppointmentDetail: appointments.openAppointmentDetail,
    closeAppointmentDetail: appointments.closeAppointmentDetail,
    startDetailEdit: appointments.startDetailEdit,
    setDetailEditMode: appointments.setDetailEditMode,
    changeDetailStaff: appointments.changeDetailStaff,
    syncDetailActiveStaff: appointments.syncDetailActiveStaff,
    saveAppointment: appointments.saveAppointment,
    whatsAppNotifyDialogOpen: appointments.whatsAppNotifyDialogOpen,
    whatsAppNotifyContext: appointments.whatsAppNotifyContext,
    whatsAppNotifyBusy: appointments.whatsAppNotifyBusy,
    closeWhatsAppNotifyDialog: appointments.closeWhatsAppNotifyDialog,
    confirmSaveWithWhatsAppNotify,
    confirmSaveWithoutWhatsAppNotify,
    cancelAppointmentById: appointments.cancelAppointmentById,
    cancelScopeOpen: appointments.cancelScopeOpen,
    cancelScopeSeries: appointments.cancelScopeSeries,
    cancelScopeGroupCount: appointments.cancelScopeGroupCount,
    cancelScopeGroupServices: appointments.cancelScopeGroupServices,
    closeCancelScopeModal: appointments.closeCancelScopeModal,
    confirmCancelScope: appointments.confirmCancelScope,
    seriesConflictOpen: appointments.seriesConflictOpen,
    seriesConflictPreview: appointments.seriesConflictPreview,
    seriesConflictBusy: appointments.seriesConflictBusy,
    closeSeriesConflictModal: appointments.closeSeriesConflictModal,
    resolveSeriesConflicts: appointments.resolveSeriesConflicts,
    noShowDialogOpen: appointments.noShowDialogOpen,
    noShowBusy: appointments.noShowBusy,
    closeNoShowDialog: appointments.closeNoShowDialog,
    markNoShowById: appointments.markNoShowById,
    confirmNoShowWithWhatsApp: async () => {
      appointments.setNoShowBusy(true)
      try {
        await appointments.persistNoShow(true)
      } finally {
        appointments.setNoShowBusy(false)
      }
    },
    confirmNoShowWithoutWhatsApp: async () => {
      appointments.setNoShowBusy(true)
      try {
        await appointments.persistNoShow(false)
      } finally {
        appointments.setNoShowBusy(false)
      }
    },
    viewingBlock: blocks.viewingBlock,
    viewingBlockSeries: blocks.viewingBlockSeries,
    viewingBlockSeriesLoading: blocks.viewingBlockSeriesLoading,
    blockDetailBusy: blocks.blockDetailBusy,
    openBlockDetail: blocks.openBlockDetail,
    resizeBlock: blocks.resizeBlock,
    closeBlockDetail: blocks.closeBlockDetail,
    saveBlockNote: blocks.saveBlockNote,
    deleteViewingBlock: blocks.deleteViewingBlock,
    confirmDialog: confirm.confirmDialog,
    confirmBusy: confirm.confirmBusy,
    closeConfirmDialog: confirm.closeConfirmDialog,
    runConfirmDialog: confirm.runConfirmDialog,
    formSlotTime: appointments.formSlotTime,
    formStaffId: appointments.formStaffId,
    pendingMoves: moves.pendingMoves,
    pendingMoveSummary: moves.pendingMoveSummary,
    proposeAppointmentMove: moves.proposeAppointmentMove,
    undoLastPendingMove: moves.undoLastPendingMove,
    discardPendingMoves: moves.discardPendingMoves,
    requestSavePendingMoves,
    moveBusy: moves.moveBusy,
    appointmentNotifications: notifications,
  }
}
