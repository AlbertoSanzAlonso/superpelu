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
  fetchStaffSpecialSchedule,
  updateStaffSpecialSchedule,
  deleteStaffSpecialDate,
} from '@/lib/api/client'
import type { FullScheduleData, ScheduleTimeRange } from '@/types/schedule'
import { todaySalon } from '@/lib/core/dates'

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

type WeeklyWindows = Record<number, ScheduleTimeRange[]>

function emptyWeeklyWindows(): WeeklyWindows {
  return Object.fromEntries(DAY_ORDER.map((d) => [d, []]))
}

function cloneWindows(w: WeeklyWindows): WeeklyWindows {
  return Object.fromEntries(
    Object.entries(w).map(([day, ranges]) => [Number(day), ranges.map((r) => ({ ...r }))]),
  )
}

function ScheduleEditor({
  weeklyWindows,
  onChange,
}: {
  weeklyWindows: WeeklyWindows
  onChange: (w: WeeklyWindows) => void
}) {
  const updateRange = (day: number, idx: number, field: 'start' | 'end', value: string) => {
    const next = cloneWindows(weeklyWindows)
    if (!next[day]) next[day] = []
    next[day][idx] = { ...next[day][idx], [field]: value }
    onChange(next)
  }

  const addRange = (day: number) => {
    const next = cloneWindows(weeklyWindows)
    if (!next[day]) next[day] = []
    next[day].push({ start: '10:00', end: '14:00' })
    onChange(next)
  }

  const removeRange = (day: number, idx: number) => {
    const next = cloneWindows(weeklyWindows)
    next[day] = next[day].filter((_, i) => i !== idx)
    onChange(next)
  }

  const toggleDay = (day: number) => {
    const next = cloneWindows(weeklyWindows)
    if ((next[day] ?? []).length > 0) {
      next[day] = []
    } else {
      next[day] = [{ start: '10:00', end: '14:00' }]
    }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {DAY_ORDER.map((day) => {
        const ranges = weeklyWindows[day] ?? []
        const isOpen = ranges.length > 0
        return (
          <div key={day} className="border border-gold/15 bg-cream/60 p-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border text-xs ${
                  isOpen
                    ? 'border-gold bg-gold/15 text-gold'
                    : 'border-gold/30 text-transparent hover:border-gold/60'
                }`}
              >
                {isOpen ? '\u2713' : '\u00A0'}
              </button>
              <span className={`${typography.label} w-24 shrink-0`}>{DAY_NAMES[day]}</span>
              {isOpen ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {ranges.map((range, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={range.start}
                        onChange={(e) => updateRange(day, idx, 'start', e.target.value)}
                        className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
                      />
                      <span className="text-xs text-charcoal-muted">a</span>
                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => updateRange(day, idx, 'end', e.target.value)}
                        className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
                      />
                      <button
                        type="button"
                        onClick={() => removeRange(day, idx)}
                        className="flex h-7 w-7 cursor-pointer items-center justify-center border border-gold/30 text-xs text-charcoal-muted hover:border-red-400 hover:text-red-500"
                        aria-label="Eliminar franja"
                      >
                        x
                      </button>
                      {idx < ranges.length - 1 && (
                        <span className="mx-1 text-xs text-charcoal-muted">+</span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addRange(day)}
                    className="flex h-7 cursor-pointer items-center border border-gold/30 px-2 text-xs text-gold hover:border-gold hover:bg-gold/10"
                  >
                    + Franja
                  </button>
                </div>
              ) : (
                <span className="text-xs text-charcoal-muted">Cerrado</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DateRangeEditor({
  ranges,
  onChange,
}: {
  ranges: ScheduleTimeRange[]
  onChange: (ranges: ScheduleTimeRange[]) => void
}) {
  const update = (idx: number, field: 'start' | 'end', value: string) => {
    const next = ranges.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    onChange(next)
  }

  const add = () => {
    onChange([...ranges, { start: '10:00', end: '14:00' }])
  }

  const remove = (idx: number) => {
    onChange(ranges.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ranges.map((range, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            type="time"
            value={range.start}
            onChange={(e) => update(idx, 'start', e.target.value)}
            className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
          />
          <span className="text-xs text-charcoal-muted">a</span>
          <input
            type="time"
            value={range.end}
            onChange={(e) => update(idx, 'end', e.target.value)}
            className="h-7 w-24 cursor-pointer border border-gold/30 bg-cream px-1.5 text-xs text-charcoal outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center border border-gold/30 text-xs text-charcoal-muted hover:border-red-400 hover:text-red-500"
            aria-label="Eliminar franja"
          >
            x
          </button>
          {idx < ranges.length - 1 && (
            <span className="mx-1 text-xs text-charcoal-muted">+</span>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex h-7 cursor-pointer items-center border border-gold/30 px-2 text-xs text-gold hover:border-gold hover:bg-gold/10"
      >
        + Franja
      </button>
    </div>
  )
}

function SpecialScheduleSection({
  staffList,
  adminToken,
}: {
  staffList: { staffId: string; staffName: string }[]
  adminToken: string
}) {
  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.staffId ?? '')
  const [specialDays, setSpecialDays] = useState<Record<string, ScheduleTimeRange[]>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!selectedStaffId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchStaffSpecialSchedule(adminToken, selectedStaffId)
      setSpecialDays(res.specialDays)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [adminToken, selectedStaffId])

  useEffect(() => {
    load()
  }, [load])

  const addDate = () => {
    if (!newDate) return
    if (specialDays[newDate]) return
    setSpecialDays((prev) => ({ ...prev, [newDate]: [{ start: '10:00', end: '14:00' }] }))
    setNewDate('')
  }

  const updateDateRanges = (date: string, ranges: ScheduleTimeRange[]) => {
    setSpecialDays((prev) => ({ ...prev, [date]: ranges }))
  }

  const removeDate = async (date: string) => {
    setError('')
    try {
      await deleteStaffSpecialDate(adminToken, selectedStaffId, date)
      setSpecialDays((prev) => {
        const next = { ...prev }
        delete next[date]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSave = async () => {
    if (!selectedStaffId) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await updateStaffSpecialSchedule(adminToken, selectedStaffId, specialDays)
      setSpecialDays(res.specialDays)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const sortedDates = Object.keys(specialDays).sort()

  return (
    <div>
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

      <div className="mb-4">
        <p className={`${typography.label} mb-2`}>Profesional</p>
        <div className="flex flex-wrap gap-1.5">
          {staffList.map((s) => (
            <button
              key={s.staffId}
              type="button"
              onClick={() => setSelectedStaffId(s.staffId)}
              className={`cursor-pointer border px-3 py-1.5 text-xs transition-colors ${
                selectedStaffId === s.staffId
                  ? 'border-gold bg-gold/15 text-gold-dark'
                  : 'border-gold/30 text-charcoal-muted hover:border-gold/60'
              }`}
            >
              {s.staffName}
            </button>
          ))}
        </div>
      </div>

      {selectedStaffId && (
        <>
          <div className="mb-4 flex items-end gap-3">
            <div>
              <p className={`${typography.label} mb-1`}>Añadir dia especial</p>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={todaySalon()}
                className="h-8 cursor-pointer border border-gold/30 bg-cream px-2 text-xs text-charcoal outline-none focus:border-gold"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={addDate}
              disabled={!newDate || !!specialDays[newDate]}
            >
              Añadir
            </Button>
          </div>

          {loading ? (
            <p className={`${typography.body} text-charcoal-muted`}>Cargando horarios especiales...</p>
          ) : sortedDates.length === 0 ? (
            <p className={`${typography.body} text-charcoal-muted`}>No hay horarios especiales para esta profesional.</p>
          ) : (
            <div className="mb-4 space-y-4">
              {sortedDates.map((date) => {
                const d = new Date(date + 'T12:00:00')
                const dayName = DAY_NAMES[d.getDay()]
                const displayDate = d.toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
                const isClosed = specialDays[date].length === 0
                return (
                  <div key={date} className="border border-gold/15 bg-cream/60 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`${typography.label}`}>
                          {dayName}, {displayDate}
                        </span>
                        {isClosed && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                            Cerrado
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDate(date)}
                        className="flex h-6 cursor-pointer items-center border border-gold/30 px-2 text-[10px] text-charcoal-muted hover:border-red-400 hover:text-red-500"
                      >
                        Eliminar
                      </button>
                    </div>
                    {!isClosed && (
                      <DateRangeEditor
                        ranges={specialDays[date]}
                        onChange={(ranges) => updateDateRanges(date, ranges)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="solid"
              size="sm"
              onClick={handleSave}
              disabled={saving || loading}
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
