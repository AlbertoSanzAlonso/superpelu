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
  ApiError,
} from '@/lib/api/client'
import { typography } from '@/styles/typography'

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

const labelClass = 'block text-xs uppercase tracking-wide text-gold mb-1'
const fieldClass =
  'w-full border border-gold/30 bg-cream px-3 py-2 font-sans text-sm text-charcoal outline-none transition-colors focus:border-gold'
const tagClass =
  'inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium'

function CategoryForm({
  mode,
  initial,
  onSave,
  onCancel,
  busy,
}: {
  mode: ModalMode
  initial: AdminServiceCategory | null
  onSave: (data: { id: string; nameEs: string; nameEn: string; sortOrder: number }) => void
  onCancel: () => void
  busy: boolean
}) {
  const [id, setId] = useState(initial?.id ?? '')
  const [nameEs, setNameEs] = useState(initial?.nameEs ?? '')
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '')
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameEs.trim() || (mode === 'create' && !id.trim())) return
    onSave({ id: id.trim(), nameEs: nameEs.trim(), nameEn: nameEn.trim(), sortOrder })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'create' && (
        <div>
          <label className={labelClass} htmlFor="cat-id">ID único</label>
          <input
            id="cat-id"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            className={fieldClass}
            placeholder="ej: nuevo-servicio"
          />
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="cat-es">Nombre (ES)</label>
        <input
          id="cat-es"
          required
          value={nameEs}
          onChange={(e) => setNameEs(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="cat-en">Nombre (EN)</label>
        <input
          id="cat-en"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="cat-order">Orden</label>
        <input
          id="cat-order"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          className={fieldClass}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="solid" size="sm" disabled={busy}>
          {mode === 'create' ? 'Crear' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

function ServiceForm({
  mode,
  initial,
  categoryId,
  categories,
  onSave,
  onCancel,
  busy,
}: {
  mode: ModalMode
  initial: AdminService | null
  categoryId: string
  categories: AdminServiceCategory[]
  onSave: (data: {
    id: string
    nameEs: string
    nameEn: string
    durationMinutes: number
    categoryId: string | null
    bookableOnline: boolean
    sortOrder: number
  }) => void
  onCancel: () => void
  busy: boolean
}) {
  const [id, setId] = useState(initial?.id ?? '')
  const [nameEs, setNameEs] = useState(initial?.nameEs ?? '')
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '')
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 30)
  const [formCategoryId, setFormCategoryId] = useState(initial?.categoryId ?? categoryId)
  const [bookableOnline, setBookableOnline] = useState(initial?.bookableOnline ?? true)
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameEs.trim() || (mode === 'create' && !id.trim()) || !durationMinutes) return
    onSave({
      id: id.trim(),
      nameEs: nameEs.trim(),
      nameEn: nameEn.trim(),
      durationMinutes,
      categoryId: formCategoryId,
      bookableOnline,
      sortOrder,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'create' && (
        <div>
          <label className={labelClass} htmlFor="svc-id">ID único</label>
          <input
            id="svc-id"
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            className={fieldClass}
            placeholder="ej: svc-nuevo-tratamiento"
          />
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor="svc-es">Nombre (ES)</label>
        <input
          id="svc-es"
          required
          value={nameEs}
          onChange={(e) => setNameEs(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="svc-en">Nombre (EN)</label>
        <input
          id="svc-en"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className={labelClass} htmlFor="svc-duration">Duración (min)</label>
          <input
            id="svc-duration"
            type="number"
            required
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className={fieldClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="svc-order">Orden</label>
          <input
            id="svc-order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="svc-category">Categoría</label>
        <select
          id="svc-category"
          value={formCategoryId}
          onChange={(e) => setFormCategoryId(e.target.value)}
          className={fieldClass}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nameEs}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={bookableOnline}
          onChange={(e) => setBookableOnline(e.target.checked)}
          className="h-4 w-4 accent-gold"
        />
        <span className="text-sm text-charcoal">Reservable online</span>
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="solid" size="sm" disabled={busy}>
          {mode === 'create' ? 'Crear' : 'Guardar'}
        </Button>
      </div>
    </form>
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

  const handleDeleteCategory = async (id: string) => {
    if (!adminToken || !window.confirm('¿Desactivar esta categoría? Los servicios se mantendrán.')) return
    setBusy(true)
    try {
      await deleteAdminServiceCategory(adminToken, id)
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al desactivar')
    } finally {
      setBusy(false)
    }
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

  const handleSaveService = async (data: {
    id: string
    nameEs: string
    nameEn: string
    durationMinutes: number
    categoryId: string | null
    bookableOnline: boolean
    sortOrder: number
  }) => {
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

  const handleDeleteService = async (id: string) => {
    if (!adminToken || !window.confirm('¿Desactivar este servicio?')) return
    setBusy(true)
    try {
      await deleteAdminService(adminToken, id)
      await loadData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al desactivar')
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link to="/clientes" className={customersWorkspaceLinkClass}>
              Clientes
            </Link>
            <Link to="/horarios" className={customersWorkspaceLinkClass}>
              Horarios
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

      <main className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className={`${typography.caption} p-6 text-center`}>Cargando…</p>
        ) : (
          <div className="divide-y divide-gold/10">
            {categories.map((cat) => {
              const catServices = servicesForCategory(cat.id)
              const expanded = expandedCategoryId === cat.id
              return (
                <div key={cat.id}>
                  <div
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-gold/5"
                    onClick={() => setExpandedCategoryId(expanded ? null : cat.id)}
                  >
                    <span className="text-xs text-charcoal-muted transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>
                      ▶
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`font-medium text-sm ${cat.active ? '' : 'opacity-50 line-through'}`}>
                        {cat.nameEs}
                      </span>
                      {cat.nameEn && (
                        <span className="ml-2 text-xs text-charcoal-muted">{cat.nameEn}</span>
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-charcoal-muted">
                      {catServices.length} servicio{catServices.length === 1 ? '' : 's'}
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {cat.active ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs !px-2 !py-0.5"
                          onClick={() => {
                            setCategoryModal({ open: true, mode: 'edit', category: cat })
                          }}
                        >
                          Editar
                        </Button>
                      ) : (
                        <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactiva</span>
                      )}
                      <div className="flex gap-1">
                        {cat.active ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs !px-2 !py-0.5 text-red-600 hover:text-red-800"
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            Desactivar
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs !px-2 !py-0.5"
                            onClick={() => handleReactivateCategory(cat.id)}
                          >
                            Reactivar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-gold/5 bg-cream/30">
                      {catServices.length === 0 ? (
                        <p className="px-8 py-3 text-xs text-charcoal-muted">
                          No hay servicios en esta categoría.
                        </p>
                      ) : (
                        catServices.map((svc) => (
                          <div
                            key={svc.id}
                            className="flex items-center gap-3 px-8 py-2 hover:bg-gold/5"
                          >
                            <div className="min-w-0 flex-1">
                              <span className={`text-sm ${svc.active ? '' : 'opacity-50 line-through'}`}>
                                {svc.nameEs}
                              </span>
                              {svc.nameEn && (
                                <span className="ml-2 text-xs text-charcoal-muted">{svc.nameEn}</span>
                              )}
                            </div>
                            <span className="text-xs tabular-nums text-charcoal-muted">
                              {svc.durationMinutes} min
                            </span>
                            {svc.bookableOnline && (
                              <span className={`${tagClass} bg-green-100 text-green-800`}>Online</span>
                            )}
                            {!svc.active && (
                              <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactivo</span>
                            )}
                            <div className="flex items-center gap-1.5">
                              {svc.active ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs !px-2 !py-0.5"
                                  onClick={() =>
                                    setServiceModal({
                                      open: true,
                                      mode: 'edit',
                                      service: svc,
                                      categoryId: svc.categoryId ?? '',
                                    })
                                  }
                                >
                                  Editar
                                </Button>
                              ) : null}
                              <div className="flex gap-1">
                                {svc.active ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs !px-2 !py-0.5 text-red-600 hover:text-red-800"
                                    onClick={() => handleDeleteService(svc.id)}
                                  >
                                    Desactivar
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs !px-2 !py-0.5"
                                    onClick={() => handleReactivateService(svc.id)}
                                  >
                                    Reactivar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div className="px-8 py-2">
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
              <div>
                <div className="flex items-center gap-3 px-4 py-3 bg-gold/5">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-sm">Sin categoría</span>
                  </div>
                  <span className="text-xs tabular-nums text-charcoal-muted">
                    {uncategorizedServices.length} servicio{uncategorizedServices.length === 1 ? '' : 's'}
                  </span>
                </div>
                {uncategorizedServices.map((svc) => (
                  <div key={svc.id} className="flex items-center gap-3 px-8 py-2 hover:bg-gold/5">
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm ${svc.active ? '' : 'opacity-50 line-through'}`}>
                        {svc.nameEs}
                      </span>
                    </div>
                    <span className="text-xs tabular-nums text-charcoal-muted">{svc.durationMinutes} min</span>
                    {!svc.active && <span className={`${tagClass} bg-amber-100 text-amber-800`}>Inactivo</span>}
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs !px-2 !py-0.5"
                        onClick={() => setServiceModal({ open: true, mode: 'edit', service: svc, categoryId: '' })}
                      >
                        Editar
                      </Button>
                      {svc.active ? (
                        <Button type="button" variant="ghost" size="sm" className="text-xs !px-2 !py-0.5 text-red-600" onClick={() => handleDeleteService(svc.id)}>
                          Desactivar
                        </Button>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" className="text-xs !px-2 !py-0.5" onClick={() => handleReactivateService(svc.id)}>
                          Reactivar
                        </Button>
                      )}
                    </div>
                  </div>
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
    </AgendaWorkspaceShell>
  )
}
