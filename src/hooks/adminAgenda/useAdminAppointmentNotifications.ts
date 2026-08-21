import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ADMIN_APPOINTMENT_NOTIFY_MAX_AGE_MS,
  adminAppointmentNotifyDateRange,
  clearAdminAppointmentNotifyStorage,
  diffAppointmentSnapshots,
  loadAdminAppointmentNotifyInbox,
  loadAdminAppointmentNotifyLastSeenAt,
  mergeAdminAppointmentNotifyInbox,
  pruneAdminAppointmentNotifyInbox,
  saveAdminAppointmentNotifyInbox,
  saveAdminAppointmentNotifyLastSeenAt,
  snapshotsFromAppointments,
  type AdminAppointmentNotificationItem,
  type AppointmentSnapshot,
} from '@/lib/agenda/adminNotifications'
import { showAdminBrowserNotifications } from '@/lib/agenda/adminBrowserNotifications'
import { fetchAppointments } from '@/lib/api'
import { todaySalon } from '@/lib/core/dates'

type ToastEntry = {
  key: string
  item: AdminAppointmentNotificationItem
}

type SeriesTracking = {
  endDate: string
  customerName: string
  staffName: string
  serviceName: string
  lastAppointment: { id: string; date: string; startTime: string; staffId: string }
}

export function useAdminAppointmentNotifications(adminToken: string) {
  const snapshotsRef = useRef<Map<string, AppointmentSnapshot>>(new Map())
  const initializedRef = useRef(false)
  const seriesTrackingRef = useRef<Map<string, SeriesTracking>>(new Map())
  const endedSeriesNotifiedRef = useRef<Set<string>>(new Set())
  const hadAdminTokenRef = useRef(Boolean(adminToken))
  const allowEmptyInboxPersistRef = useRef(false)

  const [inbox, setInbox] = useState<AdminAppointmentNotificationItem[]>(() =>
    loadAdminAppointmentNotifyInbox(),
  )
  const [bellOpen, setBellOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [lastSeenAt, setLastSeenAt] = useState(() => loadAdminAppointmentNotifyLastSeenAt())

  const trackSeries = useCallback((
    seriesId: string,
    endDate: string,
    info: Omit<SeriesTracking, 'endDate' | 'lastAppointment'> & { lastAppointment: SeriesTracking['lastAppointment'] },
  ) => {
    seriesTrackingRef.current.set(seriesId, { ...info, endDate })
  }, [])

  useEffect(() => {
    // Evita pisar localStorage con [] en el primer paint o si el token vacío
    // disparó un clear accidental antes de hidratar.
    if (inbox.length === 0 && !allowEmptyInboxPersistRef.current) {
      const stored = loadAdminAppointmentNotifyInbox()
      if (stored.length > 0) {
        setInbox(stored)
        return
      }
    }
    allowEmptyInboxPersistRef.current = inbox.length === 0
    saveAdminAppointmentNotifyInbox(inbox)
  }, [inbox])

  useEffect(() => {
    saveAdminAppointmentNotifyLastSeenAt(lastSeenAt)
  }, [lastSeenAt])

  const ingestNewItems = useCallback((items: AdminAppointmentNotificationItem[]) => {
    if (items.length === 0) return
    const cutoff = Date.now() - ADMIN_APPOINTMENT_NOTIFY_MAX_AGE_MS
    setInbox((prev) => {
      const fresh = items.filter((item) => item.timestamp >= cutoff)
      if (fresh.length === 0) return pruneAdminAppointmentNotifyInbox(prev)
      allowEmptyInboxPersistRef.current = false
      return mergeAdminAppointmentNotifyInbox(fresh, prev)
    })
    setToasts((prev) => [...items.map((item) => ({ key: item.key, item })), ...prev])
    showAdminBrowserNotifications(items)
  }, [])

  /**
   * Alinea snapshots con el servidor tras una mutación local.
   * Con `notify: true` genera avisos (recreate → «actualizada» vía collapse).
   * Sin notify: solo alinea (p. ej. si el cambio ya se notificó de otro modo).
   */
  const resyncAppointmentSnapshots = useCallback(
    async (options?: { notify?: boolean }) => {
      if (!adminToken) return
      const { from, to } = adminAppointmentNotifyDateRange()
      try {
        const { appointments } = await fetchAppointments(from, to, adminToken)
        if (options?.notify && initializedRef.current) {
          const fresh = diffAppointmentSnapshots(snapshotsRef.current, appointments)
          ingestNewItems(fresh)
        }
        snapshotsRef.current = snapshotsFromAppointments(appointments)
        initializedRef.current = true
      } catch {
        // Silencioso: el siguiente poll reintentará.
      }
    },
    [adminToken, ingestNewItems],
  )

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

      // Check for ended series
      const today = todaySalon()
      const endedNotifications: AdminAppointmentNotificationItem[] = []
      for (const [seriesId, info] of seriesTrackingRef.current) {
        if (endedSeriesNotifiedRef.current.has(seriesId)) continue
        if (info.endDate && info.endDate < today) {
          endedNotifications.push({
            key: `series-ended-${seriesId}-${Date.now()}`,
            kind: 'series_ended',
            id: info.lastAppointment.id,
            date: info.lastAppointment.date,
            staffId: info.lastAppointment.staffId,
            staffName: info.staffName,
            customerName: info.customerName,
            customerPhone: '',
            serviceName: info.serviceName,
            startTime: info.lastAppointment.startTime,
            timestamp: Date.now(),
            seriesId,
            seriesEndDate: info.endDate,
          })
          endedSeriesNotifiedRef.current.add(seriesId)
        }
      }
      if (endedNotifications.length > 0) {
        ingestNewItems(endedNotifications)
      }
    } catch {
      // Silencioso: la agenda principal ya muestra errores de carga.
    }
  }, [adminToken, ingestNewItems])

  useEffect(() => {
    if (!adminToken) return
    void pollAppointmentChanges()
  }, [adminToken, pollAppointmentChanges])

  useEffect(() => {
    const hadToken = hadAdminTokenRef.current
    const hasToken = Boolean(adminToken)
    hadAdminTokenRef.current = hasToken

    // Solo al cerrar sesión (había token → ya no), no en el primer render sin login.
    if (!hasToken && hadToken) {
      allowEmptyInboxPersistRef.current = true
      snapshotsRef.current = new Map()
      initializedRef.current = false
      seriesTrackingRef.current = new Map()
      endedSeriesNotifiedRef.current = new Set()
      clearAdminAppointmentNotifyStorage()
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
    const stored = loadAdminAppointmentNotifyInbox()
    setInbox((prev) => mergeAdminAppointmentNotifyInbox(stored, prev))
    setBellOpen(true)
  }, [])

  const closeBell = useCallback(() => {
    const now = Date.now()
    setLastSeenAt(now)
    saveAdminAppointmentNotifyLastSeenAt(now)
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
    resyncAppointmentSnapshots,
    pollAppointmentChanges,
    lastSeenAt,
    trackSeries,
  }
}
