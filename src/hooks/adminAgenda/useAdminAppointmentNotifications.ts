import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ADMIN_APPOINTMENT_NOTIFY_MAX_AGE_MS,
  adminAppointmentNotifyDateRange,
  diffAppointmentSnapshots,
  snapshotsFromAppointments,
  type AdminAppointmentNotificationItem,
  type AppointmentSnapshot,
} from '@/lib/agenda/adminNotifications'
import { showAdminBrowserNotifications } from '@/lib/agenda/adminBrowserNotifications'
import { fetchAppointments } from '@/lib/api'
import type { Appointment } from '@/types/booking'

type ToastEntry = {
  key: string
  item: AdminAppointmentNotificationItem
}

export function useAdminAppointmentNotifications(adminToken: string) {
  const snapshotsRef = useRef<Map<string, AppointmentSnapshot>>(new Map())
  const initializedRef = useRef(false)

  const [inbox, setInbox] = useState<AdminAppointmentNotificationItem[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [lastSeenAt, setLastSeenAt] = useState(Date.now())

  const markAppointmentSnapshots = useCallback((appointments: Iterable<Appointment>) => {
    for (const [id, snapshot] of snapshotsFromAppointments(appointments)) {
      snapshotsRef.current.set(id, snapshot)
    }
  }, [])

  const ingestNewItems = useCallback((items: AdminAppointmentNotificationItem[]) => {
    if (items.length === 0) return
    const cutoff = Date.now() - ADMIN_APPOINTMENT_NOTIFY_MAX_AGE_MS
    setInbox((prev) => {
      const seen = new Set(prev.map((i) => i.key))
      const merged = [...prev]
      for (const item of items) {
        if (seen.has(item.key)) continue
        if (item.timestamp < cutoff) continue
        seen.add(item.key)
        merged.unshift(item)
      }
      return merged.filter((i) => i.timestamp >= cutoff)
    })
    setToasts((prev) => [...items.map((item) => ({ key: item.key, item })), ...prev])
    showAdminBrowserNotifications(items)
  }, [])

  const pollAppointmentChanges = useCallback(async () => {
    if (!adminToken) return
    const { from, to } = adminAppointmentNotifyDateRange()
    try {
      const { appointments } = await fetchAppointments(from, to, adminToken)
      const nextSnapshots = snapshotsFromAppointments(appointments)

      if (!initializedRef.current) {
        snapshotsRef.current = nextSnapshots
        initializedRef.current = true
        return
      }

      const fresh = diffAppointmentSnapshots(snapshotsRef.current, appointments)
      snapshotsRef.current = nextSnapshots
      ingestNewItems(fresh)
    } catch {
      // Silencioso: la agenda principal ya muestra errores de carga.
    }
  }, [adminToken, ingestNewItems])

  useEffect(() => {
    if (!adminToken) return
    void pollAppointmentChanges()
  }, [adminToken, pollAppointmentChanges])

  useEffect(() => {
    if (!adminToken) {
      snapshotsRef.current = new Map()
      initializedRef.current = false
      setInbox([])
      setToasts([])
      setBellOpen(false)
      setLastSeenAt(Date.now())
    }
  }, [adminToken])

  const dismissToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key))
  }, [])

  const openBell = useCallback(() => {
    setLastSeenAt(Date.now())
    setBellOpen(true)
  }, [])

  const closeBell = useCallback(() => {
    setBellOpen(false)
  }, [])

  const inboxCount = useMemo(
    () => inbox.filter((i) => i.timestamp > lastSeenAt).length,
    [inbox, lastSeenAt],
  )

  return {
    inbox,
    inboxCount,
    bellOpen,
    openBell,
    closeBell,
    toasts,
    dismissToast,
    markAppointmentSnapshots,
    pollAppointmentChanges,
    lastSeenAt,
  }
}
