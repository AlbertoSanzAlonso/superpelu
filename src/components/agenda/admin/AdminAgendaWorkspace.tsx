import { AdminAppointmentToastStack } from '@/components/agenda/admin/AdminAppointmentToastStack'
import type { AdminAppointmentNotificationItem } from '@/lib/agenda/adminNotifications'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { WhatsAppNotifyDialog } from '@/components/ui/WhatsAppNotifyDialog'
import { NoShowContactDialog } from '@/components/ui/NoShowContactDialog'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { AdminAgendaControlBar } from '@/components/agenda/admin/AdminAgendaControlBar'
import { AdminCalendarLegend } from '@/components/agenda/admin/AdminCalendarLegend'
import { AdminSalonDayCalendar } from '@/components/agenda/admin/AdminSalonDayCalendar'
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
import { useEffect, useState } from 'react'

export function AdminAgendaWorkspace({
  selectedDate,
  onDateChange,
  adminToken,
  agenda,
  openAppointmentFromNotification,
  onLogout,
}: {
  selectedDate: string
  onDateChange: (date: string) => void
  adminToken: string
  agenda: UseAdminAgendaReturn
  openAppointmentFromNotification: (item: AdminAppointmentNotificationItem) => void
  onLogout: () => void
}) {
  const notifications = agenda.appointmentNotifications
  const totalAppointments = agenda.schedules.reduce((n, s) => n + s.appointments.length, 0)

  const activeStaffName =
    agenda.schedules.find((s) => s.staffId === agenda.activeStaffId)?.staffName ?? ''

  const appointmentModalOpen =
    agenda.appointmentFormOpen || agenda.viewingAppointment != null

  const [bukFallbackEnabled, setBukFallbackEnabled] = useState(false)
  const [bukFallbackBusy, setBukFallbackBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchBookingFallback(adminToken)
      .then((res) => {
        if (!cancelled) setBukFallbackEnabled(res.enabled)
      })
      .catch(() => {
        /* ignore: toggle stays off until retry */
      })
    return () => {
      cancelled = true
    }
  }, [adminToken])

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

  return (
    <AgendaWorkspaceShell>
      <header className="relative z-20 shrink-0 overflow-visible">
        <AdminAgendaControlBar
          date={selectedDate}
          onDateChange={onDateChange}
          appointmentCount={totalAppointments}
          schedules={agenda.schedules}
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
        {agenda.loading && agenda.schedules.length === 0 ? (
          <p className={`${typography.caption} py-8 text-center`}>Cargando agenda…</p>
        ) : (
          <>
            <AdminCalendarLegend />
            <div className="min-h-0 flex-1">
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
