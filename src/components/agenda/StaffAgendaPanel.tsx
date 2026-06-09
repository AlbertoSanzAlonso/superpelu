import { useMemo, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NoShowContactDialog } from '@/components/ui/NoShowContactDialog'
import { canMarkAppointmentNoShow, APPOINTMENT_STATUS_NO_SHOW } from '@/lib/appointmentNoShow'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { StaffAgendaControlBar } from '@/components/agenda/staff/StaffAgendaControlBar'
import { StaffAppointmentFormModal } from '@/components/agenda/staff/StaffAppointmentFormModal'
import { StaffAppointmentList } from '@/components/agenda/staff/StaffAppointmentList'
import { CancelAppointmentScopeModal } from '@/components/agenda/CancelAppointmentScopeModal'
import { BlockCreateNoteModal } from '@/components/agenda/BlockCreateNoteModal'
import { BlockDetailModal } from '@/components/agenda/BlockDetailModal'
import { StaffTimeGrid } from '@/components/agenda/staff/StaffTimeGrid'
import { useStaffAgenda } from '@/hooks/useStaffAgenda'
import { buildStaffDayGrid, summarizeGridSelection } from '@/lib/timeGrid'
import type { StaffSession } from '@/lib/staffApi'
import type { DayScheduleAppointment } from '@/types/booking'
import { typography } from '@/styles/typography'

type Props = {
  token: string
  staff: StaffSession
  onLogout: () => void
}

export function StaffAgendaPanel({ token, staff, onLogout }: Props) {
  const agenda = useStaffAgenda(token)
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false)
  const [appointmentListOpen, setAppointmentListOpen] = useState(false)

  const selectionSummary = useMemo(() => {
    if (!agenda.schedule) return null
    const cells = buildStaffDayGrid(agenda.schedule, agenda.date)
    return summarizeGridSelection(agenda.selectedGridTimes, cells)
  }, [agenda.schedule, agenda.date, agenda.selectedGridTimes])

  const appointmentCount = agenda.schedule?.appointments.length ?? 0

  const editingAppointment = useMemo(
    () => agenda.schedule?.appointments.find((a) => a.id === agenda.editingId) ?? null,
    [agenda.schedule, agenda.editingId],
  )

  function closeAppointmentForm() {
    setAppointmentFormOpen(false)
    agenda.resetAppointmentForm()
  }

  function openAppointmentForm(options?: { time?: string; edit?: DayScheduleAppointment }) {
    agenda.clearGridSelection()
    if (options?.edit) {
      agenda.startEditAppointment(options.edit)
    } else if (options?.time) {
      agenda.selectFreeSlot(options.time)
    } else {
      agenda.resetAppointmentForm()
    }
    setAppointmentFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    const saved = await agenda.saveAppointment(e)
    if (saved) {
      closeAppointmentForm()
    }
  }

  return (
    <AgendaWorkspaceShell>
      <header className="shrink-0">
        <StaffAgendaControlBar
          staff={staff}
          date={agenda.date}
          onDateChange={agenda.setDate}
          appointmentCount={appointmentCount}
          onNewAppointment={() => openAppointmentForm()}
          onLogout={onLogout}
          selectionCount={agenda.selectedGridTimes.size}
          selectionSummary={agenda.selectedGridTimes.size > 0 ? selectionSummary ?? undefined : undefined}
          onBlockSelection={agenda.requestBlockSelectedGridSlots}
          onUnblockSelection={() => void agenda.unblockSelectedGridSlots()}
          onCreateAppointmentFromSelection={() => {
            const time = agenda.createAppointmentFromGridSelection()
            if (time) openAppointmentForm({ time })
          }}
          onClearSelection={agenda.clearGridSelection}
          selectionBusy={agenda.gridActionsBusy}
        />

        {agenda.error && (
          <p
            className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800"
            role="alert"
          >
            {agenda.error}
          </p>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {agenda.loading ? (
          <p className={`${typography.caption} py-8 text-center`}>Cargando agenda…</p>
        ) : agenda.schedule ? (
          <div className="mx-auto max-w-2xl space-y-6">
            {!agenda.schedule.working && (
              <p className={`${typography.caption} text-center text-charcoal-muted`}>
                No trabajas este día según tu horario.
              </p>
            )}
            <StaffTimeGrid
              date={agenda.date}
              schedule={agenda.schedule}
              selectedTimes={agenda.selectedGridTimes}
              formSlotTime={
                appointmentFormOpen && !agenda.editingId ? agenda.aptDraft.startTime || null : null
              }
              onToggleSlot={agenda.toggleGridSlot}
              onSelectAppointment={(apt) => openAppointmentForm({ edit: apt })}
              onOpenBlock={agenda.openBlockDetail}
            />

            <StaffAppointmentList
              open={appointmentListOpen}
              onOpenChange={setAppointmentListOpen}
              appointments={agenda.schedule.appointments}
              onEdit={(apt) => openAppointmentForm({ edit: apt })}
              onDelete={agenda.removeAppointment}
            />
          </div>
        ) : (
          <p className={`${typography.caption} py-8 text-center`}>Sin datos de agenda.</p>
        )}
      </main>

      <StaffAppointmentFormModal
        open={appointmentFormOpen}
        date={agenda.date}
        editingId={agenda.editingId}
        draft={agenda.aptDraft}
        services={agenda.services}
        slots={agenda.slots}
        onDraftChange={(patch) => agenda.setAptDraft((d) => ({ ...d, ...patch }))}
        onSubmit={handleSubmit}
        onClose={closeAppointmentForm}
        onCancelAppointment={
          agenda.editingId
            ? () => agenda.removeAppointment(agenda.editingId!, closeAppointmentForm)
            : undefined
        }
        onMarkNoShow={
          agenda.editingId ? () => agenda.markNoShowById(agenda.editingId!) : undefined
        }
        canMarkNoShow={
          editingAppointment
            ? canMarkAppointmentNoShow(
                agenda.date,
                editingAppointment.startTime,
                editingAppointment.status,
              )
            : false
        }
        isNoShow={editingAppointment?.status === APPOINTMENT_STATUS_NO_SHOW}
      />

      <NoShowContactDialog
        open={agenda.noShowDialogOpen}
        busy={agenda.noShowBusy}
        onClose={agenda.closeNoShowDialog}
        onMarkContacted={() => void agenda.persistNoShow(false)}
        onSendWhatsApp={() => void agenda.persistNoShow(true)}
      />

      <BlockCreateNoteModal
        open={agenda.blockCreateModalOpen}
        date={agenda.date}
        staffName={staff.name}
        groups={agenda.pendingBlockGroups}
        busy={agenda.gridActionsBusy}
        onClose={agenda.cancelBlockCreateModal}
        onConfirm={(note) => void agenda.confirmBlockWithNote(note)}
      />

      {agenda.viewingBlock && (
        <BlockDetailModal
          open
          date={agenda.date}
          staffName={staff.name}
          block={agenda.viewingBlock}
          series={agenda.viewingBlockSeries}
          seriesLoading={agenda.viewingBlockSeriesLoading}
          busy={agenda.blockDetailBusy}
          onClose={agenda.closeBlockDetail}
          onSave={agenda.saveBlockNote}
          onDelete={agenda.deleteViewingBlock}
        />
      )}

      {agenda.cancelScopeSeries && (
        <CancelAppointmentScopeModal
          open={agenda.cancelScopeOpen}
          series={agenda.cancelScopeSeries}
          viewDate={agenda.date}
          action="delete"
          onClose={agenda.closeCancelScopeModal}
          onConfirm={agenda.confirmRemoveScope}
        />
      )}

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
