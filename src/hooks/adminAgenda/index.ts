import { useCallback, useEffect } from 'react'
import { useAdminAgendaSchedule } from './useAdminAgendaSchedule'
import { useAdminAgendaSelection } from './useAdminAgendaSelection'
import { useAdminAgendaGridBlocks } from './useAdminAgendaGridBlocks'
import { useAdminAgendaAppointments } from './useAdminAgendaAppointments'
import { useAdminAgendaMoves } from './useAdminAgendaMoves'
import { useAgendaConfirm } from '@/hooks/agenda/useAgendaConfirm'

export type { AdminColumnSelection } from './types'
export type { AppointmentMoveDraft } from '@/lib/pendingAppointmentMoves'

export function useAdminAgenda(adminToken: string, date: string) {
  const schedule = useAdminAgendaSchedule(adminToken, date)
  const selectionState = useAdminAgendaSelection(schedule.schedules, date)
  const confirm = useAgendaConfirm()

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
    clearSelection: selectionState.clearSelection,
    onMovesCommitted: () => appointments.setWhatsAppNotifyDialogOpen(false),
  })

  useEffect(() => {
    selectionState.resetSelection()
    appointments.resetAppointmentUi()
    moves.resetMoves()
  }, [date])

  const gridInteractionsLocked = moves.pendingMoves.length > 0

  useEffect(() => {
    if (!gridInteractionsLocked) return
    selectionState.clearSelection()
    appointments.setAppointmentFormOpen(false)
    appointments.resetAppointmentForm()
  }, [gridInteractionsLocked])

  const toggleSlot = useCallback(
    (staffId: string, staffName: string, time: string) => {
      if (gridInteractionsLocked) return
      selectionState.toggleSlot(staffId, staffName, time)
    },
    [gridInteractionsLocked, selectionState.toggleSlot],
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
      if (appointments.whatsAppNotifyContext === 'move') {
        await moves.commitPendingMoves(true)
      } else if (appointments.whatsAppNotifyContext === 'cancel') {
        await appointments.persistCancel(true)
      } else {
        await appointments.persistAppointment(true)
      }
    } finally {
      appointments.setWhatsAppNotifyBusy(false)
    }
  }, [appointments, moves])

  const confirmSaveWithoutWhatsAppNotify = useCallback(async () => {
    appointments.setWhatsAppNotifyBusy(true)
    try {
      if (appointments.whatsAppNotifyContext === 'move') {
        await moves.commitPendingMoves(false)
      } else if (appointments.whatsAppNotifyContext === 'cancel') {
        await appointments.persistCancel(false)
      } else {
        await appointments.persistAppointment(false)
      }
    } finally {
      appointments.setWhatsAppNotifyBusy(false)
    }
  }, [appointments, moves])

  return {
    schedules: schedule.schedules,
    loading: schedule.loading,
    error: schedule.error,
    setError: schedule.setError,
    load: schedule.load,
    selection: selectionState.selection,
    selectionSummary: selectionState.selectionSummary(),
    toggleSlot,
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
    openAppointmentDetail: appointments.openAppointmentDetail,
    closeAppointmentDetail: appointments.closeAppointmentDetail,
    startDetailEdit: appointments.startDetailEdit,
    setDetailEditMode: appointments.setDetailEditMode,
    changeDetailStaff: appointments.changeDetailStaff,
    saveAppointment: appointments.saveAppointment,
    whatsAppNotifyDialogOpen: appointments.whatsAppNotifyDialogOpen,
    whatsAppNotifyContext: appointments.whatsAppNotifyContext,
    whatsAppNotifyBusy: appointments.whatsAppNotifyBusy,
    closeWhatsAppNotifyDialog: appointments.closeWhatsAppNotifyDialog,
    confirmSaveWithWhatsAppNotify,
    confirmSaveWithoutWhatsAppNotify,
    cancelAppointmentById: appointments.cancelAppointmentById,
    viewingBlock: blocks.viewingBlock,
    viewingBlockSeries: blocks.viewingBlockSeries,
    viewingBlockSeriesLoading: blocks.viewingBlockSeriesLoading,
    blockDetailBusy: blocks.blockDetailBusy,
    openBlockDetail: blocks.openBlockDetail,
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
  }
}
