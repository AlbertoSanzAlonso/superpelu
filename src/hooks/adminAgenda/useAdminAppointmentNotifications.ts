import { useCallback, useEffect, useRef, useState } from 'react'
import { useAgendaPolling } from '@/hooks/agenda/useAgendaPolling'
import { fetchAppointments } from '@/lib/api'
import {
  adminAppointmentNotifyDateRange,
  appointmentToNotificationItem,
  type AdminAppointmentNotificationItem,
} from '@/lib/adminAppointmentNotifications'

type ToastEntry = {
  key: string
  item: AdminAppointmentNotificationItem
}

export function useAdminAppointmentNotifications(adminToken: string) {
  const knownIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  const [inbox, setInbox] = useState<AdminAppointmentNotificationItem[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const markAppointmentsKnown = useCallback((ids: Iterable<string>) => {
    for (const id of ids) knownIdsRef.current.add(id)
  }, [])

  const ingestNewItems = useCallback((items: AdminAppointmentNotificationItem[]) => {
    if (items.length === 0) return
    setInbox((prev) => {
      const seen = new Set(prev.map((i) => i.id))
      const merged = [...prev]
      for (const item of items) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        merged.unshift(item)
      }
      return merged
    })
    setToasts((prev) => [
      ...items.map((item) => ({ key: `${item.id}-${Date.now()}`, item })),
      ...prev,
    ])
  }, [])

  const pollNewAppointments = useCallback(async () => {
    if (!adminToken) return
    const { from, to } = adminAppointmentNotifyDateRange()
    try {
      const { appointments } = await fetchAppointments(from, to, adminToken)
      const notifyable = appointments
        .map(appointmentToNotificationItem)
        .filter((item): item is AdminAppointmentNotificationItem => item != null)

      if (!initializedRef.current) {
        markAppointmentsKnown(notifyable.map((i) => i.id))
        initializedRef.current = true
        return
      }

      const fresh: AdminAppointmentNotificationItem[] = []
      for (const item of notifyable) {
        if (knownIdsRef.current.has(item.id)) continue
        knownIdsRef.current.add(item.id)
        fresh.push(item)
      }
      ingestNewItems(fresh)
    } catch {
      // Silencioso: la agenda principal ya muestra errores de carga.
    }
  }, [adminToken, ingestNewItems, markAppointmentsKnown])

  useAgendaPolling(pollNewAppointments, { enabled: Boolean(adminToken) })

  useEffect(() => {
    if (!adminToken) return
    void pollNewAppointments()
  }, [adminToken, pollNewAppointments])

  useEffect(() => {
    if (!adminToken) {
      knownIdsRef.current = new Set()
      initializedRef.current = false
      setInbox([])
      setToasts([])
      setBellOpen(false)
    }
  }, [adminToken])

  const dismissToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key))
  }, [])

  const openBell = useCallback(() => {
    setBellOpen(true)
  }, [])

  const closeBell = useCallback(() => {
    setBellOpen(false)
    setInbox([])
  }, [])

  return {
    inbox,
    inboxCount: inbox.length,
    bellOpen,
    openBell,
    closeBell,
    toasts,
    dismissToast,
    markAppointmentsKnown,
    pollNewAppointments,
  }
}
