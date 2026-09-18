import { useCallback, useState } from 'react'
import { ApiError } from '@/lib/api'
import type { BlockSeriesMeta } from '@/types/blocks'

type BlockUpdatePayload = {
  note?: string | null
  startTime?: string
  endTime?: string
  mode?: 'single' | 'series'
}

type BlockDetailViewDeps = {
  fetchSeries: (blockId: string) => Promise<BlockSeriesMeta>
  update: (blockId: string, payload: BlockUpdatePayload) => Promise<unknown>
  remove: (blockId: string, mode: 'single' | 'series') => Promise<unknown>
  reload: (opts?: { silent?: boolean }) => Promise<unknown>
  setError: (message: string) => void
}

export function useAgendaBlockDetailView<T>({
  fetchSeries,
  update,
  remove,
  reload,
  setError,
}: BlockDetailViewDeps) {
  const [viewing, setViewing] = useState<T | null>(null)
  const [series, setSeries] = useState<BlockSeriesMeta | null>(null)
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => {
    setViewing(null)
    setSeries(null)
    setSeriesLoading(false)
  }, [])

  const open = useCallback(
    (item: T, blockId: string, beforeOpen?: () => void) => {
      beforeOpen?.()
      setViewing(item)
      setSeries(null)
      setSeriesLoading(true)
      void fetchSeries(blockId)
        .then(setSeries)
        .catch(() => setSeries(null))
        .finally(() => setSeriesLoading(false))
    },
    [fetchSeries],
  )

  const save = useCallback(
    async (
      blockId: string,
      payload: {
        note: string
        startTime: string
        endTime: string
        mode: 'single' | 'series'
      },
    ) => {
      setBusy(true)
      setError('')
      try {
        await update(blockId, {
          note: payload.note,
          startTime: payload.startTime,
          endTime: payload.endTime,
          mode: payload.mode,
        })
        close()
        await reload()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
      } finally {
        setBusy(false)
      }
    },
    [update, close, reload, setError],
  )

  const deleteBlock = useCallback(
    async (blockId: string, mode: 'single' | 'series') => {
      setBusy(true)
      setError('')
      try {
        await remove(blockId, mode)
        close()
        await reload()
      } catch {
        setError('No se pudo quitar el bloqueo')
      } finally {
        setBusy(false)
      }
    },
    [remove, close, reload, setError],
  )

  return {
    viewing,
    series,
    seriesLoading,
    busy,
    open,
    close,
    save,
    deleteBlock,
  }
}
