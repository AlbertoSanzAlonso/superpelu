import { useCallback, useState } from 'react'
import type { ConfirmDialogState } from '@/components/ui/ConfirmDialog'

export function useAgendaConfirm() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const closeConfirmDialog = useCallback(() => {
    if (confirmBusy) return
    setConfirmDialog(null)
  }, [confirmBusy])

  const runConfirmDialog = useCallback(async () => {
    if (!confirmDialog) return
    setConfirmBusy(true)
    try {
      await confirmDialog.onConfirm()
      setConfirmDialog(null)
    } finally {
      setConfirmBusy(false)
    }
  }, [confirmDialog])

  return {
    confirmDialog,
    setConfirmDialog,
    confirmBusy,
    closeConfirmDialog,
    runConfirmDialog,
  }
}
