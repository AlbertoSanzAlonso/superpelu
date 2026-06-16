import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/Button'
import { PasswordInput } from '@/components/ui/Input'
import { salonStaffMembers } from '@/data/salonStaff'
import { typography } from '@/styles/typography'

const staffLoginSelectClass =
  'w-full cursor-pointer border border-gold/30 bg-cream px-4 py-3 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'

function loginModeButtonClass(active: boolean) {
  return [
    'cursor-pointer px-4 py-2 text-sm transition-colors',
    active
      ? 'border border-gold bg-gold/10 text-gold hover:border-gold/80 hover:bg-gold/15'
      : 'border border-gold/20 text-charcoal-muted hover:border-gold/50 hover:bg-gold/5 hover:text-gold',
  ].join(' ')
}

type LoginMode = 'admin' | 'staff'

export function AdminAgendaLoginForm({
  loginMode,
  onLoginModeChange,
  adminPassword,
  onAdminPasswordChange,
  staffName,
  onStaffNameChange,
  staffPassword,
  onStaffPasswordChange,
  loginError,
  loggingIn,
  onAdminLogin,
  onStaffLogin,
}: {
  loginMode: LoginMode
  onLoginModeChange: (mode: LoginMode) => void
  adminPassword: string
  onAdminPasswordChange: (v: string) => void
  staffName: string
  onStaffNameChange: (v: string) => void
  staffPassword: string
  onStaffPasswordChange: (v: string) => void
  loginError: string
  loggingIn: boolean
  onAdminLogin: (e: React.FormEvent) => void
  onStaffLogin: (e: React.FormEvent) => void
}) {
  return (
    <PageShell
      eyebrow="Agenda"
      title="Gestión del salón"
      subtitle="Acceso para el equipo: cada profesional gestiona lo suyo; administración ve todo el salón."
      brandWatermark="viewport"
    >
      <div className="mx-auto mb-8 flex max-w-md justify-center gap-2">
        <button
          type="button"
          onClick={() => onLoginModeChange('admin')}
          className={loginModeButtonClass(loginMode === 'admin')}
        >
          Administración
        </button>
        <button
          type="button"
          onClick={() => onLoginModeChange('staff')}
          className={loginModeButtonClass(loginMode === 'staff')}
        >
          Soy profesional
        </button>
      </div>

      {loginMode === 'staff' ? (
        <form
          onSubmit={onStaffLogin}
          className="mx-auto max-w-sm space-y-4 border border-gold/25 bg-cream p-8"
        >
          <label className="block text-left" htmlFor="staff-login-name">
            <span className={`${typography.label} mb-2 block`}>Profesional</span>
            <select
              id="staff-login-name"
              required
              value={staffName}
              onChange={(e) => onStaffNameChange(e.target.value)}
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
          <PasswordInput
            label="Contraseña"
            required
            value={staffPassword}
            onChange={(e) => onStaffPasswordChange(e.target.value)}
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
          onSubmit={onAdminLogin}
          className="mx-auto max-w-sm space-y-4 border border-gold/25 bg-cream p-8"
        >
          <PasswordInput
            label="Clave de administración"
            required
            value={adminPassword}
            onChange={(e) => onAdminPasswordChange(e.target.value)}
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
