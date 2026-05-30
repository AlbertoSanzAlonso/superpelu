import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AdminAgendaControlBar } from '@/components/agenda/admin/AdminAgendaControlBar'
import { AdminCalendarLegend } from '@/components/agenda/admin/AdminCalendarLegend'
import { AdminSalonDayCalendar } from '@/components/agenda/admin/AdminSalonDayCalendar'
import { StaffAgendaPanel } from '@/components/agenda/StaffAgendaPanel'
import { BlockScopeModal } from '@/components/agenda/admin/BlockScopeModal'
import { UnblockScopeModal } from '@/components/agenda/admin/UnblockScopeModal'
import { AgendaAppointmentModal } from '@/components/agenda/AgendaAppointmentModal'
import { StaffAppointmentFormModal } from '@/components/agenda/staff/StaffAppointmentFormModal'
import { useAdminAgenda } from '@/hooks/useAdminAgenda'
import { verifyAdminToken, ApiError } from '@/lib/api'
import { staffLogin, verifyStaffToken, type StaffSession } from '@/lib/staffApi'
import { useAgendaDate } from '@/hooks/useAgendaDate'
import { salonStaffMembers } from '@/data/salonStaff'
import { typography } from '@/styles/typography'

const staffLoginSelectClass =
  'w-full cursor-pointer border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

const ADMIN_TOKEN_KEY = 'superpelu-admin-token'
const STAFF_TOKEN_KEY = 'superpelu-staff-token'
const STAFF_USER_KEY = 'superpelu-staff-user'

type LoginMode = 'admin' | 'staff'

export function AdminAgendaPage() {
  const [loginMode, setLoginMode] = useState<LoginMode>('admin')
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? '')
  const [staffToken, setStaffToken] = useState(() => sessionStorage.getItem(STAFF_TOKEN_KEY) ?? '')
  const [staffUser, setStaffUser] = useState<StaffSession | null>(() => {
    const raw = sessionStorage.getItem(STAFF_USER_KEY)
    return raw ? (JSON.parse(raw) as StaffSession) : null
  })

  const [adminPassword, setAdminPassword] = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const { date: selectedDate, setDate: setSelectedDate } = useAgendaDate()

  const isAdmin = Boolean(adminToken)
  const isStaff = Boolean(staffToken && staffUser)

  const agenda = useAdminAgenda(adminToken, selectedDate)

  useEffect(() => {
    if (!staffToken) return
    verifyStaffToken(staffToken)
      .then((res) => {
        setStaffUser(res.staff)
        sessionStorage.setItem(STAFF_USER_KEY, JSON.stringify(res.staff))
      })
      .catch(() => {
        sessionStorage.removeItem(STAFF_TOKEN_KEY)
        sessionStorage.removeItem(STAFF_USER_KEY)
        setStaffToken('')
        setStaffUser(null)
      })
  }, [staffToken])

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      await verifyAdminToken(adminPassword.trim())
      sessionStorage.setItem(ADMIN_TOKEN_KEY, adminPassword.trim())
      setAdminToken(adminPassword.trim())
      setAdminPassword('')
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Clave incorrecta')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      const res = await staffLogin(staffName.trim(), staffPassword)
      sessionStorage.setItem(STAFF_TOKEN_KEY, res.token)
      sessionStorage.setItem(STAFF_USER_KEY, JSON.stringify(res.staff))
      setStaffToken(res.token)
      setStaffUser(res.staff)
      setStaffPassword('')
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'No se pudo entrar')
    } finally {
      setLoggingIn(false)
    }
  }

  function handleStaffLogout() {
    sessionStorage.removeItem(STAFF_TOKEN_KEY)
    sessionStorage.removeItem(STAFF_USER_KEY)
    setStaffToken('')
    setStaffUser(null)
  }

  function handleAdminLogout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminToken('')
  }

  if (!isAdmin && !isStaff) {
    return (
      <PageShell
        title="Agenda"
        subtitle="Acceso para el equipo: cada profesional gestiona lo suyo; administración ve todo el salón."
      >
        <div className="mx-auto mb-8 flex max-w-md justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setLoginMode('admin')
              setLoginError('')
            }}
            className={`px-4 py-2 text-sm ${
              loginMode === 'admin'
                ? 'border border-gold bg-gold/10 text-gold'
                : 'border border-gold/20 text-charcoal-muted'
            }`}
          >
            Administración
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('staff')
              setLoginError('')
            }}
            className={`px-4 py-2 text-sm ${
              loginMode === 'staff'
                ? 'border border-gold bg-gold/10 text-gold'
                : 'border border-gold/20 text-charcoal-muted'
            }`}
          >
            Soy profesional
          </button>
        </div>

        {loginMode === 'staff' ? (
          <form
            onSubmit={handleStaffLogin}
            className="mx-auto max-w-sm space-y-4 border border-gold/25 bg-cream p-8"
          >
            <label className="block text-left" htmlFor="staff-login-name">
              <span className={`${typography.label} mb-2 block`}>Profesional</span>
              <select
                id="staff-login-name"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className={staffLoginSelectClass}
                autoComplete="username"
              >
                <option value="">Elige tu nombre</option>
                {salonStaffMembers.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Contraseña"
              type="password"
              required
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              autoComplete="current-password"
            />
            {loginError && (
              <p className="text-center text-sm text-red-700" role="alert">
                {loginError}
              </p>
            )}
            <Button type="submit" variant="solid" className="w-full" disabled={loggingIn}>
              {loggingIn ? 'Entrando…' : 'Entrar a mi agenda'}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleAdminLogin}
            className="mx-auto max-w-sm space-y-4 border border-gold/25 bg-cream p-8"
          >
            <Input
              label="Clave de administración"
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              autoComplete="current-password"
            />
            {loginError && (
              <p className="text-center text-sm text-red-700" role="alert">
                {loginError}
              </p>
            )}
            <Button type="submit" variant="solid" className="w-full" disabled={loggingIn}>
              {loggingIn ? 'Comprobando…' : 'Ver agenda completa'}
            </Button>
          </form>
        )}
      </PageShell>
    )
  }

  if (isStaff && staffUser) {
    return (
      <StaffAgendaPanel token={staffToken} staff={staffUser} onLogout={handleStaffLogout} />
    )
  }

  const totalAppointments = agenda.schedules.reduce((n, s) => n + s.appointments.length, 0)
  const activeStaffName =
    agenda.schedules.find((s) => s.staffId === agenda.activeStaffId)?.staffName ?? ''

  function closeAppointmentForm() {
    agenda.setAppointmentFormOpen(false)
    agenda.resetAppointmentForm()
  }

  return (
    <AgendaWorkspaceShell>
      <header className="shrink-0">
        <AdminAgendaControlBar
          date={selectedDate}
          onDateChange={setSelectedDate}
          appointmentCount={totalAppointments}
          schedules={agenda.schedules}
          activeStaffId={agenda.activeStaffId}
          onStaffChange={agenda.selectStaff}
          onNewAppointment={() => {
            if (agenda.activeStaffId) agenda.openNewAppointmentForActiveStaff()
          }}
          onLogout={handleAdminLogout}
          selectionCount={agenda.selection?.times.size ?? 0}
          selectionSummary={agenda.selection ? agenda.selectionSummary : undefined}
          onBlockSelection={agenda.requestBlockSelectedSlots}
          onUnblockSelection={() => void agenda.unblockSelectedSlots()}
          onClearSelection={agenda.clearSelection}
          onCreateAppointmentFromSelection={agenda.createAppointmentFromSelection}
          selectionBusy={agenda.gridActionsBusy}
        />

        {agenda.error && (
          <p className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800" role="alert">
            {agenda.error}
          </p>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2">
        {agenda.loading ? (
          <p className={`${typography.caption} py-8 text-center`}>Cargando agenda…</p>
        ) : (
          <>
            <AdminCalendarLegend />
            <div className="min-h-0 flex-1">
            <AdminSalonDayCalendar
              date={selectedDate}
              schedules={agenda.schedules}
              selection={agenda.selection}
              formSlotTime={agenda.formSlotTime}
              formStaffId={agenda.formStaffId}
              onToggleSlot={agenda.toggleSlot}
              onEditAppointment={agenda.openAppointmentDetail}
            />
            </div>
          </>
        )}
      </main>

      {agenda.selection && (
        <BlockScopeModal
          open={agenda.blockModalOpen}
          anchorDate={selectedDate}
          groups={agenda.pendingBlockGroups}
          staffName={agenda.selection.staffName}
          busy={agenda.gridActionsBusy}
          onClose={agenda.cancelBlockModal}
          onConfirm={(scope, endDate) => void agenda.confirmBlockWithScope(scope, endDate)}
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
          mode={agenda.detailEditMode ? 'edit' : 'view'}
          date={selectedDate}
          staffId={agenda.viewingAppointment.staffId}
          staffName={agenda.viewingAppointment.staffName}
          staffOptions={agenda.schedules.map((s) => ({
            id: s.staffId,
            name: s.staffName,
          }))}
          onStaffChange={agenda.changeDetailStaff}
          appointment={agenda.viewingAppointment.apt}
          customerRegistered={agenda.detailCustomerRegistered}
          draft={agenda.aptDraft}
          services={agenda.services}
          slots={agenda.slots}
          onModeChange={(m) => (m === 'edit' ? agenda.startDetailEdit() : agenda.setDetailEditMode(false))}
          onDraftChange={(patch) => agenda.setAptDraft((d) => ({ ...d, ...patch }))}
          onSubmit={agenda.saveAppointment}
          onClose={agenda.closeAppointmentDetail}
          onCancelAppointment={() => agenda.cancelAppointmentById(agenda.viewingAppointment!.apt.id)}
          showCustomerHistoryLink
        />
      )}

      {agenda.activeStaffId && agenda.appointmentFormOpen && !agenda.viewingAppointment && (
        <StaffAppointmentFormModal
          open
          staffName={activeStaffName}
          editingId={null}
          draft={agenda.aptDraft}
          services={agenda.services}
          slots={agenda.slots}
          onDraftChange={(patch) => agenda.setAptDraft((d) => ({ ...d, ...patch }))}
          onSubmit={agenda.saveAppointment}
          onClose={closeAppointmentForm}
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
