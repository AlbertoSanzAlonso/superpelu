import { AdminAppointmentToastStack } from '@/components/agenda/admin/AdminAppointmentToastStack'
import type { AdminAppointmentNotificationItem } from '@/lib/agenda/adminNotifications'
import type { AgendaViewMode } from '@/lib/agenda/agendaView'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { WhatsAppNotifyDialog } from '@/components/ui/WhatsAppNotifyDialog'
import { NoShowContactDialog } from '@/components/ui/NoShowContactDialog'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { AdminAgendaControlBar } from '@/components/agenda/admin/AdminAgendaControlBar'
import { AdminCalendarLegend } from '@/components/agenda/admin/AdminCalendarLegend'
import { AdminSalonDayCalendar } from '@/components/agenda/admin/AdminSalonDayCalendar'
import { AdminMultiDayCalendar } from '@/components/agenda/admin/AdminMultiDayCalendar'
import { AppointmentMoveBar } from '@/components/agenda/admin/AppointmentMoveBar'
import { BlockDetailModal } from '@/components/agenda/BlockDetailModal'
import { CancelAppointmentScopeModal } from '@/components/agenda/CancelAppointmentScopeModal'
import { BlockScopeModal } from '@/components/agenda/admin/BlockScopeModal'
import { UnblockScopeModal } from '@/components/agenda/admin/UnblockScopeModal'
import { AgendaAppointmentModal } from '@/components/agenda/AgendaAppointmentModal'
import { StaffAppointmentFormModal } from '@/components/agenda/staff/StaffAppointmentFormModal'
import { AppointmentAvailabilityWarningModal } from '@/components/agenda/AppointmentAvailabilityWarningModal'
import { SeriesConflictModal } from '@/components/agenda/SeriesConflictModal'
import { typography } from '@/styles/typography'
import type { UseAdminAgendaReturn } from '@/hooks/useAdminAgenda'
import { fetchBookingFallback, updateBookingFallback } from '@/lib/api/admin'
import { useEffect, useMemo, useState } from 'react'
import type { DayScheduleAppointment, DayScheduleBlock } from '@/types/booking'

type PendingColumnAction =
  | { kind: 'toggle'; date: string; staffId: string; staffName: string; time: string }
  | { kind: 'edit'; date: string; staffId: string; apt: DayScheduleAppointment }
  | { kind: 'block'; date: string; staffId: string; block: DayScheduleBlock }
  | { kind: 'new'; date: string; staffId: string; staffName: string; time: string }

export function AdminAgendaWorkspace({
  selectedDate,
  onDateChange,
  agendaView,
  onAgendaViewChange,
  adminToken,
  agenda,
  openAppointmentFromNotification,
  onLogout,
}: {
  selectedDate: string
  onDateChange: (date: string) => void
  agendaView: AgendaViewMode
  onAgendaViewChange: (view: AgendaViewMode) => void
  adminToken: string
  agenda: UseAdminAgendaReturn
  openAppointmentFromNotification: (item: AdminAppointmentNotificationItem) => void
  onLogout: () => void
}) {
  const notifications = agenda.appointmentNotifications
  const totalAppointments =
    agendaView === 'day'
      ? agenda.schedules.reduce((n, s) => n + s.appointments.length, 0)
      : agenda.dayBundles.reduce(
          (n, day) =>
            n +
            day.schedules
              .filter((s) => !agenda.activeStaffId || s.staffId === agenda.activeStaffId)
              .reduce((m, s) => m + s.appointments.length, 0),
          0,
        )

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const day of agenda.dayBundles) {
      for (const s of day.schedules) {
        if (!map.has(s.staffId)) map.set(s.staffId, s.staffName)
      }
    }
    for (const s of agenda.schedules) {
      if (!map.has(s.staffId)) map.set(s.staffId, s.staffName)
    }
    return [...map.entries()].map(([staffId, staffName]) => ({ staffId, staffName }))
  }, [agenda.dayBundles, agenda.schedules])

  const activeStaffName =
    staffOptions.find((s) => s.staffId === agenda.activeStaffId)?.staffName ??
    agenda.schedules.find((s) => s.staffId === agenda.activeStaffId)?.staffName ??
    ''

  const appointmentModalOpen =
    agenda.appointmentFormOpen || agenda.viewingAppointment != null

  const [bukFallbackEnabled, setBukFallbackEnabled] = useState(false)
  const [bukFallbackBusy, setBukFallbackBusy] = useState(false)
  const [pendingColumnAction, setPendingColumnAction] = useState<PendingColumnAction | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchBookingFallback(adminToken)
      .then((res) => {
        if (!cancelled) setBukFallbackEnabled(res.enabled)
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [adminToken])

  useEffect(() => {
    if (agendaView === 'day') return
    if (agenda.activeStaffId) return
    const first = staffOptions[0]
    if (first) agenda.selectStaff(first.staffId)
  }, [agendaView, agenda.activeStaffId, staffOptions, agenda.selectStaff])

  useEffect(() => {
    if (!pendingColumnAction) return
    if (selectedDate !== pendingColumnAction.date) return
    if (agenda.loadedDate !== selectedDate) return
    const action = pendingColumnAction
    setPendingColumnAction(null)
    if (action.kind === 'toggle') {
      agenda.toggleSlot(action.staffId, action.staffName, action.time)
    } else if (action.kind === 'new') {
      agenda.openNewAppointment(action.staffId, action.staffName, action.time)
    } else if (action.kind === 'edit') {
      agenda.openAppointmentDetail(action.staffId, action.apt)
    } else if (action.kind === 'block') {
      agenda.openBlockDetail(action.staffId, action.block)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when date/bundle ready
  }, [pendingColumnAction, selectedDate, agenda.loadedDate])

  async function toggleBukFallback() {
    if (bukFallbackBusy) return
    setBukFallbackBusy(true)
    try {
      const next = await updateBookingFallback(adminToken, !bukFallbackEnabled)
      setBukFallbackEnabled(next.enabled)
    } catch {
      /* keep previous state */
    } finally {
      setBukFallbackBusy(false)
    }
  }

  function closeAppointmentForm() {
    agenda.setAppointmentFormOpen(false)
    agenda.resetAppointmentForm()
  }

  function queueColumnAction(action: PendingColumnAction) {
    if (action.date === selectedDate && agenda.loadedDate === selectedDate) {
      if (action.kind === 'toggle') {
        agenda.toggleSlot(action.staffId, action.staffName, action.time)
      } else if (action.kind === 'new') {
        agenda.openNewAppointment(action.staffId, action.staffName, action.time)
      } else if (action.kind === 'edit') {
        agenda.openAppointmentDetail(action.staffId, action.apt)
      } else if (action.kind === 'block') {
        agenda.openBlockDetail(action.staffId, action.block)
      }
      return
    }
    setPendingColumnAction(action)
    onDateChange(action.date)
  }

  return (
    <AgendaWorkspaceShell>
      <header className="relative z-20 shrink-0 overflow-visible">
        <AdminAgendaControlBar
          date={selectedDate}
          onDateChange={onDateChange}
          agendaView={agendaView}
          onAgendaViewChange={onAgendaViewChange}
          viewDates={agenda.viewDates}
          appointmentCount={totalAppointments}
          schedules={agenda.schedules}
          staffOptions={staffOptions}
          activeStaffId={agenda.activeStaffId}
          onStaffChange={agenda.selectStaff}
          onNewAppointment={() => {
            if (agenda.activeStaffId) agenda.openNewAppointmentForActiveStaff()
          }}
          onLogout={onLogout}
          selectionCount={agenda.selection?.times.size ?? 0}
          selectionSummary={agenda.selection ? agenda.selectionSummary : undefined}
          gridInteractionsLocked={agenda.gridInteractionsLocked}
          onBlockSelection={agenda.requestBlockSelectedSlots}
          onUnblockSelection={() => void agenda.unblockSelectedSlots()}
          onCreateAppointmentFromSelection={agenda.createAppointmentFromSelection}
          onClearSelection={agenda.clearSelection}
          selectionBusy={agenda.gridActionsBusy}
          notificationInbox={notifications.inbox}
          notificationBellOpen={notifications.bellOpen}
          notificationLastSeenAt={notifications.lastSeenAt}
          onNotificationBellOpen={notifications.openBell}
          onNotificationBellClose={notifications.closeBell}
          onNotificationSelect={openAppointmentFromNotification}
          bukFallbackEnabled={bukFallbackEnabled}
          bukFallbackBusy={bukFallbackBusy}
          onToggleBukFallback={() => void toggleBukFallback()}
        />

        {agenda.error && !appointmentModalOpen && (
          <p
            className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800"
            role="alert"
          >
            {agenda.error}
          </p>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">
        {agenda.loading && agenda.schedules.length === 0 && agenda.dayBundles.length === 0 ? (
          <p className={`${typography.caption} py-8 text-center`}>Cargando agenda…</p>
        ) : (
          <>
            <AdminCalendarLegend />
            <div className="min-h-0 flex-1">
              {agendaView === 'day' ? (
                <AdminSalonDayCalendar
                  date={selectedDate}
                  schedules={agenda.schedules}
                  salonWindows={agenda.salonWindows}
                  selection={agenda.selection}
                  formSlotTime={agenda.formSlotTime}
                  formStaffId={agenda.formStaffId}
                  pendingMoveSummary={agenda.pendingMoveSummary}
                  moveBusy={agenda.moveBusy}
                  gridInteractionsLocked={agenda.gridInteractionsLocked}
                  onToggleSlot={agenda.toggleSlot}
                  onEditAppointment={agenda.openAppointmentDetail}
                  onOpenBlock={agenda.openBlockDetail}
                  onProposeAppointmentMove={agenda.proposeAppointmentMove}
                  activeStaffId={agenda.activeStaffId}
                  onSelectStaff={agenda.selectStaff}
                />
              ) : agenda.activeStaffId ? (
                <AdminMultiDayCalendar
                  staffId={agenda.activeStaffId}
                  staffName={activeStaffName}
                  dayBundles={agenda.dayBundles}
                  selection={agenda.selection}
                  formSlotTime={agenda.formSlotTime}
                  formStaffId={agenda.formStaffId}
                  gridInteractionsLocked={agenda.gridInteractionsLocked}
                  onFocusDate={onDateChange}
                  onToggleSlot={(date, staffId, staffName, time) =>
                    queueColumnAction({ kind: 'toggle', date, staffId, staffName, time })
                  }
                  onEditAppointment={(date, staffId, apt) =>
                    queueColumnAction({ kind: 'edit', date, staffId, apt })
                  }
                  onOpenBlock={(date, staffId, block) =>
                    queueColumnAction({ kind: 'block', date, staffId, block })
                  }
                />
              ) : (
                <p className={`${typography.caption} py-8 text-center`}>
                  Elige un profesional para ver la agenda de varios días.
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {agenda.pendingMoves.length > 0 && (
        <AppointmentMoveBar
          summary={agenda.pendingMoveSummary}
          busy={agenda.moveBusy || agenda.whatsAppNotifyBusy}
          onUndo={agenda.undoLastPendingMove}
          onSave={agenda.requestSavePendingMoves}
          onDiscard={agenda.discardPendingMoves}
        />
      )}

      {agenda.selection && (
        <BlockScopeModal
          open={agenda.blockModalOpen}
          anchorDate={selectedDate}
          groups={agenda.pendingBlockGroups}
          staffName={agenda.selection.staffName}
          busy={agenda.gridActionsBusy}
          onClose={agenda.cancelBlockModal}
          onConfirm={(scope, endDate, note) => void agenda.confirmBlockWithScope(scope, endDate, note)}
        />
      )}

      {agenda.viewingBlock && (
        <BlockDetailModal
          open
          date={selectedDate}
          staffName={agenda.viewingBlock.staffName}
          block={agenda.viewingBlock.block}
          series={agenda.viewingBlockSeries}
          seriesLoading={agenda.viewingBlockSeriesLoading}
          busy={agenda.blockDetailBusy}
          onClose={agenda.closeBlockDetail}
          onSave={agenda.saveBlockNote}
          onDelete={agenda.deleteViewingBlock}
        />
      )}

      {agenda.unblockModal && (
        <UnblockScopeModal
          open
          series={agenda.unblockModal.series}
          viewDate={selectedDate}
          busy={agenda.gridActionsBusy}
          onClose={agenda.cancelUnblockModal}
          onConfirm={(mode) => void agenda.confirmUnblockWithMode(mode)}
        />
      )}

      {agenda.viewingAppointment && (
        <AgendaAppointmentModal
          open
          error={agenda.error}
          mode={agenda.detailEditMode ? 'edit' : 'view'}
          date={selectedDate}
          staffId={agenda.viewingAppointment.staffId}
          staffName={agenda.viewingAppointment.staffName}
          staffOptions={agenda.schedules.map((s) => ({
            id: s.staffId,
            name: s.staffName,
          }))}
          onStaffChange={agenda.changeDetailStaff}
          onActiveStaffSync={agenda.syncDetailActiveStaff}
          appointment={agenda.viewingAppointment.apt}
          customerRegistered={agenda.detailCustomerRegistered}
          draft={agenda.aptDraft}
          services={agenda.services}
          slots={agenda.slots}
          slotsOverHours={agenda.slotsOverHours}
          serviceSlots={agenda.serviceSlotsPerIndex}
          serviceAlternativeStaff={agenda.serviceAlternativeStaff}
          onModeChange={(m) =>
            m === 'edit' ? agenda.startDetailEdit() : agenda.setDetailEditMode(false)
          }
          onDraftChange={(patch) => agenda.setAptDraft((d) => ({ ...d, ...patch }))}
          onSubmit={agenda.saveAppointment}
          onClose={agenda.closeAppointmentDetail}
          onCancelAppointment={() => agenda.cancelAppointmentById(agenda.viewingAppointment!.apt.id)}
          onMarkNoShow={() => agenda.markNoShowById(agenda.viewingAppointment!.apt.id)}
          showCustomerHistory
          adminToken={adminToken}
          reviewRequestSentAt={agenda.detailReviewRequestSentAt}
          onReviewRequestSent={agenda.setDetailReviewRequestSentAt}
          onCustomerRegisteredChange={(registered, reviewSentAt) => {
            agenda.setDetailCustomerRegistered(registered)
            if (reviewSentAt !== undefined) {
              agenda.setDetailReviewRequestSentAt(reviewSentAt)
            }
          }}
        />
      )}

      {agenda.activeStaffId && agenda.appointmentFormOpen && !agenda.viewingAppointment && (
        <StaffAppointmentFormModal
          open
          date={selectedDate}
          error={agenda.error}
          staffName={activeStaffName}
          editingId={null}
          draft={agenda.aptDraft}
          services={agenda.services}
          slots={agenda.slots}
          slotsOverHours={agenda.slotsOverHours}
          serviceSlots={agenda.serviceSlotsPerIndex}
          serviceAlternativeStaff={agenda.serviceAlternativeStaff}
          staffList={agenda.schedules.map((s) => ({ id: s.staffId, name: s.staffName }))}
          defaultStaffId={agenda.activeStaffId ?? undefined}
          onDraftChange={(patch) => agenda.setAptDraft((d) => ({ ...d, ...patch }))}
          onSubmit={agenda.saveAppointment}
          onClose={closeAppointmentForm}
          adminToken={adminToken}
        />
      )}

      <AppointmentAvailabilityWarningModal
        open={Boolean(agenda.slotsConflict)}
        conflict={agenda.slotsConflict}
        date={selectedDate}
        serviceIds={agenda.aptDraft.serviceIds}
        startTime={agenda.aptDraft.startTime}
        currentStaffId={agenda.activeStaffId ?? ''}
        onClose={agenda.dismissSlotsConflict}
        onConfirm={agenda.confirmSlotsConflict}
        onChangeStaff={(staffId) => {
          if (agenda.viewingAppointment) {
            agenda.changeDetailStaff(staffId)
          } else {
            agenda.selectStaff(staffId)
          }
          agenda.setAptDraft((d) => ({ ...d, staffAssignments: [] }))
        }}
      />

      {agenda.seriesConflictPreview && (
        <SeriesConflictModal
          open={agenda.seriesConflictOpen}
          conflicts={agenda.seriesConflictPreview.conflicts}
          totalDates={agenda.seriesConflictPreview.dates.length}
          okDatesCount={agenda.seriesConflictPreview.okDates.length}
          onResolve={agenda.resolveSeriesConflicts}
          onClose={agenda.closeSeriesConflictModal}
        />
      )}

      {(agenda.cancelScopeSeries != null || agenda.cancelScopeGroupCount > 1) && (
        <CancelAppointmentScopeModal
          open={agenda.cancelScopeOpen}
          series={agenda.cancelScopeSeries}
          viewDate={selectedDate}
          action="cancel"
          bookingGroupCount={agenda.cancelScopeGroupCount > 1 ? agenda.cancelScopeGroupCount : undefined}
          bookingGroupServices={agenda.cancelScopeGroupServices}
          onClose={agenda.closeCancelScopeModal}
          onConfirm={agenda.confirmCancelScope}
        />
      )}

      <WhatsAppNotifyDialog
        open={agenda.whatsAppNotifyDialogOpen}
        context={agenda.whatsAppNotifyContext}
        busy={agenda.whatsAppNotifyBusy}
        onClose={agenda.closeWhatsAppNotifyDialog}
        onNotify={agenda.confirmSaveWithWhatsAppNotify}
        onSaveWithoutNotify={agenda.confirmSaveWithoutWhatsAppNotify}
      />

      <NoShowContactDialog
        open={agenda.noShowDialogOpen}
        busy={agenda.noShowBusy}
        onClose={agenda.closeNoShowDialog}
        onMarkContacted={agenda.confirmNoShowWithoutWhatsApp}
        onSendWhatsApp={agenda.confirmNoShowWithWhatsApp}
      />

      <AdminAppointmentToastStack
        toasts={notifications.toasts}
        onDismiss={notifications.dismissToast}
        onSelect={openAppointmentFromNotification}
      />

      <ConfirmDialog
        open={agenda.confirmDialog != null}
        title={agenda.confirmDialog?.title ?? ''}
        message={agenda.confirmDialog?.message}
        confirmLabel={agenda.confirmDialog?.confirmLabel}
        cancelLabel={agenda.confirmDialog?.cancelLabel}
        destructive={agenda.confirmDialog?.destructive}
        busy={agenda.confirmBusy}
        onClose={agenda.closeConfirmDialog}
        onConfirm={agenda.runConfirmDialog}
      />
    </AgendaWorkspaceShell>
  )
}
