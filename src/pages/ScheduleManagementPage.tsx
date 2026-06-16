import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAdminSession } from '@/hooks/useAdminSession'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'
import {
  fetchFullSchedule,
  updateSalonSchedule,
  updateStaffSchedule,
} from '@/lib/api/client'
import type { FullScheduleData } from '@/types/schedule'
import { ScheduleEditor } from '@/components/schedule/ScheduleEditor'
import { SpecialScheduleSection } from '@/components/schedule/SpecialScheduleSection'
import { DAY_ORDER, emptyWeeklyWindows } from '@/components/schedule/constants'
import type { WeeklyWindows } from '@/components/schedule/constants'

export function ScheduleManagementPage() {
  const { adminToken, authOk, handleLogout } = useAdminSession()
  const navigate = useNavigate()
  const [data, setData] = useState<FullScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'salon' | 'especiales' | string>('salon')
  const [salonWindows, setSalonWindows] = useState<WeeklyWindows>(emptyWeeklyWindows())
  const [staffWindowsMap, setStaffWindowsMap] = useState<Record<string, WeeklyWindows>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const full = await fetchFullSchedule(adminToken)
      setData(full)
      setSalonWindows(
        Object.fromEntries(
          DAY_ORDER.map((d) => [d, full.salon.weeklyWindows[d]?.map((r) => ({ ...r })) ?? []]),
        ),
      )
      const map: Record<string, WeeklyWindows> = {}
      for (const s of full.staff) {
        map[s.staffId] = Object.fromEntries(
          DAY_ORDER.map((d) => [d, s.weeklyWindows[d]?.map((r) => ({ ...r })) ?? []]),
        )
      }
      setStaffWindowsMap(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [adminToken])

  useEffect(() => {
    if (authOk === true) load()
  }, [authOk, load])

  const currentWindows = useMemo(() => {
    if (activeTab === 'salon') return salonWindows
    if (activeTab === 'especiales') return emptyWeeklyWindows()
    return staffWindowsMap[activeTab] ?? emptyWeeklyWindows()
  }, [activeTab, salonWindows, staffWindowsMap])

  const setCurrentWindows = useCallback(
    (w: WeeklyWindows) => {
      if (activeTab === 'salon') {
        setSalonWindows(w)
      } else if (activeTab !== 'especiales') {
        setStaffWindowsMap((prev) => ({ ...prev, [activeTab]: w }))
      }
      setSaved(false)
    },
    [activeTab],
  )

  const handleSave = async () => {
    if (!adminToken) return
    setSaving(true)
    setSaved(false)
    try {
      if (activeTab === 'salon') {
        await updateSalonSchedule(adminToken, salonWindows)
      } else if (activeTab !== 'especiales') {
        await updateStaffSchedule(adminToken, activeTab, staffWindowsMap[activeTab] ?? {})
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (authOk === null || loading) {
    return (
      <AgendaWorkspaceShell>
        <div className="flex flex-1 items-center justify-center">
          <p className={typography.body}>Cargando horarios...</p>
        </div>
      </AgendaWorkspaceShell>
    )
  }

  if (authOk === false) {
    navigate('/agenda', { replace: true })
    return null
  }

  const activeStaffMember = data?.staff.find((s) => s.staffId === activeTab)

  return (
    <AgendaWorkspaceShell>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="relative border-b border-gold/15">
          <div
            className="pointer-events-none absolute inset-0 bg-cream/55 backdrop-blur-[2px]"
            aria-hidden
          />
          <div className="relative flex items-center gap-3 px-3 py-2">
            <Link
              to="/agenda"
              className="flex h-8 cursor-pointer items-center border border-gold/30 px-2 text-xs text-charcoal-muted hover:border-gold"
            >
              Volver
            </Link>
            <h1 className={`${typography.h3} flex-1`}>Horarios</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={handleLogout}
            >
              Salir
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 md:px-6">
          {error && (
            <div className="mb-4 border border-red-300 bg-red-50 p-3 text-xs text-red-700">
              {error}
              <button
                type="button"
                onClick={() => setError('')}
                className="ml-2 cursor-pointer underline"
              >
                Cerrar
              </button>
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('salon')}
              className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                activeTab === 'salon'
                  ? 'border-gold bg-gold/15 text-gold-dark'
                  : 'border-gold/30 text-charcoal-muted hover:border-gold/60'
              }`}
            >
              Salon
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('especiales')}
              className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                activeTab === 'especiales'
                  ? 'border-gold bg-gold/15 text-gold-dark'
                  : 'border-gold/30 text-charcoal-muted hover:border-gold/60'
              }`}
            >
              Especiales
            </button>
            {data?.staff.map((s) => (
              <button
                key={s.staffId}
                type="button"
                onClick={() => setActiveTab(s.staffId)}
                className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                  activeTab === s.staffId
                    ? 'border-gold bg-gold/15 text-gold-dark'
                    : 'border-gold/30 text-charcoal-muted hover:border-gold/60'
                }`}
              >
                {s.staffName}
              </button>
            ))}
          </div>

          {activeTab === 'especiales' ? (
            <div className="mb-4">
              <p className={`${typography.label} mb-3`}>Horarios especiales</p>
              <p className="text-xs text-charcoal-muted mb-4">
                Define horarios excepcionales para una profesional en fechas concretas.
                Estos horarios tienen prioridad sobre el horario semanal habitual.
              </p>
              <SpecialScheduleSection
                staffList={data?.staff ?? []}
                adminToken={adminToken!}
              />
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className={`${typography.label} mb-3`}>
                  {activeTab === 'salon' ? 'Horario del salon' : `Horario de ${activeStaffMember?.staffName ?? ''}`}
                </p>
                <ScheduleEditor weeklyWindows={currentWindows} onChange={setCurrentWindows} />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="solid"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
                {saved && (
                  <span className="text-xs text-green-600">Guardado correctamente</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AgendaWorkspaceShell>
  )
}
