import { useMemo, useState } from 'react'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { StaffAgendaControlBar } from '@/components/agenda/staff/StaffAgendaControlBar'
import { StaffAppointmentFormModal } from '@/components/agenda/staff/StaffAppointmentFormModal'
import { StaffAppointmentList } from '@/components/agenda/staff/StaffAppointmentList'
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
          onBlockSelection={() => void agenda.blockSelectedGridSlots()}
          onUnblockSelection={() => void agenda.unblockSelectedGridSlots()}
          onClearSelection={agenda.clearGridSelection}
          onCreateAppointmentFromSelection={() => {
            const time = agenda.createAppointmentFromGridSelection()
            if (time) openAppointmentForm({ time })
          }}
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
        ) : agenda.schedule && !agenda.schedule.working ? (
          <p className={`${typography.body} py-8 text-center`}>
            No trabajas este día según tu horario.
          </p>
        ) : agenda.schedule?.working ? (
          <div className="mx-auto max-w-2xl space-y-6">
            <StaffTimeGrid
              date={agenda.date}
              schedule={agenda.schedule}
              selectedTimes={agenda.selectedGridTimes}
              formSlotTime={
                appointmentFormOpen && !agenda.editingId ? agenda.aptDraft.startTime || null : null
              }
              onToggleSlot={agenda.toggleGridSlot}
              onSelectAppointment={(apt) => openAppointmentForm({ edit: apt })}
            />

            <StaffAppointmentList
              open={appointmentListOpen}
              onOpenChange={setAppointmentListOpen}
              appointments={agenda.schedule.appointments}
              onEdit={(apt) => openAppointmentForm({ edit: apt })}
              onDelete={agenda.removeAppointment}
            />
          </div>
        ) : null}
      </main>

      <StaffAppointmentFormModal
        open={appointmentFormOpen}
        editingId={agenda.editingId}
        draft={agenda.aptDraft}
        services={agenda.services}
        slots={agenda.slots}
        onDraftChange={(patch) => agenda.setAptDraft((d) => ({ ...d, ...patch }))}
        onSubmit={handleSubmit}
        onClose={closeAppointmentForm}
        onCancelAppointment={
          agenda.editingId
            ? () => void agenda.removeAppointment(agenda.editingId!).then(closeAppointmentForm)
            : undefined
        }
      />
    </AgendaWorkspaceShell>
  )
}
