import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { Button } from '@/components/ui/Button'
import {
  customersWorkspaceButtonClass,
  customersWorkspaceLinkClass,
} from '@/components/customers/CustomersWorkspaceHeader'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useCompactServicesList } from '@/hooks/useCompactServicesList'
import {
  fetchAdminStaff,
  createAdminStaff,
  updateAdminStaff,
  deleteAdminStaff,
  type AdminStaffMember,
} from '@/lib/api/admin'
import { fetchAdminServiceCategories } from '@/lib/api/admin-catalog'
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
  variant = 'default',
  children,
}: {
  label: string
  onClick: () => void
  variant?: 'default' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${adminIconBtnClass} ${variant === 'danger' ? 'hover:border-red-300 hover:text-red-600' : ''}`}
    >
      {children}
    </button>
  )
}

function IconPencil() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a1 1 0 01-.434.263l-3 1a1 1 0 01-1.263-1.263l1-3a1 1 0 01.263-.434l8.5-8.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00-1.449-.39A7 7 0 003.062 7.016l-.31-.31H5.185a.75.75 0 000-1.5H1.943a.75.75 0 00-.75.75v4.243a.75.75 0 001.5 0v-2.43l.31.31a5.5 5.5 0 008.862 3.138.75.75 0 001.449-.39z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function IconXMark() {
  return (
    <svg className="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
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

function StaffListRow({
  member,
  compact,
  categoryLabels,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDeactivate,
  onReactivate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  member: AdminStaffMember
  compact: boolean
  categoryLabels: string[]
  canMoveUp: boolean
  canMoveDown: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const categoriesTitle = categoryLabels.length > 0 ? categoryLabels.join(', ') : 'Sin categorías'

  if (compact) {
    return (
      <div className="border-b border-gold/5 px-3 py-1.5 last:border-b-0 hover:bg-gold/5">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[11px] leading-tight ${
                member.active ? 'text-charcoal' : 'text-charcoal opacity-50 line-through'
              }`}
              title={`${member.name} — ${categoriesTitle}`}
            >
              {member.name}
            </p>
            <p className="truncate text-[10px] text-charcoal-muted" title={categoriesTitle}>
              {categoryLabels.length === 0
                ? 'Sin categorías'
                : `${categoryLabels.length} categorí${categoryLabels.length === 1 ? 'a' : 'as'}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {member.active && (
              <>
                <AdminIconButton
                  label="Subir"
                  onClick={() => {
                    if (canMoveUp) onMoveUp()
                  }}
                >
                  <span className={canMoveUp ? '' : 'opacity-25'}>
                    <IconChevronUp />
                  </span>
                </AdminIconButton>
                <AdminIconButton
                  label="Bajar"
                  onClick={() => {
                    if (canMoveDown) onMoveDown()
                  }}
                >
                  <span className={canMoveDown ? '' : 'opacity-25'}>
                    <IconChevronDown />
                  </span>
                </AdminIconButton>
              </>
            )}
            {member.active ? (
              <>
                <AdminIconButton label="Editar" onClick={onEdit}>
                  <IconPencil />
                </AdminIconButton>
                <AdminIconButton label="Desactivar" variant="danger" onClick={onDeactivate}>
                  <IconTrash />
                </AdminIconButton>
                <AdminIconButton label="Eliminar" variant="danger" onClick={onDelete}>
                  <IconXMark />
                </AdminIconButton>
              </>
            ) : (
              <>
                <AdminIconButton label="Reactivar" onClick={onReactivate}>
                  <IconRefresh />
                </AdminIconButton>
                <AdminIconButton label="Editar" onClick={onEdit}>
                  <IconPencil />
                </AdminIconButton>
                <AdminIconButton label="Eliminar" variant="danger" onClick={onDelete}>
                  <IconXMark />
                </AdminIconButton>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-gold/5 px-4 py-3 last:border-b-0 hover:bg-gold/5 md:px-8">
      <div className="min-w-0">
        <p className={`break-words text-sm leading-snug ${member.active ? '' : 'opacity-50 line-through'}`}>
          {member.name}
        </p>
        {(member.phone || member.email) && (
          <p className="mt-0.5 truncate text-xs leading-snug text-charcoal-muted">
            {[member.phone, member.email].filter(Boolean).join(' · ')}
          </p>
        )}
        {categoryLabels.length > 0 ? (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-charcoal-muted" title={categoriesTitle}>
            {categoryLabels.join(' · ')}
          </p>
        ) : (
          <p className="mt-1 text-xs text-amber-800">Sin categorías asignadas</p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!member.active && (
          <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactivo</span>
        )}
        {member.active ? (
          <>
            <div className="flex items-center gap-0.5">
              <AdminIconButton
                label="Subir"
                onClick={() => {
                  if (canMoveUp) onMoveUp()
                }}
              >
                <span className={canMoveUp ? '' : 'opacity-25'}>
                  <IconChevronUp />
                </span>
              </AdminIconButton>
              <AdminIconButton
                label="Bajar"
                onClick={() => {
                  if (canMoveDown) onMoveDown()
                }}
              >
                <span className={canMoveDown ? '' : 'opacity-25'}>
                  <IconChevronDown />
                </span>
              </AdminIconButton>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5"
              onClick={onEdit}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5"
              onClick={onDeactivate}
            >
              Desactivar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5 text-red-600 hover:text-red-800"
              onClick={onDelete}
            >
              Eliminar
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5"
              onClick={onReactivate}
            >
              Reactivar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5"
              onClick={onEdit}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5 text-red-600 hover:text-red-800"
              onClick={onDelete}
            >
              Eliminar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function StaffManagementPage() {
  const { adminToken, authOk, handleLogout } = useAdminSession()
  const compact = useCompactServicesList()
  const [searchParams, setSearchParams] = useSearchParams()
  const editStaffIdParam = searchParams.get('edit')
  const openedEditFromUrl = useRef<string | null>(null)

  const [staff, setStaff] = useState<AdminStaffMember[]>([])
  const [categories, setCategories] = useState<{ id: string; nameEs: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<{
    open: boolean
    mode: ModalMode
    member: AdminStaffMember | null
  }>({ open: false, mode: 'create', member: null })

  const [confirmDelete, setConfirmDelete] = useState<AdminStaffMember | null>(null)

  const clearEditParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        if (!prev.has('edit')) return prev
        const next = new URLSearchParams(prev)
        next.delete('edit')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  const closeModal = useCallback(() => {
    setModal({ open: false, mode: 'create', member: null })
    openedEditFromUrl.current = null
    clearEditParam()
  }, [clearEditParam])

  const categoryNameById = useCallback(
    (id: string) => categories.find((c) => c.id === id)?.nameEs ?? id,
    [categories],
  )

  const loadData = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const [staffRes, catRes] = await Promise.all([
        fetchAdminStaff(adminToken),
        fetchAdminServiceCategories(adminToken),
      ])
      setStaff(staffRes.staff)
      setCategories(
        catRes.categories
          .filter((c) => c.active)
          .map((c) => ({ id: c.id, nameEs: c.nameEs })),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }, [adminToken])

  useEffect(() => {
    if (authOk) void loadData()
  }, [authOk, loadData])

  useEffect(() => {
    if (!editStaffIdParam || loading || staff.length === 0) return
    if (openedEditFromUrl.current === editStaffIdParam) return

    const member = staff.find((s) => s.id === editStaffIdParam) ?? null
    if (!member) {
      clearEditParam()
      return
    }

    openedEditFromUrl.current = editStaffIdParam
    setModal({ open: true, mode: 'edit', member })
  }, [editStaffIdParam, loading, staff, clearEditParam])

  const handleSave = async (data: {
    name: string
    role: string | null
    phone: string | null
    email: string | null
    categoryIds: string[]
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
        await updateAdminStaff(adminToken, modal.member.id, {
          name: data.name,
          role: data.role,
          phone: data.phone,
          email: data.email,
          categoryIds: data.categoryIds,
        })
      }
      closeModal()
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

      <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {loading ? (
          <p className={`${typography.caption} p-6 text-center`}>Cargando…</p>
        ) : staff.length === 0 ? (
          <p className={`${typography.body} p-8 text-center`}>
            No hay personal registrado. Añade tu primer profesional.
          </p>
        ) : (
          <div className="w-full max-w-full divide-y divide-gold/10">
            {sortedStaff.map((member, index) => (
              <StaffListRow
                key={member.id}
                member={member}
                compact={compact}
                categoryLabels={(member.categoryIds ?? []).map(categoryNameById)}
                canMoveUp={index > 0}
                canMoveDown={index < sortedStaff.length - 1}
                onMoveUp={() => void handleMoveStaff(member.id, 'up')}
                onMoveDown={() => void handleMoveStaff(member.id, 'down')}
                onEdit={() => setModal({ open: true, mode: 'edit', member })}
                onDeactivate={() => handleToggleActive(member)}
                onReactivate={() => handleToggleActive(member)}
                onDelete={() => handleDelete(member)}
              />
            ))}
          </div>
        )}
      </main>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-gold/30 bg-cream p-6 shadow-xl">
            <h2 className={`${typography.label} mb-4 text-gold`}>
              {modal.mode === 'create' ? 'Nuevo profesional' : 'Editar profesional'}
            </h2>
            <StaffForm
              key={`${modal.mode}-${modal.member?.id ?? 'new'}`}
              mode={modal.mode}
              initial={modal.member}
              categories={categories}
              onSave={handleSave}
              onCancel={closeModal}
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
