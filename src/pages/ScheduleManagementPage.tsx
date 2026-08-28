import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminSession } from '@/hooks/useAdminSession'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { Button } from '@/components/ui/Button'
import { typography } from '@/styles/typography'
import {
  customersWorkspaceButtonClass,
  customersWorkspaceLinkClass,
} from '@/components/customers/CustomersWorkspaceHeader'
import {
  fetchFullSchedule,
  fetchSalonSpecialSchedule,
  updateSalonSchedule,
  updateSalonSpecialSchedule,
  updateStaffSchedule,
} from '@/lib/api/admin'
import type { FullScheduleData } from '@/types/schedule'
import { ScheduleEditor } from '@/components/schedule/ScheduleEditor'
import { SalonScheduleExpandModal } from '@/components/schedule/SalonScheduleExpandModal'
import { SpecialScheduleSection } from '@/components/schedule/SpecialScheduleSection'
import { DAY_NAMES, DAY_ORDER, emptyWeeklyWindows } from '@/components/schedule/constants'
import type { WeeklyWindows } from '@/components/schedule/constants'
import { detectWeeklyStaffSalonConflicts } from '@/lib/schedule/salonBounds'
import type { WeeklySalonConflict } from '@/lib/schedule/salonBounds'

function SectionChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-gold transition-transform ${expanded ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CollapsibleSpecialSection({
  id,
  title,
  description,
  expanded,
  onToggle,
  bordered,
  children,
}: {
  id: string
  title: string
  description: string
  expanded: boolean
  onToggle: () => void
  bordered?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={bordered ? 'border-t border-gold/15 pt-4' : ''}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={id}
        className="-mx-1 flex w-full cursor-pointer items-center gap-2 px-1 py-1.5 text-left hover:bg-gold/5"
      >
        <SectionChevron expanded={expanded} />
        <span className={typography.label}>{title}</span>
      </button>
      {expanded && (
        <div id={id} className="mt-2">
          <p className="mb-4 text-xs text-charcoal-muted">{description}</p>
          {children}
        </div>
      )}
    </section>
  )
}

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
  const [salonSpecialDays, setSalonSpecialDays] = useState<Record<string, { start: string; end: string }[]>>({})
  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState<WeeklySalonConflict[]>([])
  const [pendingStaffSave, setPendingStaffSave] = useState<{
    staffId: string
    windows: WeeklyWindows
  } | null>(null)
  const [salonSpecialExpanded, setSalonSpecialExpanded] = useState(false)
  const [staffSpecialExpanded, setStaffSpecialExpanded] = useState(false)

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
      const salonSpecial = await fetchSalonSpecialSchedule(adminToken)
      setSalonSpecialDays(salonSpecial.specialDays)
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

  const persistStaffWeekly = async (staffId: string, windows: WeeklyWindows, expandSalon: boolean) => {
    if (!adminToken) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      if (expandSalon && pendingConflicts.length > 0) {
        const nextSalon = { ...salonWindows }
        for (const conflict of pendingConflicts) {
          nextSalon[conflict.dayOfWeek] = conflict.proposedSalonRanges.map((r) => ({ ...r }))
        }
        await updateSalonSchedule(adminToken, nextSalon)
        setSalonWindows(nextSalon)
        setData((prev) =>
          prev ? { ...prev, salon: { ...prev.salon, weeklyWindows: nextSalon } } : prev,
        )
      }
      await updateStaffSchedule(adminToken, staffId, windows)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
      setExpandModalOpen(false)
      setPendingConflicts([])
      setPendingStaffSave(null)
    }
  }

  const handleSave = async () => {
    if (!adminToken) return
    if (activeTab === 'salon') {
      setSaving(true)
      setSaved(false)
      setError('')
      try {
        await updateSalonSchedule(adminToken, salonWindows)
        const synced = Object.fromEntries(
          DAY_ORDER.map((d) => [d, salonWindows[d]?.map((r) => ({ ...r })) ?? []]),
        )
        setStaffWindowsMap((prev) => {
          const next: Record<string, WeeklyWindows> = {}
          for (const staffId of Object.keys(prev)) {
            next[staffId] = synced
          }
          return next
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSaving(false)
      }
      return
    }

    if (activeTab === 'especiales') return

    const windows = staffWindowsMap[activeTab] ?? {}
    const conflicts = detectWeeklyStaffSalonConflicts(windows, salonWindows, DAY_NAMES)
    if (conflicts.length > 0) {
      setPendingConflicts(conflicts)
      setPendingStaffSave({ staffId: activeTab, windows })
      setExpandModalOpen(true)
      return
    }

    await persistStaffWeekly(activeTab, windows, false)
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
        <header className="shrink-0 border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px]">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href="/agenda"
              className={customersWorkspaceLinkClass}
              onClick={(e) => { e.preventDefault(); navigate('/agenda') }}
            >
              ← Agenda
            </a>
            <h1 className={`${typography.label} min-w-0 truncate text-gold`}>Horarios</h1>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <a
                href="/servicios"
                className={customersWorkspaceLinkClass}
                onClick={(e) => { e.preventDefault(); navigate('/servicios') }}
              >
                Servicios
              </a>
              <a
                href="/personal"
                className={customersWorkspaceLinkClass}
                onClick={(e) => { e.preventDefault(); navigate('/personal') }}
              >
                Personal
              </a>
              <a
                href="/clientes"
                className={customersWorkspaceLinkClass}
                onClick={(e) => { e.preventDefault(); navigate('/clientes') }}
              >
                Clientes
              </a>
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
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 md:px-6">
          {error && (
            <p className="border-b border-red-200 bg-red-50 px-3 py-1.5 text-center text-xs text-red-800">
              {error}
            </p>
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
            <div className="mb-4 space-y-4">
              <CollapsibleSpecialSection
                id="special-salon-section"
                title="Centro"
                description="Horario excepcional del salon para fechas concretas (festivos, aperturas especiales, etc.). Tiene prioridad sobre el horario semanal habitual."
                expanded={salonSpecialExpanded}
                onToggle={() => setSalonSpecialExpanded((open) => !open)}
              >
                <SpecialScheduleSection scope="salon" adminToken={adminToken!} />
              </CollapsibleSpecialSection>

              <CollapsibleSpecialSection
                id="special-staff-section"
                title="Personal"
                description="Horario excepcional de una profesional concreta. Tiene prioridad sobre su horario semanal y sobre el del salon ese dia."
                expanded={staffSpecialExpanded}
                onToggle={() => setStaffSpecialExpanded((open) => !open)}
                bordered
              >
                <SpecialScheduleSection
                  scope="staff"
                  staffList={data?.staff ?? []}
                  adminToken={adminToken!}
                  salonWeeklyWindows={salonWindows}
                  salonSpecialDays={salonSpecialDays}
                  onSalonSpecialDaysChange={setSalonSpecialDays}
                />
              </CollapsibleSpecialSection>
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

      <SalonScheduleExpandModal
        open={expandModalOpen}
        staffName={activeStaffMember?.staffName ?? ''}
        conflicts={pendingConflicts.map((c) => ({
          ...c,
          label: c.dayLabel,
        }))}
        busy={saving}
        onClose={() => {
          if (saving) return
          setExpandModalOpen(false)
          setPendingConflicts([])
          setPendingStaffSave(null)
        }}
        onConfirmExpand={() => {
          if (!pendingStaffSave) return
          void persistStaffWeekly(pendingStaffSave.staffId, pendingStaffSave.windows, true)
        }}
        onSaveWithoutExpand={() => {
          if (!pendingStaffSave) return
          void persistStaffWeekly(pendingStaffSave.staffId, pendingStaffSave.windows, false)
        }}
      />
    </AgendaWorkspaceShell>
  )
}
