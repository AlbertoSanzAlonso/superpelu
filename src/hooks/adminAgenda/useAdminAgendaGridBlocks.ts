import { useCallback, useState } from 'react'
import {
  ApiError,
  createAdminBlock,
  deleteAdminBlock,
  fetchAdminBlockSeries,
  updateAdminBlock,
} from '@/lib/api'
import {
  blockGroupsFromGridSummary,
  summarizeStaffColumnGridSelection,
} from '@/lib/agenda/gridSelection'
import { useAgendaBlockDetailView } from '@/hooks/agenda/useAgendaBlockDetailView'
import { useAgendaPendingBlockCreate } from '@/hooks/agenda/useAgendaPendingBlockCreate'
import type { BlockScope, BlockSeriesMeta } from '@/types/blocks'
import type { DayScheduleBlock, StaffDaySchedule } from '@/types/booking'
import type { AdminColumnSelection } from './types'

type AdminBlockView = {
  staffId: string
  staffName: string
  block: DayScheduleBlock
}

type GridBlocksDeps = {
  adminToken: string
  date: string
  schedules: StaffDaySchedule[]
  selection: AdminColumnSelection | null
  clearSelection: () => void
  setSelection: (value: AdminColumnSelection | null) => void
  load: (opts?: { silent?: boolean }) => Promise<StaffDaySchedule[] | null>
  setError: (message: string) => void
  setGridActionsBusy: (busy: boolean) => void
}

export function useAdminAgendaGridBlocks({
  adminToken,
  date,
  schedules,
  selection,
  clearSelection,
  setSelection,
  load,
  setError,
  setGridActionsBusy,
}: GridBlocksDeps) {
  const blockCreate = useAgendaPendingBlockCreate()
  const [unblockModal, setUnblockModal] = useState<{
    blockIds: string[]
    series: BlockSeriesMeta
  } | null>(null)

  const blockDetail = useAgendaBlockDetailView<AdminBlockView>({
    fetchSeries: (blockId) => fetchAdminBlockSeries(adminToken, blockId),
    updateNote: (blockId, note, mode) =>
      updateAdminBlock(adminToken, blockId, { note, mode }),
    remove: (blockId, mode) => deleteAdminBlock(blockId, adminToken, mode),
    reload: load,
    setError,
  })

  const requestBlockSelectedSlots = useCallback(() => {
    if (!selection) return
    const summary = summarizeStaffColumnGridSelection(
      schedules,
      selection.staffId,
      date,
      selection.times,
    )
    const groups = blockGroupsFromGridSummary(summary)
    if (groups) blockCreate.openWithGroups(groups)
  }, [selection, schedules, date, blockCreate])

  const confirmBlockWithScope = useCallback(
    async (scope: BlockScope, endDate?: string, note?: string) => {
      if (!selection || !adminToken || blockCreate.pendingGroups.length === 0) return
      setGridActionsBusy(true)
      setError('')
      try {
        for (const group of blockCreate.pendingGroups) {
          await createAdminBlock(adminToken, {
            staffId: selection.staffId,
            date,
            startTime: group.startTime,
            endTime: group.endTime,
            scope,
            endDate,
            note,
          })
        }
        blockCreate.closeAfterSuccess()
        clearSelection()
        await load()
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo bloquear')
      } finally {
        setGridActionsBusy(false)
      }
    },
    [
      selection,
      adminToken,
      blockCreate,
      date,
      clearSelection,
      load,
      setError,
      setGridActionsBusy,
    ],
  )

  const unblockSelectedSlots = useCallback(async () => {
    if (!selection || !adminToken) return
    const { blockIds } = summarizeStaffColumnGridSelection(
      schedules,
      selection.staffId,
      date,
      selection.times,
    )
    if (blockIds.length === 0) return

    setGridActionsBusy(true)
    setError('')
    try {
      const firstMeta = await fetchAdminBlockSeries(adminToken, blockIds[0])
      if (firstMeta.count <= 1) {
        for (const id of blockIds) {
          await deleteAdminBlock(id, adminToken, 'single')
        }
        clearSelection()
        await load()
        return
      }

      setUnblockModal({ blockIds, series: firstMeta })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo comprobar el bloqueo')
    } finally {
      setGridActionsBusy(false)
    }
  }, [selection, adminToken, schedules, date, clearSelection, load, setError, setGridActionsBusy])

  const cancelUnblockModal = useCallback(() => {
    setUnblockModal(null)
  }, [])

  const confirmUnblockWithMode = useCallback(
    async (mode: 'single' | 'series') => {
      if (!unblockModal || !adminToken) return
      setGridActionsBusy(true)
      setError('')
      try {
        const ids =
          mode === 'series' && unblockModal.series.seriesId
            ? [unblockModal.blockIds[0]]
            : unblockModal.blockIds

        for (const id of ids) {
          await deleteAdminBlock(id, adminToken, mode)
        }
        setUnblockModal(null)
        clearSelection()
        await load()
      } catch {
        setError('No se pudo quitar el bloqueo')
      } finally {
        setGridActionsBusy(false)
      }
    },
    [unblockModal, adminToken, clearSelection, load, setError, setGridActionsBusy],
  )

  const openBlockDetail = useCallback(
    (staffId: string, block: DayScheduleBlock) => {
      const staffName = schedules.find((s) => s.staffId === staffId)?.staffName ?? ''
      blockDetail.open({ staffId, staffName, block }, block.id, () => setSelection(null))
    },
    [schedules, setSelection, blockDetail],
  )

  const saveBlockNote = useCallback(
    async (note: string, mode: 'single' | 'series') => {
      if (!blockDetail.viewing) return
      await blockDetail.saveNote(blockDetail.viewing.block.id, note, mode)
    },
    [blockDetail],
  )

  const deleteViewingBlock = useCallback(
    async (mode: 'single' | 'series') => {
      if (!blockDetail.viewing) return
      await blockDetail.deleteBlock(blockDetail.viewing.block.id, mode)
    },
    [blockDetail],
  )

  return {
    blockModalOpen: blockCreate.modalOpen,
    pendingBlockGroups: blockCreate.pendingGroups,
    requestBlockSelectedSlots,
    cancelBlockModal: blockCreate.cancel,
    confirmBlockWithScope,
    unblockModal,
    cancelUnblockModal,
    confirmUnblockWithMode,
    unblockSelectedSlots,
    viewingBlock: blockDetail.viewing,
    viewingBlockSeries: blockDetail.series,
    viewingBlockSeriesLoading: blockDetail.seriesLoading,
    blockDetailBusy: blockDetail.busy,
    openBlockDetail,
    closeBlockDetail: blockDetail.close,
    saveBlockNote,
    deleteViewingBlock,
  }
}
