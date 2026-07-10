import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { Button } from '@/components/ui/Button'
import { customersWorkspaceButtonClass, customersWorkspaceLinkClass } from '@/components/customers/CustomersWorkspaceHeader'
import { useAdminSession } from '@/hooks/useAdminSession'
import {
  fetchAdminServices,
  fetchAdminServiceCategories,
  createAdminService,
  updateAdminService,
  deleteAdminService,
  createAdminServiceCategory,
  updateAdminServiceCategory,
  deleteAdminServiceCategory,
  type AdminService,
  type AdminServiceCategory,
} from '@/lib/api/admin-catalog'
import { ApiError } from '@/lib/api/request'
import { typography } from '@/styles/typography'
import { CategoryForm } from '@/components/admin/CategoryForm'
import { ServiceForm, type ServiceFormData } from '@/components/admin/ServiceForm'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

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

function ServiceListRow({
  svc,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  svc: AdminService
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  return (
    <div className="border-b border-gold/5 px-4 py-3 last:border-b-0 hover:bg-gold/5 md:px-8">
      <div className="min-w-0">
        <p className={`break-words text-sm leading-snug ${svc.active ? '' : 'opacity-50 line-through'}`}>
          {svc.nameEs}
        </p>
        {svc.nameEn && (
          <p className="mt-0.5 break-words text-xs leading-snug text-charcoal-muted">{svc.nameEn}</p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs tabular-nums text-charcoal-muted">
          {svc.durationMinutes} min
        </span>
        {svc.bookableOnline && (
          <span className={`${tagClass} bg-green-100 text-green-800`}>Online</span>
        )}
        {!svc.active && (
          <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactivo</span>
        )}
        {svc.active ? (
          <>
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
  expanded,
  onToggle,
  onEdit,
  onDeactivate,
  onReactivate,
}: {
  cat: AdminServiceCategory
  serviceCount: number
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
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
            {cat.nameEs}
          </p>
          {cat.nameEn && (
            <p className="mt-0.5 break-words text-xs leading-snug text-charcoal-muted">{cat.nameEn}</p>
          )}
          <p className="mt-1 text-xs tabular-nums text-charcoal-muted">
            {serviceCount} servicio{serviceCount === 1 ? '' : 's'}
          </p>
        </div>
      </button>
      <div className="flex flex-wrap items-center gap-2 border-t border-gold/5 bg-cream/20 px-4 py-2">
        {cat.active ? (
          <>
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

  const handleSaveCategory = async (data: { id: string; nameEs: string; nameEn: string; sortOrder: number }) => {
    if (!adminToken) return
    setBusy(true)
    try {
      if (categoryModal.mode === 'create') {
        await createAdminServiceCategory(adminToken, data)
      } else if (categoryModal.category) {
        await updateAdminServiceCategory(adminToken, categoryModal.category.id, data)
      }
      setCategoryModal({ open: false, mode: 'create', category: null })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
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
      if (serviceModal.mode === 'create') {
        await createAdminService(adminToken, data)
      } else if (serviceModal.service) {
        await updateAdminService(adminToken, serviceModal.service.id, data)
      }
      setServiceModal({ open: false, mode: 'create', service: null, categoryId: '' })
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteService = (id: string) => {
    if (!adminToken) return
    setConfirmAction({
      title: 'Desactivar servicio',
      message: '¿Estás seguro de desactivar este servicio?',
      onConfirm: async () => {
        setConfirmAction(null)
        setBusy(true)
        try {
          await deleteAdminService(adminToken, id)
          await loadData()
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Error al desactivar')
        } finally {
          setBusy(false)
        }
      },
    })
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
    services.filter((s) => s.categoryId === categoryId)

  const uncategorizedServices = services.filter((s) => !s.categoryId)

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
          <div className="w-full max-w-full divide-y divide-gold/10">
            {categories.map((cat) => {
              const catServices = servicesForCategory(cat.id)
              const expanded = expandedCategoryId === cat.id
              return (
                <div key={cat.id}>
                  <CategoryListRow
                    cat={cat}
                    serviceCount={catServices.length}
                    expanded={expanded}
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
                        catServices.map((svc) => (
                          <ServiceListRow
                            key={svc.id}
                            svc={svc}
                            onEdit={() =>
                              setServiceModal({
                                open: true,
                                mode: 'edit',
                                service: svc,
                                categoryId: svc.categoryId ?? '',
                              })
                            }
                            onDeactivate={() => handleDeleteService(svc.id)}
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
                <div className="px-4 py-3 bg-gold/5">
                  <p className="font-medium text-sm text-charcoal">Sin categoría</p>
                  <p className="mt-1 text-xs tabular-nums text-charcoal-muted">
                    {uncategorizedServices.length} servicio{uncategorizedServices.length === 1 ? '' : 's'}
                  </p>
                </div>
                {uncategorizedServices.map((svc) => (
                  <ServiceListRow
                    key={svc.id}
                    svc={svc}
                    onEdit={() =>
                      setServiceModal({ open: true, mode: 'edit', service: svc, categoryId: '' })
                    }
                    onDeactivate={() => handleDeleteService(svc.id)}
                    onReactivate={() => handleReactivateService(svc.id)}
                  />
                ))}
              </div>
            )}

            {categories.length === 0 && services.length === 0 && (
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
          <div className="w-full max-w-md border border-gold/30 bg-cream p-6 shadow-xl">
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
