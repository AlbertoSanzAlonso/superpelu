import { useEffect, useRef, useState } from 'react'
import { StaffAgendaDatePicker } from '@/components/agenda/staff/StaffAgendaDatePicker'
import { StaffAgendaDaySummary } from '@/components/agenda/staff/StaffAgendaDaySummary'
import { StaffAgendaHeader } from '@/components/agenda/staff/StaffAgendaHeader'
import { StaffAppointmentFormCollapsible } from '@/components/agenda/staff/StaffAppointmentFormCollapsible'
import { StaffAppointmentList } from '@/components/agenda/staff/StaffAppointmentList'
import { StaffTimeGrid } from '@/components/agenda/staff/StaffTimeGrid'
import { useStaffAgenda } from '@/hooks/useStaffAgenda'
import type { StaffSession } from '@/lib/staffApi'
import type { DayScheduleAppointment } from '@/types/booking'

type Props = {
  token: string
  staff: StaffSession
  onLogout: () => void
}

export function StaffAgendaPanel({ token, staff, onLogout }: Props) {
  const agenda = useStaffAgenda(token)
  const formRef = useRef<HTMLElement>(null)
  const pendingScroll = useRef(false)
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false)
  const [appointmentListOpen, setAppointmentListOpen] = useState(false)

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
    pendingScroll.current = true
  }

  useEffect(() => {
    if (!pendingScroll.current || !appointmentFormOpen) return
    pendingScroll.current = false
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [appointmentFormOpen, agenda.aptDraft.startTime, agenda.editingId])

  async function handleSubmit(e: React.FormEvent) {
    const saved = await agenda.saveAppointment(e)
    if (saved) {
      setAppointmentFormOpen(false)
      agenda.resetAppointmentForm()
    }
  }

  function handleFormToggle(open: boolean) {
    setAppointmentFormOpen(open)
    if (open && !agenda.editingId && !agenda.aptDraft.startTime) {
      agenda.resetAppointmentForm()
    }
    if (!open) {
      agenda.resetAppointmentForm()
    }
  }

  return (
    <div className="space-y-8">
      <StaffAgendaHeader staff={staff} onLogout={onLogout} />
      <StaffAgendaDatePicker date={agenda.date} onDateChange={agenda.setDate} />
      <StaffAgendaDaySummary
        date={agenda.date}
        loading={agenda.loading}
        schedule={agenda.schedule}
      />

      {agenda.error && (
        <p className="text-sm text-red-700" role="alert">
          {agenda.error}
        </p>
      )}

      {agenda.schedule?.working && (
        <>
          <StaffTimeGrid
            date={agenda.date}
            schedule={agenda.schedule}
            selectedTimes={agenda.selectedGridTimes}
            formSlotTime={
              appointmentFormOpen && !agenda.editingId ? agenda.aptDraft.startTime || null : null
            }
            onToggleSlot={agenda.toggleGridSlot}
            onSelectAppointment={(apt) => openAppointmentForm({ edit: apt })}
            onBlockSelection={() => void agenda.blockSelectedGridSlots()}
            onUnblockSelection={() => void agenda.unblockSelectedGridSlots()}
            onClearSelection={agenda.clearGridSelection}
            onCreateAppointmentFromSelection={() => {
              const time = agenda.createAppointmentFromGridSelection()
              if (time) openAppointmentForm({ time })
            }}
            actionsBusy={agenda.gridActionsBusy}
          />

          <StaffAppointmentFormCollapsible
            ref={formRef}
            open={appointmentFormOpen}
            onOpenChange={handleFormToggle}
            editingId={agenda.editingId}
            draft={agenda.aptDraft}
            services={agenda.services}
            slots={agenda.slots}
            onDraftChange={(patch) => agenda.setAptDraft((d) => ({ ...d, ...patch }))}
            onSubmit={handleSubmit}
            onCancel={() => agenda.resetAppointmentForm()}
          />

          <StaffAppointmentList
            open={appointmentListOpen}
            onOpenChange={setAppointmentListOpen}
            appointments={agenda.schedule.appointments}
            onEdit={(apt) => openAppointmentForm({ edit: apt })}
            onDelete={agenda.removeAppointment}
          />
        </>
      )}
    </div>
  )
}
