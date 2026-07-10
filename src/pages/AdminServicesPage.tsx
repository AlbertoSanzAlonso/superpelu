import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { Button } from '@/components/ui/Button'
import { customersWorkspaceButtonClass, customersWorkspaceLinkClass } from '@/components/customers/CustomersWorkspaceHeader'
import { useAdminSession } from '@/hooks/useAdminSession'
import { useCompactServicesList } from '@/hooks/useCompactServicesList'
import {
  fetchAdminServices,
  fetchAdminServiceCategories,
  createAdminService,
  updateAdminService,
  deleteAdminService,
  hardDeleteAdminService,
  createAdminServiceCategory,
  updateAdminServiceCategory,
  deleteAdminServiceCategory,
  type AdminService,
  type AdminServiceCategory,
} from '@/lib/api/admin-catalog'
import { ApiError } from '@/lib/api/request'
import { typography } from '@/styles/typography'
import { CategoryForm, type CategoryFormData } from '@/components/admin/CategoryForm'
import { ServiceForm, type ServiceFormData } from '@/components/admin/ServiceForm'
import { ServiceRemoveModal, type ServiceRemoveAction } from '@/components/admin/ServiceRemoveModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatPatternSummary, isSegmentedPattern } from '@/lib/booking/servicePattern'

type ModalMode = 'create' | 'edit'

type CategoryModalState = {
  open: boolean
  mode: ModalMode
  category: AdminServiceCategory | null
}

type ServiceModalState = {
  open: boolean
  mode: ModalMode
  service: AdminService | null
  categoryId: string
}

const tagClass =
  'inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium'

const adminIconBtnClass =
  'flex size-6 shrink-0 items-center justify-center border border-gold/25 bg-cream text-charcoal-muted hover:border-gold hover:text-gold'

function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() || text
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
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
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

function sortServicesForDisplay(list: AdminService[]) {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.nameEs.localeCompare(b.nameEs, 'es'))
}

function nextSortOrderForCategory(services: AdminService[], categoryId: string | null) {
  const inCategory = services.filter((service) => service.categoryId === categoryId)
  if (inCategory.length === 0) return 0
  return Math.max(...inCategory.map((service) => service.sortOrder)) + 10
}

function sortCategoriesForDisplay(list: AdminServiceCategory[]) {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.nameEs.localeCompare(b.nameEs, 'es'))
}

function nextSortOrderForCategories(categories: AdminServiceCategory[]) {
  if (categories.length === 0) return 0
  return Math.max(...categories.map((category) => category.sortOrder)) + 10
}

function ServiceListRow({
  svc,
  compact,
  onEdit,
  onDeactivate,
  onReactivate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: {
  svc: AdminService
  compact: boolean
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}) {
  const nameEs = firstLine(svc.nameEs)

  if (compact) {
    return (
      <div className="border-b border-gold/5 px-3 py-1.5 last:border-b-0 hover:bg-gold/5">
        <div className="flex items-center gap-1.5">
          <p
            className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${
              svc.active ? 'text-charcoal' : 'text-charcoal opacity-50 line-through'
            }`}
            title={nameEs}
          >
            {nameEs}
          </p>
          <div className="flex shrink-0 items-center gap-0.5">
            {svc.active && (onMoveUp || onMoveDown) && (
              <>
                <AdminIconButton
                  label="Subir"
                  onClick={() => {
                    if (canMoveUp) onMoveUp?.()
                  }}
                >
                  <span className={canMoveUp ? '' : 'opacity-25'}>
                    <IconChevronUp />
                  </span>
                </AdminIconButton>
                <AdminIconButton
                  label="Bajar"
                  onClick={() => {
                    if (canMoveDown) onMoveDown?.()
                  }}
                >
                  <span className={canMoveDown ? '' : 'opacity-25'}>
                    <IconChevronDown />
                  </span>
                </AdminIconButton>
              </>
            )}
            {svc.active ? (
              <>
                <AdminIconButton label="Editar" onClick={onEdit}>
                  <IconPencil />
                </AdminIconButton>
                <AdminIconButton label="Desactivar" variant="danger" onClick={onDeactivate}>
                  <IconTrash />
                </AdminIconButton>
              </>
            ) : (
              <AdminIconButton label="Reactivar" onClick={onReactivate}>
                <IconRefresh />
              </AdminIconButton>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-gold/5 px-4 py-3 last:border-b-0 hover:bg-gold/5 md:px-8">
      <div className="min-w-0">
        <p className={`break-words text-sm leading-snug ${svc.active ? '' : 'opacity-50 line-through'}`}>
          {nameEs}
        </p>
        {svc.nameEn && (
          <p className="mt-0.5 break-words text-xs leading-snug text-charcoal-muted">
            {firstLine(svc.nameEn)}
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs tabular-nums text-charcoal-muted">
          {svc.bookingPattern && isSegmentedPattern(svc.bookingPattern)
            ? formatPatternSummary(svc.bookingPattern)
            : `${svc.durationMinutes} min`}
        </span>
        {svc.bookableOnline && (
          <span className={`${tagClass} bg-green-100 text-green-800`}>Online</span>
        )}
        {!svc.active && (
          <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactivo</span>
        )}
        {svc.active ? (
          <>
            {(onMoveUp || onMoveDown) && (
              <div className="flex items-center gap-0.5">
                <AdminIconButton
                  label="Subir"
                  onClick={() => {
                    if (canMoveUp) onMoveUp?.()
                  }}
                >
                  <span className={canMoveUp ? '' : 'opacity-25'}>
                    <IconChevronUp />
                  </span>
                </AdminIconButton>
                <AdminIconButton
                  label="Bajar"
                  onClick={() => {
                    if (canMoveDown) onMoveDown?.()
                  }}
                >
                  <span className={canMoveDown ? '' : 'opacity-25'}>
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
              onClick={onEdit}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5 text-red-600 hover:text-red-800"
              onClick={onDeactivate}
            >
              Desactivar
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs !px-2 !py-0.5"
            onClick={onReactivate}
          >
            Reactivar
          </Button>
        )}
      </div>
    </div>
  )
}

function CategoryListRow({
  cat,
  serviceCount,
  compact,
  expanded,
  onToggle,
  onEdit,
  onDeactivate,
  onReactivate,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: {
  cat: AdminServiceCategory
  serviceCount: number
  compact: boolean
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
}) {
  const nameEs = firstLine(cat.nameEs)

  if (compact) {
    return (
      <div className="border-b border-gold/10">
        <div className="flex items-center gap-1 px-3 py-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left hover:bg-gold/5"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            <span
              className="shrink-0 text-[10px] text-charcoal-muted transition-transform"
              style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
              aria-hidden
            >
              ▶
            </span>
            <p
              className={`min-w-0 flex-1 truncate text-[11px] font-medium leading-tight ${
                cat.active ? 'text-charcoal' : 'text-charcoal opacity-50 line-through'
              }`}
              title={nameEs}
            >
              {nameEs}
            </p>
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            {cat.active && (onMoveUp || onMoveDown) && (
              <>
                <AdminIconButton
                  label="Subir categoría"
                  onClick={() => {
                    if (canMoveUp) onMoveUp?.()
                  }}
                >
                  <span className={canMoveUp ? '' : 'opacity-25'}>
                    <IconChevronUp />
                  </span>
                </AdminIconButton>
                <AdminIconButton
                  label="Bajar categoría"
                  onClick={() => {
                    if (canMoveDown) onMoveDown?.()
                  }}
                >
                  <span className={canMoveDown ? '' : 'opacity-25'}>
                    <IconChevronDown />
                  </span>
                </AdminIconButton>
              </>
            )}
            {cat.active ? (
              <>
                <AdminIconButton label="Editar categoría" onClick={onEdit}>
                  <IconPencil />
                </AdminIconButton>
                <AdminIconButton label="Desactivar categoría" variant="danger" onClick={onDeactivate}>
                  <IconTrash />
                </AdminIconButton>
              </>
            ) : (
              <AdminIconButton label="Reactivar categoría" onClick={onReactivate}>
                <IconRefresh />
              </AdminIconButton>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-gold/10">
      <button
        type="button"
        className="flex w-full cursor-pointer items-start gap-2 px-4 py-3 text-left hover:bg-gold/5"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span
          className="mt-0.5 shrink-0 text-xs text-charcoal-muted transition-transform"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          aria-hidden
        >
          ▶
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`break-words text-sm font-medium leading-snug ${
              cat.active ? 'text-charcoal' : 'text-charcoal opacity-50 line-through'
            }`}
          >
            {nameEs}
          </p>
          {cat.nameEn && (
            <p className="mt-0.5 break-words text-xs leading-snug text-charcoal-muted">
              {firstLine(cat.nameEn)}
            </p>
          )}
          <p className="mt-1 text-xs tabular-nums text-charcoal-muted">
            {serviceCount} servicio{serviceCount === 1 ? '' : 's'}
          </p>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-2 border-t border-gold/5 bg-cream/20 px-4 py-2">
        {cat.active ? (
          <>
            {(onMoveUp || onMoveDown) && (
              <div className="flex items-center gap-0.5">
                <AdminIconButton
                  label="Subir categoría"
                  onClick={() => {
                    if (canMoveUp) onMoveUp?.()
                  }}
                >
                  <span className={canMoveUp ? '' : 'opacity-25'}>
                    <IconChevronUp />
                  </span>
                </AdminIconButton>
                <AdminIconButton
                  label="Bajar categoría"
                  onClick={() => {
                    if (canMoveDown) onMoveDown?.()
                  }}
                >
                  <span className={canMoveDown ? '' : 'opacity-25'}>
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
              onClick={onEdit}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5 text-red-600 hover:text-red-800"
              onClick={onDeactivate}
            >
              Desactivar
            </Button>
          </>
        ) : (
          <>
            <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactiva</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs !px-2 !py-0.5"
              onClick={onReactivate}
            >
              Reactivar
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function AdminServicesPage() {
  const { adminToken, authOk, handleLogout } = useAdminSession()
  const compact = useCompactServicesList()

  const [services, setServices] = useState<AdminService[]>([])
  const [categories, setCategories] = useState<AdminServiceCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [categoryModal, setCategoryModal] = useState<CategoryModalState>({
    open: false,
    mode: 'create',
    category: null,
  })
  const [serviceModal, setServiceModal] = useState<ServiceModalState>({
    open: false,
    mode: 'create',
    service: null,
    categoryId: '',
  })

  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void | Promise<void>
  } | null>(null)

  const [serviceRemoveModal, setServiceRemoveModal] = useState<{
    id: string
    name: string
  } | null>(null)

  const loadData = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const [svcRes, catRes] = await Promise.all([
        fetchAdminServices(adminToken),
        fetchAdminServiceCategories(adminToken),
      ])
      setServices(svcRes.services)
      setCategories(catRes.categories)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }, [adminToken])

  useEffect(() => {
    if (authOk) void loadData()
  }, [authOk, loadData])

  const handleSaveCategory = async (data: CategoryFormData) => {
    if (!adminToken) return
    setBusy(true)
    try {
      const current = categoryModal.category
      if (categoryModal.mode === 'create') {
        await createAdminServiceCategory(adminToken, {
          ...data,
          sortOrder: nextSortOrderForCategories(categories),
        })
      } else if (current) {
        await updateAdminServiceCategory(adminToken, current.id, {
          nameEs: data.nameEs,
          nameEn: data.nameEn,
        })
      }
      setCategoryModal({ open: false, mode: 'create', category: null })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    if (!adminToken) return
    const ordered = sortCategoriesForDisplay(categories)
    const index = ordered.findIndex((category) => category.id === categoryId)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const nextOrder = [...ordered]
    const [moved] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, moved)

    setBusy(true)
    setError('')
    try {
      await Promise.all(
        nextOrder.map((category, orderIndex) =>
          updateAdminServiceCategory(adminToken, category.id, { sortOrder: orderIndex * 10 }),
        ),
      )
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reordenar')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteCategory = (id: string) => {
    if (!adminToken) return
    setConfirmAction({
      title: 'Desactivar categoría',
      message: '¿Estás seguro de desactivar esta categoría? Los servicios se mantendrán.',
      onConfirm: async () => {
        setConfirmAction(null)
        setBusy(true)
        try {
          await deleteAdminServiceCategory(adminToken, id)
          await loadData()
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Error al desactivar')
        } finally {
          setBusy(false)
        }
      },
    })
  }

  const handleReactivateCategory = async (id: string) => {
    if (!adminToken) return
    setBusy(true)
    try {
      await updateAdminServiceCategory(adminToken, id, { active: true })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al reactivar')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveService = async (data: ServiceFormData) => {
    if (!adminToken) return
    setBusy(true)
    try {
      const current = serviceModal.service
      const categoryChanged =
        serviceModal.mode === 'edit' && current != null && current.categoryId !== data.categoryId
      const sortOrder =
        serviceModal.mode === 'edit' && current != null && !categoryChanged
          ? current.sortOrder
          : nextSortOrderForCategory(services, data.categoryId)

      if (serviceModal.mode === 'create') {
        await createAdminService(adminToken, { ...data, sortOrder })
      } else if (current) {
        await updateAdminService(adminToken, current.id, { ...data, sortOrder })
      }
      setServiceModal({ open: false, mode: 'create', service: null, categoryId: '' })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const handleMoveServiceInCategory = async (
    categoryId: string,
    serviceId: string,
    direction: 'up' | 'down',
  ) => {
    if (!adminToken) return
    const ordered = sortServicesForDisplay(servicesForCategory(categoryId))
    const index = ordered.findIndex((service) => service.id === serviceId)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return

    const nextOrder = [...ordered]
    const [moved] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, moved)

    setBusy(true)
    setError('')
    try {
      await Promise.all(
        nextOrder.map((service, orderIndex) =>
          updateAdminService(adminToken, service.id, { sortOrder: orderIndex * 10 }),
        ),
      )
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reordenar')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveService = (service: AdminService) => {
    setServiceRemoveModal({ id: service.id, name: firstLine(service.nameEs) })
  }

  const handleConfirmRemoveService = async (action: ServiceRemoveAction) => {
    if (!adminToken || !serviceRemoveModal) return
    setBusy(true)
    setError('')
    try {
      if (action === 'deactivate') {
        await deleteAdminService(adminToken, serviceRemoveModal.id)
      } else {
        await hardDeleteAdminService(adminToken, serviceRemoveModal.id)
      }
      setServiceRemoveModal(null)
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al eliminar')
    } finally {
      setBusy(false)
    }
  }

  const handleReactivateService = async (id: string) => {
    if (!adminToken) return
    setBusy(true)
    try {
      await updateAdminService(adminToken, id, { active: true })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al reactivar')
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

  const servicesForCategory = (categoryId: string) =>
    sortServicesForDisplay(services.filter((s) => s.categoryId === categoryId))

  const uncategorizedServices = sortServicesForDisplay(services.filter((s) => !s.categoryId))

  const sortedCategories = sortCategoriesForDisplay(categories)

  return (
    <AgendaWorkspaceShell>
      <header className="shrink-0 border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px]">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/agenda" className={customersWorkspaceLinkClass}>
            ← Agenda
          </Link>
          <h1 className={`${typography.label} min-w-0 truncate text-gold`}>Servicios</h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Link to="/personal" className={customersWorkspaceLinkClass}>
            Personal
          </Link>
          <Link to="/horarios" className={customersWorkspaceLinkClass}>
            Horarios
          </Link>
          <Link to="/clientes" className={customersWorkspaceLinkClass}>
            Clientes
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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="solid"
            size="sm"
            className="h-9 shrink-0 px-3 py-0"
            onClick={() => setCategoryModal({ open: true, mode: 'create', category: null })}
          >
            Nueva categoría
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 px-3 py-0"
            onClick={() => setServiceModal({ open: true, mode: 'create', service: null, categoryId: '' })}
          >
            Nuevo servicio
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
        ) : (
          <div className="services-admin-list w-full max-w-full divide-y divide-gold/10">
            {sortedCategories.map((cat, index) => {
              const catServices = servicesForCategory(cat.id)
              const expanded = expandedCategoryId === cat.id
              return (
                <div key={cat.id}>
                  <CategoryListRow
                    cat={cat}
                    serviceCount={catServices.length}
                    compact={compact}
                    expanded={expanded}
                    canMoveUp={index > 0}
                    canMoveDown={index < sortedCategories.length - 1}
                    onMoveUp={() => void handleMoveCategory(cat.id, 'up')}
                    onMoveDown={() => void handleMoveCategory(cat.id, 'down')}
                    onToggle={() => setExpandedCategoryId(expanded ? null : cat.id)}
                    onEdit={() => setCategoryModal({ open: true, mode: 'edit', category: cat })}
                    onDeactivate={() => handleDeleteCategory(cat.id)}
                    onReactivate={() => handleReactivateCategory(cat.id)}
                  />

                  {expanded && (
                    <div className="border-t border-gold/5 bg-cream/30">
                      {catServices.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-charcoal-muted sm:px-8">
                          No hay servicios en esta categoría.
                        </p>
                      ) : (
                        catServices.map((svc, index) => (
                          <ServiceListRow
                            key={svc.id}
                            svc={svc}
                            compact={compact}
                            canMoveUp={index > 0}
                            canMoveDown={index < catServices.length - 1}
                            onMoveUp={() => void handleMoveServiceInCategory(cat.id, svc.id, 'up')}
                            onMoveDown={() => void handleMoveServiceInCategory(cat.id, svc.id, 'down')}
                            onEdit={() =>
                              setServiceModal({
                                open: true,
                                mode: 'edit',
                                service: svc,
                                categoryId: svc.categoryId ?? '',
                              })
                            }
                            onDeactivate={() => handleRemoveService(svc)}
                            onReactivate={() => handleReactivateService(svc.id)}
                          />
                        ))
                      )}
                      <div className="px-4 py-2 sm:px-8">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs !px-2 !py-0.5"
                          onClick={() =>
                            setServiceModal({
                              open: true,
                              mode: 'create',
                              service: null,
                              categoryId: cat.id,
                            })
                          }
                        >
                          + Añadir servicio
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {uncategorizedServices.length > 0 && (
              <div className="border-b border-gold/10">
                <div className="bg-gold/5 px-3 py-2">
                  <p className={`font-medium text-charcoal ${compact ? 'text-[11px]' : 'text-sm'}`}>
                    Sin categoría
                  </p>
                  {!compact && (
                    <p className="mt-1 text-xs tabular-nums text-charcoal-muted">
                      {uncategorizedServices.length} servicio{uncategorizedServices.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                {uncategorizedServices.map((svc) => (
                  <ServiceListRow
                    key={svc.id}
                    svc={svc}
                    compact={compact}
                    onEdit={() =>
                      setServiceModal({ open: true, mode: 'edit', service: svc, categoryId: '' })
                    }
                    onDeactivate={() => handleRemoveService(svc)}
                    onReactivate={() => handleReactivateService(svc.id)}
                  />
                ))}
              </div>
            )}

            {sortedCategories.length === 0 && services.length === 0 && (
              <p className={`${typography.body} p-8 text-center`}>
                No hay servicios ni categorías. Crea tu primera categoría o servicio.
              </p>
            )}
          </div>
        )}
      </main>

      {categoryModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md border border-gold/30 bg-cream p-6 shadow-xl">
            <h2 className={`${typography.label} mb-4 text-gold`}>
              {categoryModal.mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
            </h2>
            <CategoryForm
              mode={categoryModal.mode}
              initial={categoryModal.category}
              onSave={handleSaveCategory}
              onCancel={() => setCategoryModal({ open: false, mode: 'create', category: null })}
              busy={busy}
            />
          </div>
        </div>
      )}

      {serviceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg border border-gold/30 bg-cream p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className={`${typography.label} mb-4 text-gold`}>
              {serviceModal.mode === 'create' ? 'Nuevo servicio' : 'Editar servicio'}
            </h2>
            <ServiceForm
              mode={serviceModal.mode}
              initial={serviceModal.service}
              categoryId={serviceModal.categoryId}
              categories={categories}
              onSave={handleSaveService}
              onCancel={() => setServiceModal({ open: false, mode: 'create', service: null, categoryId: '' })}
              busy={busy}
            />
          </div>
        </div>
      )}

      <ServiceRemoveModal
        open={serviceRemoveModal != null}
        serviceName={serviceRemoveModal?.name ?? ''}
        busy={busy}
        onClose={() => setServiceRemoveModal(null)}
        onConfirm={(action) => void handleConfirmRemoveService(action)}
      />

      <ConfirmDialog
        open={confirmAction != null}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.title.startsWith('Desactivar') ? 'Desactivar' : 'Confirmar'}
        destructive
        busy={busy}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
      />
    </AgendaWorkspaceShell>
  )
}
