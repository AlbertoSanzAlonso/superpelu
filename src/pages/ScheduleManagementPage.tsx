import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminSession } from '@/hooks/useAdminSession'
import { AgendaWorkspaceShell } from '@/components/layout/AgendaWorkspaceShell'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { typography } from '@/styles/typography'
import {
  customersWorkspaceButtonClass,
  customersWorkspaceLinkClass,
  customersWorkspaceNavRowClass,
} from '@/components/customers/CustomersWorkspaceHeader'
import {
  fetchFullSchedule,
  fetchSalonSpecialSchedule,
  updateSalonSchedule,
  updateStaffSchedule,
} from '@/lib/api/admin'
import type { FullScheduleData, SpecialDaysMap } from '@/types/schedule'
import { ScheduleEditor } from '@/components/schedule/ScheduleEditor'
import { SalonScheduleExpandModal } from '@/components/schedule/SalonScheduleExpandModal'
import {
  SpecialScheduleSection,
  type SpecialScheduleSectionHandle,
} from '@/components/schedule/SpecialScheduleSection'
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
  description?: string
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
      {/* Mantener montado para no perder cambios al plegar. */}
      <div id={id} className={`${description ? 'mt-2' : 'mt-1'} ${expanded ? '' : 'hidden'}`}>
        {description && <p className="mb-4 text-xs text-charcoal-muted">{description}</p>}
        {children}
      </div>
    </section>
  )
}

type ScheduleTab = 'salon' | 'personal' | 'especiales'

function tabButtonClass(active: boolean) {
  return `cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
    active
      ? 'border-gold bg-gold/15 text-gold-dark'
      : 'border-gold/30 text-charcoal-muted hover:border-gold/60'
  }`
}

function cloneWeekly(w: WeeklyWindows): WeeklyWindows {
  return Object.fromEntries(
    DAY_ORDER.map((d) => [d, (w[d] ?? []).map((r) => ({ ...r }))]),
  )
}

function weeklyEqual(a: WeeklyWindows, b: WeeklyWindows): boolean {
  for (const day of DAY_ORDER) {
    const left = a[day] ?? []
    const right = b[day] ?? []
    if (left.length !== right.length) return false
    if (!left.every((range, i) => range.start === right[i]?.start && range.end === right[i]?.end)) {
      return false
    }
  }
  return true
}

export function ScheduleManagementPage() {
  const { adminToken, authOk, handleLogout } = useAdminSession()
  const navigate = useNavigate()
  const [data, setData] = useState<FullScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<ScheduleTab>('salon')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [salonWindows, setSalonWindows] = useState<WeeklyWindows>(emptyWeeklyWindows())
  const [staffWindowsMap, setStaffWindowsMap] = useState<Record<string, WeeklyWindows>>({})
  const [salonBaseline, setSalonBaseline] = useState<WeeklyWindows>(emptyWeeklyWindows())
  const [staffBaselineMap, setStaffBaselineMap] = useState<Record<string, WeeklyWindows>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [salonSpecialDays, setSalonSpecialDays] = useState<SpecialDaysMap>({})
  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState<WeeklySalonConflict[]>([])
  const [pendingStaffSave, setPendingStaffSave] = useState<{
    staffId: string
    windows: WeeklyWindows
  } | null>(null)
  const [salonSpecialExpanded, setSalonSpecialExpanded] = useState(false)
  const [staffSpecialExpanded, setStaffSpecialExpanded] = useState(false)
  const [specialSalonDirty, setSpecialSalonDirty] = useState(false)
  const [specialStaffDirty, setSpecialStaffDirty] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null)

  const salonSpecialRef = useRef<SpecialScheduleSectionHandle>(null)
  const staffSpecialRef = useRef<SpecialScheduleSectionHandle>(null)

  const load = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    setError('')
    try {
      const full = await fetchFullSchedule(adminToken)
      setData(full)
      const salon = Object.fromEntries(
        DAY_ORDER.map((d) => [d, full.salon.weeklyWindows[d]?.map((r) => ({ ...r })) ?? []]),
      )
      setSalonWindows(salon)
      setSalonBaseline(cloneWeekly(salon))
      const map: Record<string, WeeklyWindows> = {}
      const baselineMap: Record<string, WeeklyWindows> = {}
      for (const s of full.staff) {
        const windows = Object.fromEntries(
          DAY_ORDER.map((d) => [d, s.weeklyWindows[d]?.map((r) => ({ ...r })) ?? []]),
        )
        map[s.staffId] = windows
        baselineMap[s.staffId] = cloneWeekly(windows)
      }
      setStaffWindowsMap(map)
      setStaffBaselineMap(baselineMap)
      if (full.staff.length > 0) {
        setSelectedStaffId((current) =>
          current && full.staff.some((s) => s.staffId === current) ? current : full.staff[0].staffId,
        )
      }
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

  const salonWeeklyDirty = useMemo(
    () => !weeklyEqual(salonWindows, salonBaseline),
    [salonWindows, salonBaseline],
  )

  const staffWeeklyDirty = useMemo(() => {
    return Object.keys(staffWindowsMap).some((staffId) => {
      const current = staffWindowsMap[staffId] ?? emptyWeeklyWindows()
      const baseline = staffBaselineMap[staffId] ?? emptyWeeklyWindows()
      return !weeklyEqual(current, baseline)
    })
  }, [staffWindowsMap, staffBaselineMap])

  const pageDirty =
    salonWeeklyDirty || staffWeeklyDirty || specialSalonDirty || specialStaffDirty

  useEffect(() => {
    if (!pageDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [pageDirty])

  const currentWindows = useMemo(() => {
    if (activeTab === 'salon') return salonWindows
    if (activeTab === 'especiales') return emptyWeeklyWindows()
    if (activeTab === 'personal' && selectedStaffId) {
      return staffWindowsMap[selectedStaffId] ?? emptyWeeklyWindows()
    }
    return emptyWeeklyWindows()
  }, [activeTab, salonWindows, staffWindowsMap, selectedStaffId])

  const setCurrentWindows = useCallback(
    (w: WeeklyWindows) => {
      if (activeTab === 'salon') {
        setSalonWindows(w)
      } else if (activeTab === 'personal' && selectedStaffId) {
        setStaffWindowsMap((prev) => ({ ...prev, [selectedStaffId]: w }))
      }
      setSaved(false)
    },
    [activeTab, selectedStaffId],
  )

  const persistStaffWeekly = async (
    staffId: string,
    windows: WeeklyWindows,
    expandSalon: boolean,
  ): Promise<boolean> => {
    if (!adminToken) return false
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      let nextSalon = salonWindows
      if (expandSalon && pendingConflicts.length > 0) {
        nextSalon = { ...salonWindows }
        for (const conflict of pendingConflicts) {
          nextSalon[conflict.dayOfWeek] = conflict.proposedSalonRanges.map((r) => ({ ...r }))
        }
        await updateSalonSchedule(adminToken, nextSalon)
        setSalonWindows(nextSalon)
        setSalonBaseline(cloneWeekly(nextSalon))
        setData((prev) =>
          prev ? { ...prev, salon: { ...prev.salon, weeklyWindows: nextSalon } } : prev,
        )
      }
      await updateStaffSchedule(adminToken, staffId, windows)
      setStaffBaselineMap((prev) => ({ ...prev, [staffId]: cloneWeekly(windows) }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setSaving(false)
      setExpandModalOpen(false)
      setPendingConflicts([])
      setPendingStaffSave(null)
    }
  }

  const saveSalonWeekly = async (): Promise<boolean> => {
    if (!adminToken) return false
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateSalonSchedule(adminToken, salonWindows)
      const synced = cloneWeekly(salonWindows)
      setSalonBaseline(synced)
      setStaffWindowsMap((prev) => {
        const next: Record<string, WeeklyWindows> = {}
        for (const staffId of Object.keys(prev)) {
          next[staffId] = cloneWeekly(synced)
        }
        return next
      })
      setStaffBaselineMap((prev) => {
        const next: Record<string, WeeklyWindows> = {}
        for (const staffId of Object.keys(prev)) {
          next[staffId] = cloneWeekly(synced)
        }
        return next
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  const savePersonalWeekly = async (staffId: string): Promise<boolean> => {
    const windows = staffWindowsMap[staffId] ?? {}
    const conflicts = detectWeeklyStaffSalonConflicts(windows, salonWindows, DAY_NAMES)
    if (conflicts.length > 0) {
      setPendingConflicts(conflicts)
      setPendingStaffSave({ staffId, windows })
      setExpandModalOpen(true)
      return false
    }
    return persistStaffWeekly(staffId, windows, false)
  }

  const handleSave = async (): Promise<boolean> => {
    if (!adminToken) return false
    if (activeTab === 'salon') return saveSalonWeekly()
    if (activeTab === 'especiales') return true
    if (activeTab !== 'personal' || !selectedStaffId) return false
    return savePersonalWeekly(selectedStaffId)
  }

  const discardWeeklyChanges = () => {
    setSalonWindows(cloneWeekly(salonBaseline))
    setStaffWindowsMap(
      Object.fromEntries(
        Object.entries(staffBaselineMap).map(([id, windows]) => [id, cloneWeekly(windows)]),
      ),
    )
    setSaved(false)
  }

  const saveAllDirty = async (): Promise<boolean> => {
    if (salonWeeklyDirty) {
      const ok = await saveSalonWeekly()
      if (!ok) return false
    } else {
      for (const staffId of Object.keys(staffWindowsMap)) {
        const current = staffWindowsMap[staffId] ?? emptyWeeklyWindows()
        const baseline = staffBaselineMap[staffId] ?? emptyWeeklyWindows()
        if (weeklyEqual(current, baseline)) continue
        const ok = await savePersonalWeekly(staffId)
        if (!ok) return false
      }
    }
    if (specialSalonDirty) {
      const ok = await salonSpecialRef.current?.save()
      if (!ok) return false
    }
    if (specialStaffDirty) {
      const ok = await staffSpecialRef.current?.save()
      if (!ok) return false
    }
    return true
  }

  const discardAllDirty = () => {
    discardWeeklyChanges()
    salonSpecialRef.current?.discard()
    staffSpecialRef.current?.discard()
  }

  const requestLeave = (action: () => void) => {
    if (!pageDirty) {
      action()
      return
    }
    setPendingLeaveAction(() => action)
    setLeaveDialogOpen(true)
  }

  const requestTabChange = (tab: ScheduleTab) => {
    if (tab === activeTab) return
    requestLeave(() => {
      setActiveTab(tab)
      if (tab === 'personal' && !selectedStaffId && data?.staff[0]) {
        setSelectedStaffId(data.staff[0].staffId)
      }
    })
  }

  const requestStaffSelect = (staffId: string) => {
    if (staffId === selectedStaffId) return
    const current = staffWindowsMap[selectedStaffId] ?? emptyWeeklyWindows()
    const baseline = staffBaselineMap[selectedStaffId] ?? emptyWeeklyWindows()
    const currentDirty = selectedStaffId ? !weeklyEqual(current, baseline) : false
    if (!currentDirty) {
      setSelectedStaffId(staffId)
      return
    }
    requestLeave(() => setSelectedStaffId(staffId))
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

  const activeStaffMember = data?.staff.find((s) => s.staffId === selectedStaffId)

  return (
    <AgendaWorkspaceShell>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-gold/15 bg-cream/55 px-3 py-2 backdrop-blur-[2px]">
          <div className={customersWorkspaceNavRowClass}>
            <a
              href="/agenda"
              className={customersWorkspaceLinkClass}
              onClick={(e) => {
                e.preventDefault()
                requestLeave(() => navigate('/agenda'))
              }}
            >
              ← Agenda
            </a>
            <h1 className={`${typography.label} shrink-0 text-gold`}>Horarios</h1>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <a
                href="/servicios"
                className={customersWorkspaceLinkClass}
                onClick={(e) => {
                  e.preventDefault()
                  requestLeave(() => navigate('/servicios'))
                }}
              >
                Servicios
              </a>
              <a
                href="/personal"
                className={customersWorkspaceLinkClass}
                onClick={(e) => {
                  e.preventDefault()
                  requestLeave(() => navigate('/personal'))
                }}
              >
                Personal
              </a>
              <a
                href="/clientes"
                className={customersWorkspaceLinkClass}
                onClick={(e) => {
                  e.preventDefault()
                  requestLeave(() => navigate('/clientes'))
                }}
              >
                Clientes
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={customersWorkspaceButtonClass}
                onClick={() => requestLeave(handleLogout)}
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
              onClick={() => requestTabChange('salon')}
              className={tabButtonClass(activeTab === 'salon')}
            >
              Salon
            </button>
            <button
              type="button"
              onClick={() => requestTabChange('personal')}
              className={tabButtonClass(activeTab === 'personal')}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => requestTabChange('especiales')}
              className={tabButtonClass(activeTab === 'especiales')}
            >
              Especiales
            </button>
          </div>

          {activeTab === 'personal' && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {data?.staff.map((s) => (
                <button
                  key={s.staffId}
                  type="button"
                  onClick={() => requestStaffSelect(s.staffId)}
                  className={tabButtonClass(selectedStaffId === s.staffId)}
                >
                  {s.staffName}
                </button>
              ))}
            </div>
          )}

          {/* Especiales siempre montados para conservar borradores y poder guardar al salir. */}
          <div className={activeTab === 'especiales' ? 'mb-4 space-y-4' : 'hidden'}>
            <CollapsibleSpecialSection
              id="special-salon-section"
              title="Centro"
              description="Horario excepcional del salon para fechas concretas (festivos, aperturas especiales, etc.). Tiene prioridad sobre el horario semanal habitual."
              expanded={salonSpecialExpanded}
              onToggle={() => setSalonSpecialExpanded((open) => !open)}
            >
              <SpecialScheduleSection
                ref={salonSpecialRef}
                scope="salon"
                adminToken={adminToken!}
                onDirtyChange={setSpecialSalonDirty}
              />
            </CollapsibleSpecialSection>

            <CollapsibleSpecialSection
              id="special-staff-section"
              title="Personal"
              expanded={staffSpecialExpanded}
              onToggle={() => setStaffSpecialExpanded((open) => !open)}
              bordered
            >
              <SpecialScheduleSection
                ref={staffSpecialRef}
                scope="staff"
                staffList={data?.staff ?? []}
                adminToken={adminToken!}
                salonWeeklyWindows={salonWindows}
                salonSpecialDays={salonSpecialDays}
                onSalonSpecialDaysChange={setSalonSpecialDays}
                onDirtyChange={setSpecialStaffDirty}
              />
            </CollapsibleSpecialSection>
          </div>

          {activeTab !== 'especiales' && (
            <>
              <div className="mb-4">
                <p className={`${typography.label} mb-3`}>
                  {activeTab === 'salon'
                    ? 'Horario del salon'
                    : `Horario de ${activeStaffMember?.staffName ?? ''}`}
                </p>
                {(activeTab === 'salon' || selectedStaffId) && (
                  <ScheduleEditor weeklyWindows={currentWindows} onChange={setCurrentWindows} />
                )}
              </div>

              {(activeTab === 'salon' || selectedStaffId) && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="solid"
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={saving}
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                  {saved && (
                    <span className="text-xs text-green-600">Guardado correctamente</span>
                  )}
                </div>
              )}
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

      <ConfirmDialog
        open={leaveDialogOpen}
        title="¿Salir sin guardar?"
        message="Tienes cambios sin guardar en los horarios."
        confirmLabel="Guardar cambios"
        cancelLabel="Salir sin guardar"
        secondaryLabel="Seguir editando"
        busy={saving}
        onClose={() => {
          if (saving) return
          const action = pendingLeaveAction
          setLeaveDialogOpen(false)
          setPendingLeaveAction(null)
          discardAllDirty()
          action?.()
        }}
        onSecondary={() => {
          if (saving) return
          setLeaveDialogOpen(false)
          setPendingLeaveAction(null)
        }}
        onConfirm={async () => {
          const ok = await saveAllDirty()
          if (!ok) {
            setLeaveDialogOpen(false)
            setPendingLeaveAction(null)
            return
          }
          const action = pendingLeaveAction
          setLeaveDialogOpen(false)
          setPendingLeaveAction(null)
          action?.()
        }}
      />
    </AgendaWorkspaceShell>
  )
}
