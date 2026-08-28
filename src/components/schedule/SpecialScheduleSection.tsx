import { useCallback, useEffect, useMemo, useState } from 'react'
import { typography } from '@/styles/typography'
import { Button } from '@/components/ui/Button'
import {
  deleteSalonSpecialDate,
  deleteStaffSpecialDate,
  fetchSalonSpecialSchedule,
  fetchStaffSpecialSchedule,
  updateSalonSpecialSchedule,
  updateStaffSpecialSchedule,
} from '@/lib/api/admin'
import { todaySalon } from '@/lib/core/dates'
import { DateRangeEditor } from './DateRangeEditor'
import { SalonScheduleExpandModal } from './SalonScheduleExpandModal'
import { DAY_NAMES } from './constants'
import type { ScheduleTimeRange } from '@/types/schedule'
import {
  detectSpecialStaffSalonConflicts,
  type SpecialSalonConflict,
} from '@/lib/schedule/salonBounds'

type StaffSpecialProps = {
  scope: 'staff'
  adminToken: string
  staffList: { staffId: string; staffName: string }[]
  salonWeeklyWindows: Record<number, ScheduleTimeRange[]>
  salonSpecialDays: Record<string, ScheduleTimeRange[]>
  onSalonSpecialDaysChange: (days: Record<string, ScheduleTimeRange[]>) => void
}

type SalonSpecialProps = {
  scope: 'salon'
  adminToken: string
}

type SpecialScheduleSectionProps = StaffSpecialProps | SalonSpecialProps

type SpecialDateFilterMode = 'all' | 'default' | 'month'

const filterFieldClass =
  'h-8 cursor-pointer border border-gold/30 bg-cream px-2 text-xs text-charcoal outline-none focus:border-gold'

function filterDatesByMonth(dates: string[], month: string): string[] {
  return dates.filter((date) => date.startsWith(month))
}

export function SpecialScheduleSection(props: SpecialScheduleSectionProps) {
  const { adminToken, scope } = props
  const staffList = scope === 'staff' ? props.staffList : []
  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.staffId ?? '')
  const [specialDays, setSpecialDays] = useState<Record<string, ScheduleTimeRange[]>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState<SpecialSalonConflict[]>([])
  const [pendingSpecialDays, setPendingSpecialDays] = useState<Record<string, ScheduleTimeRange[]> | null>(
    null,
  )
  const [filterMode, setFilterMode] = useState<SpecialDateFilterMode>('default')
  const [selectedMonth, setSelectedMonth] = useState(() => todaySalon().slice(0, 7))

  const salonWeeklyWindows = scope === 'staff' ? props.salonWeeklyWindows : {}
  const salonSpecialDays = scope === 'staff' ? props.salonSpecialDays : {}
  const onSalonSpecialDaysChange = scope === 'staff' ? props.onSalonSpecialDaysChange : () => {}

  useEffect(() => {
    if (scope === 'staff' && staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0].staffId)
    }
  }, [scope, staffList, selectedStaffId])

  const load = useCallback(async () => {
    if (scope === 'staff' && !selectedStaffId) return
    setLoading(true)
    setError('')
    try {
      const res =
        scope === 'salon'
          ? await fetchSalonSpecialSchedule(adminToken)
          : await fetchStaffSpecialSchedule(adminToken, selectedStaffId)
      setSpecialDays(res.specialDays)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [adminToken, scope, selectedStaffId])

  useEffect(() => {
    load()
  }, [load])

  const addDate = () => {
    if (!newDate || specialDays[newDate]) return
    setSpecialDays((prev) => ({ ...prev, [newDate]: [{ start: '10:00', end: '14:00' }] }))
    setNewDate('')
    setSaved(false)
  }

  const updateDateRanges = (date: string, ranges: ScheduleTimeRange[]) => {
    setSpecialDays((prev) => ({ ...prev, [date]: ranges }))
    setSaved(false)
  }

  const toggleClosed = (date: string) => {
    setSpecialDays((prev) => ({
      ...prev,
      [date]: (prev[date]?.length ?? 0) > 0 ? [] : [{ start: '10:00', end: '14:00' }],
    }))
    setSaved(false)
  }

  const removeDate = async (date: string) => {
    setError('')
    try {
      if (scope === 'salon') {
        await deleteSalonSpecialDate(adminToken, date)
      } else {
        await deleteStaffSpecialDate(adminToken, selectedStaffId, date)
      }
      setSpecialDays((prev) => {
        const next = { ...prev }
        delete next[date]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const persistStaffSpecial = async (
    specialDays: Record<string, ScheduleTimeRange[]>,
    expandSalon: boolean,
  ) => {
    if (!selectedStaffId) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      if (expandSalon && pendingConflicts.length > 0) {
        const nextSalonSpecial = { ...salonSpecialDays }
        for (const conflict of pendingConflicts) {
          nextSalonSpecial[conflict.date] = conflict.proposedSalonRanges.map((r) => ({ ...r }))
        }
        const res = await updateSalonSpecialSchedule(adminToken, nextSalonSpecial)
        onSalonSpecialDaysChange(res.specialDays)
      }
      const res = await updateStaffSpecialSchedule(adminToken, selectedStaffId, specialDays)
      setSpecialDays(res.specialDays)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
      setExpandModalOpen(false)
      setPendingConflicts([])
      setPendingSpecialDays(null)
    }
  }

  const handleSave = async () => {
    if (scope === 'staff' && !selectedStaffId) return
    if (scope === 'salon') {
      setSaving(true)
      setSaved(false)
      setError('')
      try {
        const res = await updateSalonSpecialSchedule(adminToken, specialDays)
        setSpecialDays(res.specialDays)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSaving(false)
      }
      return
    }

    const conflicts = detectSpecialStaffSalonConflicts(
      specialDays,
      salonWeeklyWindows,
      salonSpecialDays,
    )
    if (conflicts.length > 0) {
      setPendingConflicts(conflicts)
      setPendingSpecialDays(specialDays)
      setExpandModalOpen(true)
      return
    }

    await persistStaffSpecial(specialDays, false)
  }

  const sortedDates = Object.keys(specialDays).sort()
  const filteredDates = useMemo(() => {
    if (filterMode === 'all') return sortedDates
    const month = filterMode === 'default' ? todaySalon().slice(0, 7) : selectedMonth
    return filterDatesByMonth(sortedDates, month)
  }, [sortedDates, filterMode, selectedMonth])
  const activeStaffName =
    scope === 'staff' ? staffList.find((s) => s.staffId === selectedStaffId)?.staffName ?? '' : ''

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

      {scope === 'staff' && (
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
      )}

      {(scope === 'salon' || selectedStaffId) && (
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

          {!loading && sortedDates.length > 0 && (
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="block min-w-[9rem]">
                <span className={`${typography.label} mb-1 block`}>Filtrar</span>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as SpecialDateFilterMode)}
                  className={filterFieldClass}
                >
                  <option value="default">Mes actual</option>
                  <option value="month">Mes concreto</option>
                  <option value="all">Todos</option>
                </select>
              </label>
              {filterMode === 'month' && (
                <label className="block min-w-[10rem]">
                  <span className={`${typography.label} mb-1 block`}>Mes</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className={filterFieldClass}
                  />
                </label>
              )}
            </div>
          )}

          {loading ? (
            <p className={`${typography.body} text-charcoal-muted`}>Cargando horarios especiales...</p>
          ) : filteredDates.length === 0 ? (
            <p className={`${typography.body} text-charcoal-muted`}>
              {sortedDates.length === 0
                ? scope === 'salon'
                  ? 'No hay dias especiales del salon.'
                  : 'No hay horarios especiales para esta profesional.'
                : 'No hay dias especiales en este periodo.'}
            </p>
          ) : (
            <div className="mb-4 space-y-4">
              {filteredDates.map((date) => {
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
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={typography.label}>
                          {dayName}, {displayDate}
                        </span>
                        {isClosed && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                            Cerrado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleClosed(date)}
                          className="flex h-6 cursor-pointer items-center border border-gold/30 px-2 text-[10px] text-charcoal-muted hover:border-gold/60"
                        >
                          {isClosed ? 'Abrir dia' : 'Cerrar dia'}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDate(date)}
                          className="flex h-6 cursor-pointer items-center border border-gold/30 px-2 text-[10px] text-charcoal-muted hover:border-red-400 hover:text-red-500"
                        >
                          Eliminar
                        </button>
                      </div>
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
              disabled={saving || loading || (scope === 'staff' && !selectedStaffId)}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            {saved && (
              <span className="text-xs text-green-600">Guardado correctamente</span>
            )}
          </div>
        </>
      )}

      {scope === 'staff' && (
        <SalonScheduleExpandModal
          open={expandModalOpen}
          staffName={activeStaffName}
          conflicts={pendingConflicts.map((c) => ({
            ...c,
            label: c.dateLabel,
          }))}
          busy={saving}
          onClose={() => {
            if (saving) return
            setExpandModalOpen(false)
            setPendingConflicts([])
            setPendingSpecialDays(null)
          }}
          onConfirmExpand={() => {
            if (!pendingSpecialDays) return
            void persistStaffSpecial(pendingSpecialDays, true)
          }}
          onSaveWithoutExpand={() => {
            if (!pendingSpecialDays) return
            void persistStaffSpecial(pendingSpecialDays, false)
          }}
        />
      )}
    </div>
  )
}
