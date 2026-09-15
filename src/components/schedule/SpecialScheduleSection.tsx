import { useCallback, useEffect, useMemo, useState } from 'react'
import { typography } from '@/styles/typography'
import { Button } from '@/components/ui/Button'
import { CustomerAppointmentHistoryPagination } from '@/components/customers/CustomerAppointmentHistoryPagination'
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
import {
  SpecialDateRangeCalendar,
  enumerateDateRange,
  formatSpecialDateRangeLabel,
} from './SpecialDateRangeCalendar'
import { SalonScheduleExpandModal } from './SalonScheduleExpandModal'
import { DAY_NAMES } from './constants'
import type { ScheduleTimeRange, SpecialDaysMap } from '@/types/schedule'
import { createSpecialDayEntry, specialDayRanges } from '@/types/schedule'
import {
  detectSpecialStaffSalonConflicts,
  pickChangedSpecialDays,
  type SpecialSalonConflict,
} from '@/lib/schedule/salonBounds'
import {
  groupSpecialDaySpans,
  rangesEqual,
  spanIntersectsMonth,
  type SpecialDaySpan,
} from '@/lib/schedule/specialDaySpans'

type StaffSpecialProps = {
  scope: 'staff'
  adminToken: string
  staffList: { staffId: string; staffName: string }[]
  salonWeeklyWindows: Record<number, ScheduleTimeRange[]>
  salonSpecialDays: SpecialDaysMap
  onSalonSpecialDaysChange: (days: SpecialDaysMap) => void
}

type SalonSpecialProps = {
  scope: 'salon'
  adminToken: string
}

type SpecialScheduleSectionProps = StaffSpecialProps | SalonSpecialProps

type SpecialDateFilterMode = 'all' | 'default' | 'month'

const SPECIAL_SPANS_PAGE_SIZE = 5

const filterFieldClass =
  'h-8 cursor-pointer border border-gold/30 bg-cream px-2 text-xs text-charcoal outline-none focus:border-gold'

const noteFieldClass =
  'mt-2 w-full resize-y border border-gold/30 bg-cream px-2 py-1.5 text-xs text-charcoal outline-none focus:border-gold'

function formatSpanTitle(span: SpecialDaySpan): string {
  if (span.start === span.end) {
    const d = new Date(span.start + 'T12:00:00')
    const dayName = DAY_NAMES[d.getDay()]
    const displayDate = d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return `${dayName}, ${displayDate}`
  }
  return formatSpecialDateRangeLabel(span.start, span.end)
}

export function SpecialScheduleSection(props: SpecialScheduleSectionProps) {
  const { adminToken, scope } = props
  const staffList = scope === 'staff' ? props.staffList : []
  const [selectedStaffId, setSelectedStaffId] = useState(staffList[0]?.staffId ?? '')
  const [specialDays, setSpecialDays] = useState<SpecialDaysMap>({})
  /** Snapshot del último load/guardado: el aviso de ampliación solo mira días tocados desde entonces. */
  const [baselineSpecialDays, setBaselineSpecialDays] = useState<SpecialDaysMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [expandModalOpen, setExpandModalOpen] = useState(false)
  const [pendingConflicts, setPendingConflicts] = useState<SpecialSalonConflict[]>([])
  const [pendingSpecialDays, setPendingSpecialDays] = useState<SpecialDaysMap | null>(null)
  const [filterMode, setFilterMode] = useState<SpecialDateFilterMode>('default')
  const [selectedMonth, setSelectedMonth] = useState(() => todaySalon().slice(0, 7))
  const [page, setPage] = useState(1)

  const salonWeeklyWindows = scope === 'staff' ? props.salonWeeklyWindows : {}
  const salonSpecialDays = scope === 'staff' ? props.salonSpecialDays : {}
  const onSalonSpecialDaysChange = scope === 'staff' ? props.onSalonSpecialDaysChange : () => {}

  useEffect(() => {
    if (scope === 'staff' && staffList.length > 0 && !selectedStaffId) {
      setSelectedStaffId(staffList[0].staffId)
    }
  }, [scope, staffList, selectedStaffId])

  useEffect(() => {
    setPage(1)
    setRangeStart('')
    setRangeEnd('')
  }, [selectedStaffId, filterMode, selectedMonth])

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
      setBaselineSpecialDays(res.specialDays)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [adminToken, scope, selectedStaffId])

  useEffect(() => {
    load()
  }, [load])

  const pickRangeDate = (dateStr: string) => {
    // Primer clic (o reinicio tras franja completa): un solo día.
    // Segundo clic: cierra la franja (inicio → fin).
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateStr)
      setRangeEnd('')
      return
    }
    setRangeEnd(dateStr)
  }

  const addDateRange = () => {
    if (!rangeStart) return
    const dates = enumerateDateRange(rangeStart, rangeEnd || rangeStart)
    const toAdd = dates.filter((date) => !specialDays[date])
    if (toAdd.length === 0) return
    const filterMonth = toAdd[0]!.slice(0, 7)
    setSpecialDays((prev) => {
      const next = { ...prev }
      for (const date of toAdd) {
        next[date] = createSpecialDayEntry()
      }
      return next
    })
    setRangeStart('')
    setRangeEnd('')
    setFilterMode('month')
    setSelectedMonth(filterMonth)
    setPage(1)
    setSaved(false)
  }

  const existingSpecialDates = useMemo(() => new Set(Object.keys(specialDays)), [specialDays])
  const selectedRangeLabel = formatSpecialDateRangeLabel(rangeStart, rangeEnd)
  const datesToAddCount = rangeStart
    ? enumerateDateRange(rangeStart, rangeEnd || rangeStart).filter((d) => !specialDays[d]).length
    : 0

  const updateSpanRanges = (dates: string[], ranges: ScheduleTimeRange[]) => {
    setSpecialDays((prev) => {
      const next = { ...prev }
      for (const date of dates) {
        const note = prev[date]?.note ?? ''
        next[date] = createSpecialDayEntry(ranges, note)
      }
      return next
    })
    setSaved(false)
  }

  const updateSpanNote = (dates: string[], note: string) => {
    setSpecialDays((prev) => {
      const next = { ...prev }
      for (const date of dates) {
        const ranges = specialDayRanges(prev[date])
        next[date] = createSpecialDayEntry(ranges, note)
      }
      return next
    })
    setSaved(false)
  }

  const toggleSpanClosed = (dates: string[]) => {
    setSpecialDays((prev) => {
      const currentlyClosed = specialDayRanges(prev[dates[0]!]).length === 0
      const nextRanges: ScheduleTimeRange[] = currentlyClosed
        ? [{ start: '10:00', end: '14:00' }]
        : []
      const next = { ...prev }
      for (const date of dates) {
        next[date] = createSpecialDayEntry(nextRanges, prev[date]?.note ?? '')
      }
      return next
    })
    setSaved(false)
  }

  const removeSpan = async (dates: string[]) => {
    setError('')
    try {
      for (const date of dates) {
        if (scope === 'salon') {
          await deleteSalonSpecialDate(adminToken, date)
        } else {
          await deleteStaffSpecialDate(adminToken, selectedStaffId, date)
        }
      }
      setSpecialDays((prev) => {
        const next = { ...prev }
        for (const date of dates) delete next[date]
        return next
      })
      setBaselineSpecialDays((prev) => {
        const next = { ...prev }
        for (const date of dates) delete next[date]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const persistStaffSpecial = async (specialDays: SpecialDaysMap, expandSalon: boolean) => {
    if (!selectedStaffId) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      if (expandSalon && pendingConflicts.length > 0) {
        const nextSalonSpecial = { ...salonSpecialDays }
        for (const conflict of pendingConflicts) {
          nextSalonSpecial[conflict.date] = createSpecialDayEntry(
            conflict.proposedSalonRanges,
            nextSalonSpecial[conflict.date]?.note ?? '',
          )
        }
        const res = await updateSalonSpecialSchedule(adminToken, nextSalonSpecial)
        onSalonSpecialDaysChange(res.specialDays)
      }
      const res = await updateStaffSpecialSchedule(adminToken, selectedStaffId, specialDays)
      setSpecialDays(res.specialDays)
      setBaselineSpecialDays(res.specialDays)
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
        setBaselineSpecialDays(res.specialDays)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setSaving(false)
      }
      return
    }

    const changedDays = pickChangedSpecialDays(specialDays, baselineSpecialDays)
    // Solo comprobar ampliación del salón si cambian las franjas horarias (no el comentario).
    const rangeChangedDays: SpecialDaysMap = {}
    for (const [date, entry] of Object.entries(changedDays)) {
      if (!rangesEqual(specialDayRanges(entry), specialDayRanges(baselineSpecialDays[date]))) {
        rangeChangedDays[date] = entry
      }
    }
    const conflicts = detectSpecialStaffSalonConflicts(
      rangeChangedDays,
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
  const specialSpans = useMemo(() => groupSpecialDaySpans(specialDays), [specialDays])
  const filteredSpans = useMemo(() => {
    if (filterMode === 'all') return specialSpans
    const month = filterMode === 'default' ? todaySalon().slice(0, 7) : selectedMonth
    return specialSpans.filter((span) => spanIntersectsMonth(span, month))
  }, [specialSpans, filterMode, selectedMonth])
  const totalPages = Math.max(1, Math.ceil(filteredSpans.length / SPECIAL_SPANS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedSpans = useMemo(() => {
    const start = (safePage - 1) * SPECIAL_SPANS_PAGE_SIZE
    return filteredSpans.slice(start, start + SPECIAL_SPANS_PAGE_SIZE)
  }, [filteredSpans, safePage])
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
        <div className="mb-4 flex flex-wrap gap-1.5">
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
      )}

      {(scope === 'salon' || selectedStaffId) && (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
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
            <div className="flex flex-col items-start gap-2">
              <span className={typography.label}>Añadir dias</span>
              <SpecialDateRangeCalendar
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPick={pickRangeDate}
                existingDates={existingSpecialDates}
                minDate={todaySalon()}
              />
              <p className={`${typography.caption} normal-case tracking-normal text-[11px]`}>
                {rangeStart
                  ? rangeEnd
                    ? `Franja: ${selectedRangeLabel}`
                    : `Dia: ${selectedRangeLabel} (pulsa otro dia para ampliar la franja)`
                  : 'Pulsa un dia; opcionalmente otro para una franja.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={addDateRange}
                disabled={!rangeStart || datesToAddCount === 0}
              >
                {datesToAddCount > 1 ? `Añadir ${datesToAddCount} dias` : 'Añadir'}
              </Button>
            </div>
          </div>

          {loading ? (
            <p className={`${typography.body} text-charcoal-muted`}>Cargando horarios especiales...</p>
          ) : filteredSpans.length === 0 ? (
            <p className={`${typography.body} text-charcoal-muted`}>
              {sortedDates.length === 0
                ? scope === 'salon'
                  ? 'No hay dias especiales del salon.'
                  : 'No hay horarios especiales para esta profesional.'
                : 'No hay dias especiales en este periodo.'}
            </p>
          ) : (
            <div className="mb-4">
              <div className="space-y-4">
                {paginatedSpans.map((span) => {
                  const isClosed = span.ranges.length === 0
                  const isMultiDay = span.dates.length > 1
                  return (
                    <div key={span.id} className="border border-gold/15 bg-cream/60 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={typography.label}>{formatSpanTitle(span)}</span>
                          {isMultiDay && (
                            <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold-dark">
                              {span.dates.length} dias
                            </span>
                          )}
                          {isClosed && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                              Cerrado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSpanClosed(span.dates)}
                            className="flex h-6 cursor-pointer items-center border border-gold/30 px-2 text-[10px] text-charcoal-muted hover:border-gold/60"
                          >
                            {isClosed
                              ? isMultiDay
                                ? 'Abrir franja'
                                : 'Abrir dia'
                              : isMultiDay
                                ? 'Cerrar franja'
                                : 'Cerrar dia'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSpan(span.dates)}
                            className="flex h-6 cursor-pointer items-center border border-gold/30 px-2 text-[10px] text-charcoal-muted hover:border-red-400 hover:text-red-500"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                      {!isClosed && (
                        <DateRangeEditor
                          ranges={span.ranges}
                          onChange={(ranges) => updateSpanRanges(span.dates, ranges)}
                        />
                      )}
                      <label className="mt-2 block">
                        <span className={`${typography.caption} mb-1 block normal-case tracking-normal`}>
                          Comentario
                        </span>
                        <textarea
                          value={span.note}
                          onChange={(e) => updateSpanNote(span.dates, e.target.value)}
                          placeholder={
                            isMultiDay
                              ? 'Texto explicativo de la franja (opcional)'
                              : 'Texto explicativo del dia (opcional)'
                          }
                          rows={2}
                          className={noteFieldClass}
                        />
                      </label>
                    </div>
                  )
                })}
              </div>
              <CustomerAppointmentHistoryPagination
                page={safePage}
                pageSize={SPECIAL_SPANS_PAGE_SIZE}
                totalItems={filteredSpans.length}
                onPageChange={setPage}
                ariaLabel={
                  scope === 'salon'
                    ? 'Paginación de dias especiales del salon'
                    : 'Paginación de dias especiales del personal'
                }
              />
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
