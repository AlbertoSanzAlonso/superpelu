import { useCallback, useState } from 'react'
import { ApiError } from '@/lib/api'
import type { BlockSeriesMeta } from '@/types/blocks'

type BlockDetailViewDeps = {
  fetchSeries: (blockId: string) => Promise<BlockSeriesMeta>
  updateNote: (
    blockId: string,
    note: string,
    mode: 'single' | 'series',
  ) => Promise<unknown>
  remove: (blockId: string, mode: 'single' | 'series') => Promise<unknown>
  reload: (opts?: { silent?: boolean }) => Promise<unknown>
  setError: (message: string) => void
}

export function useAgendaBlockDetailView<T>({
  fetchSeries,
  updateNote,
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

  const saveNote = useCallback(
    async (blockId: string, note: string, mode: 'single' | 'series') => {
      setBusy(true)
      setError('')
      try {
        await updateNote(blockId, note, mode)
        close()
        await reload()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
      } finally {
        setBusy(false)
      }
    },
    [updateNote, close, reload, setError],
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
    saveNote,
    deleteBlock,
  }
}
