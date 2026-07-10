import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { Button } from '@/components/ui/Button'
import {
  customersWorkspaceButtonClass,
  customersWorkspaceLinkClass,
} from '@/components/customers/CustomersWorkspaceHeader'
import { useAdminSession } from '@/hooks/useAdminSession'
import {
  fetchAdminStaff,
  createAdminStaff,
  updateAdminStaff,
  deleteAdminStaff,
  type AdminStaffMember,
} from '@/lib/api/admin'
import { ApiError } from '@/lib/api/request'
import { typography } from '@/styles/typography'
import { StaffForm } from '@/components/admin/StaffForm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type ModalMode = 'create' | 'edit'

const tagClass =
  'inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium'

const adminIconBtnClass =
  'flex size-6 shrink-0 items-center justify-center border border-gold/25 bg-cream text-charcoal-muted hover:border-gold hover:text-gold'

function sortStaffForDisplay(list: AdminStaffMember[]) {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
}

function nextSortOrderForStaff(staff: AdminStaffMember[]) {
  if (staff.length === 0) return 0
  return Math.max(...staff.map((member) => member.sortOrder)) + 10
}

function AdminIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={adminIconBtnClass}
    >
      {children}
    </button>
  )
}

function IconChevronUp() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10 3a.75.75 0 01.53.22l4.5 4.5a.75.75 0 11-1.06 1.06L10 5.06 6.03 9.03a.75.75 0 11-1.06-1.06l4.5-4.5A.75.75 0 0110 3z" clipRule="evenodd" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10 17a.75.75 0 01-.53-.22l-4.5-4.5a.75.75 0 111.06-1.06L10 14.94l3.97-3.97a.75.75 0 111.06 1.06l-4.5 4.5A.75.75 0 0110 17z" clipRule="evenodd" />
    </svg>
  )
}

export function StaffManagementPage() {
  const { adminToken, authOk, handleLogout } = useAdminSession()

  const [staff, setStaff] = useState<AdminStaffMember[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<{
    open: boolean
    mode: ModalMode
    member: AdminStaffMember | null
  }>({ open: false, mode: 'create', member: null })

  const [confirmDelete, setConfirmDelete] = useState<AdminStaffMember | null>(null)

  const loadData = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminStaff(adminToken)
      setStaff(res.staff)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }, [adminToken])

  useEffect(() => {
    if (authOk) void loadData()
  }, [authOk, loadData])

  const handleSave = async (data: {
    name: string
    role: string | null
    phone: string | null
    email: string | null
    password: string
  }) => {
    if (!adminToken) return
    setBusy(true)
    try {
      if (modal.mode === 'create') {
        await createAdminStaff(adminToken, {
          ...data,
          sortOrder: nextSortOrderForStaff(staff),
        })
      } else if (modal.member) {
        const patch: Record<string, unknown> = {
          name: data.name,
          role: data.role,
          phone: data.phone,
          email: data.email,
        }
        if (data.password) patch.password = data.password
        await updateAdminStaff(adminToken, modal.member.id, patch)
      }
      setModal({ open: false, mode: 'create', member: null })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const handleMoveStaff = async (staffId: string, direction: 'up' | 'down') => {
    if (!adminToken) return
    const ordered = sortStaffForDisplay(staff)
    const index = ordered.findIndex((member) => member.id === staffId)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const nextOrder = [...ordered]
    const [moved] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, moved)

    setBusy(true)
    setError('')
    try {
      await Promise.all(
        nextOrder.map((member, orderIndex) =>
          updateAdminStaff(adminToken, member.id, { sortOrder: orderIndex * 10 }),
        ),
      )
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reordenar')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (member: AdminStaffMember) => {
    if (!adminToken) return
    setConfirmDelete(member)
  }

  const handleConfirmDelete = async () => {
    if (!adminToken || !confirmDelete) return
    setConfirmDelete(null)
    setBusy(true)
    try {
      await deleteAdminStaff(adminToken, confirmDelete.id)
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleActive = async (member: AdminStaffMember) => {
    if (!adminToken) return
    setBusy(true)
    try {
      await updateAdminStaff(adminToken, member.id, { active: !member.active })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar estado')
    } finally {
      setBusy(false)
    }
  }

  if (authOk === false) return <Navigate to="/agenda" replace />
  if (authOk === null) {
    return (
      <AgendaWorkspaceShell>
        <div className="flex flex-1 items-center justify-center">
          <p className={typography.caption}>Comprobando acceso…</p>
        </div>
      </AgendaWorkspaceShell>
    )
  }

  const sortedStaff = sortStaffForDisplay(staff)

  return (
    <AgendaWorkspaceShell>
      <header className="shrink-0 border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px]">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/agenda" className={customersWorkspaceLinkClass}>
            ← Agenda
          </Link>
          <h1 className={`${typography.label} min-w-0 truncate text-gold`}>Personal</h1>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link to="/servicios" className={customersWorkspaceLinkClass}>
              Servicios
            </Link>
            <Link to="/horarios" className={customersWorkspaceLinkClass}>
              Horarios
            </Link>
            <Link to="/clientes" className={customersWorkspaceLinkClass}>
              Clientes
            </Link>
            <Link to="/stats" className={customersWorkspaceLinkClass}>
              Stats
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={customersWorkspaceButtonClass}
              onClick={handleLogout}
            >
              Salir
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="solid"
            size="sm"
            className="h-9 shrink-0 px-3 py-0"
            onClick={() => setModal({ open: true, mode: 'create', member: null })}
          >
            + Nuevo profesional
          </Button>
        </div>
      </header>

      {error && (
        <p className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800" role="alert">
          {error}
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className={`${typography.caption} p-6 text-center`}>Cargando…</p>
        ) : staff.length === 0 ? (
          <p className={`${typography.body} p-8 text-center`}>
            No hay personal registrado. Añade tu primer profesional.
          </p>
        ) : (
          <div className="divide-y divide-gold/10">
            {sortedStaff.map((member, index) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gold/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${member.active ? '' : 'opacity-50 line-through'}`}>
                      {member.name}
                    </span>
                    {member.role && (
                      <span className="text-xs text-charcoal-muted">{member.role}</span>
                    )}
                    {!member.active && (
                      <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactivo</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-charcoal-muted tabular-nums">
                    {member.phone && <span>{member.phone}</span>}
                    {member.email && <span>{member.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {member.active && (
                    <div className="flex items-center gap-0.5">
                      <AdminIconButton
                        label="Subir"
                        onClick={() => {
                          if (index > 0) void handleMoveStaff(member.id, 'up')
                        }}
                      >
                        <span className={index > 0 ? '' : 'opacity-25'}>
                          <IconChevronUp />
                        </span>
                      </AdminIconButton>
                      <AdminIconButton
                        label="Bajar"
                        onClick={() => {
                          if (index < sortedStaff.length - 1) void handleMoveStaff(member.id, 'down')
                        }}
                      >
                        <span className={index < sortedStaff.length - 1 ? '' : 'opacity-25'}>
                          <IconChevronDown />
                        </span>
                      </AdminIconButton>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs !px-2 !py-0.5"
                    onClick={() => setModal({ open: true, mode: 'edit', member })}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs !px-2 !py-0.5"
                    onClick={() => handleToggleActive(member)}
                  >
                    {member.active ? 'Desactivar' : 'Reactivar'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs !px-2 !py-0.5 text-red-600 hover:text-red-800"
                    onClick={() => handleDelete(member)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-gold/30 bg-cream p-6 shadow-xl">
            <h2 className={`${typography.label} mb-4 text-gold`}>
              {modal.mode === 'create' ? 'Nuevo profesional' : 'Editar profesional'}
            </h2>
            <StaffForm
              mode={modal.mode}
              initial={modal.member}
              onSave={handleSave}
              onCancel={() => setModal({ open: false, mode: 'create', member: null })}
              busy={busy}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete != null}
        title={`Eliminar a ${confirmDelete?.name ?? ''}`}
        message={`¿Estás seguro de eliminar a ${confirmDelete?.name ?? ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        busy={busy}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </AgendaWorkspaceShell>
  )
}
