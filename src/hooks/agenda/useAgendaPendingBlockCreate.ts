import { useCallback, useState } from 'react'
import type { PendingBlockGroup } from '@/types/blocks'

export function useAgendaPendingBlockCreate() {
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingGroups, setPendingGroups] = useState<PendingBlockGroup[]>([])

  const openWithGroups = useCallback((groups: PendingBlockGroup[]) => {
    if (groups.length === 0) return false
    setPendingGroups(groups)
    setModalOpen(true)
    return true
  }, [])

  const cancel = useCallback(() => {
    setModalOpen(false)
    setPendingGroups([])
  }, [])

  const closeAfterSuccess = useCallback(() => {
    setModalOpen(false)
    setPendingGroups([])
  }, [])

  return {
    modalOpen,
    pendingGroups,
    openWithGroups,
    cancel,
    closeAfterSuccess,
  }
}
