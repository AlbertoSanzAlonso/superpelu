import { useCallback, useEffect, useState } from 'react'
import { typography } from '@/styles/typography'
import { Button } from '@/components/ui/Button'
import { fetchStaffSpecialSchedule, updateStaffSpecialSchedule, deleteStaffSpecialDate } from '@/lib/api/client'
import { todaySalon } from '@/lib/core/dates'
import { DateRangeEditor } from './DateRangeEditor'
import { DAY_NAMES } from './constants'
import type { ScheduleTimeRange } from '@/types/schedule'

export function SpecialScheduleSection({
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
