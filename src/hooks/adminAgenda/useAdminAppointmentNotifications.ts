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
import { todaySalon } from '@/lib/core/dates'
import type { Appointment } from '@/types/booking'

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

  const [inbox, setInbox] = useState<AdminAppointmentNotificationItem[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [lastSeenAt, setLastSeenAt] = useState(Date.now())

  const markAppointmentSnapshots = useCallback((appointments: Iterable<Appointment>) => {
    for (const [id, snapshot] of snapshotsFromAppointments(appointments)) {
      snapshotsRef.current.set(id, snapshot)
    }
  }, [])

  const trackSeries = useCallback((
    seriesId: string,
    endDate: string,
    info: Omit<SeriesTracking, 'endDate' | 'lastAppointment'> & { lastAppointment: SeriesTracking['lastAppointment'] },
  ) => {
    seriesTrackingRef.current.set(seriesId, { ...info, endDate })
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
    if (!adminToken) {
      snapshotsRef.current = new Map()
      initializedRef.current = false
      seriesTrackingRef.current = new Map()
      endedSeriesNotifiedRef.current = new Set()
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
    trackSeries,
  }
}
