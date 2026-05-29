import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isValidDateString, todaySalon } from '@/lib/dates'

const AGENDA_DATE_PARAM = 'fecha'

export function useAgendaDate() {
  const [searchParams, setSearchParams] = useSearchParams()

  const date = useMemo(() => {
    const fromUrl = searchParams.get(AGENDA_DATE_PARAM)
    if (fromUrl && isValidDateString(fromUrl)) return fromUrl
    return todaySalon()
  }, [searchParams])

  const setDate = useCallback(
    (nextDate: string) => {
      if (!isValidDateString(nextDate)) return
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (nextDate === todaySalon()) {
            next.delete(AGENDA_DATE_PARAM)
          } else {
            next.set(AGENDA_DATE_PARAM, nextDate)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { date, setDate }
}
