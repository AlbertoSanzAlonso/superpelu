import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AdminAppointmentNotificationItem } from '@/lib/agenda/adminNotifications'
import { StaffAgendaPanel } from '@/components/agenda/StaffAgendaPanel'
import { AdminAgendaLoginForm } from '@/components/agenda/admin/AdminAgendaLoginForm'
import { AdminAgendaWorkspace } from '@/components/agenda/admin/AdminAgendaWorkspace'
import { useAdminAgenda } from '@/hooks/useAdminAgenda'
import { verifyAdminToken, ApiError } from '@/lib/api'
import { requestAdminNotificationPermission } from '@/lib/agenda/adminBrowserNotifications'
import { staffLogin, verifyStaffToken, type StaffSession } from '@/lib/api/staff'
import { useAgendaDate } from '@/hooks/useAgendaDate'

const ADMIN_TOKEN_KEY = 'superpelu-admin-token'
const STAFF_TOKEN_KEY = 'superpelu-staff-token'
const STAFF_USER_KEY = 'superpelu-staff-user'

type LoginMode = 'admin' | 'staff'

export function AdminAgendaPage() {
  const navigate = useNavigate()
  const [loginMode, setLoginMode] = useState<LoginMode>('admin')
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) ?? '')
  const [staffToken, setStaffToken] = useState(() => localStorage.getItem(STAFF_TOKEN_KEY) ?? '')
  const [staffUser, setStaffUser] = useState<StaffSession | null>(() => {
    const raw = localStorage.getItem(STAFF_USER_KEY)
    return raw ? (JSON.parse(raw) as StaffSession) : null
  })

  const [adminPassword, setAdminPassword] = useState('')
  const [staffName, setStaffName] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const { date: selectedDate, setDate: setSelectedDate } = useAgendaDate()

  const isAdmin = Boolean(adminToken)
  const isStaff = Boolean(staffToken && staffUser)

  const agenda = useAdminAgenda(adminToken, selectedDate)
  const {
    schedules,
    loadedDate,
    load: reloadAgenda,
    openAppointmentDetail,
    appointmentNotifications: notifications,
  } = agenda
  const { closeBell, dismissToast, toasts } = notifications
  const [pendingNotificationOpen, setPendingNotificationOpen] =
    useState<AdminAppointmentNotificationItem | null>(null)

  const tryOpenPendingAppointment = useCallback(
    (item: AdminAppointmentNotificationItem, daySchedules: typeof schedules) => {
      for (const schedule of daySchedules) {
        const apt = schedule.appointments.find((a) => a.id === item.id)
        if (apt) {
          openAppointmentDetail(schedule.staffId, apt)
          return true
        }
      }
      return false
    },
    [openAppointmentDetail],
  )

  const openAppointmentFromNotification = useCallback(
    (item: AdminAppointmentNotificationItem) => {
      closeBell()
      for (const toast of toasts) {
        if (toast.item.key === item.key) dismissToast(toast.key)
      }
      if (item.kind === 'cancelled' && item.customerPhone) {
        navigate(
          `/clientes/${encodeURIComponent(item.customerPhone)}?cita=${encodeURIComponent(item.id)}`,
        )
        return
      }
      if (selectedDate === item.date && loadedDate === item.date) {
        if (tryOpenPendingAppointment(item, schedules)) {
          setPendingNotificationOpen(null)
          return
        }
      }
      setPendingNotificationOpen(item)
      if (selectedDate !== item.date) {
        setSelectedDate(item.date)
        return
      }
      void reloadAgenda()
    },
    [
      closeBell,
      dismissToast,
      toasts,
      navigate,
      selectedDate,
      loadedDate,
      schedules,
      tryOpenPendingAppointment,
      setSelectedDate,
      reloadAgenda,
    ],
  )

  useEffect(() => {
    if (!pendingNotificationOpen) return
    if (selectedDate !== pendingNotificationOpen.date) return
    if (loadedDate !== selectedDate) return
    const pending = pendingNotificationOpen
    const id = window.requestAnimationFrame(() => {
      tryOpenPendingAppointment(pending, schedules)
      setPendingNotificationOpen(null)
    })
    return () => window.cancelAnimationFrame(id)
  }, [pendingNotificationOpen, selectedDate, loadedDate, schedules, tryOpenPendingAppointment])

  useEffect(() => {
    if (!staffToken) return
    verifyStaffToken(staffToken)
      .then((res) => {
        setStaffUser(res.staff)
        localStorage.setItem(STAFF_USER_KEY, JSON.stringify(res.staff))
      })
      .catch(() => {
        localStorage.removeItem(STAFF_TOKEN_KEY)
        localStorage.removeItem(STAFF_USER_KEY)
        setStaffToken('')
        setStaffUser(null)
      })
  }, [staffToken])

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      await verifyAdminToken(adminPassword.trim())
      localStorage.setItem(ADMIN_TOKEN_KEY, adminPassword.trim())
      setAdminToken(adminPassword.trim())
      setAdminPassword('')
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Clave incorrecta')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      const res = await staffLogin(staffName.trim(), staffPassword)
      localStorage.setItem(STAFF_TOKEN_KEY, res.token)
      localStorage.setItem(STAFF_USER_KEY, JSON.stringify(res.staff))
      setStaffToken(res.token)
      setStaffUser(res.staff)
      setStaffPassword('')
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'No se pudo entrar')
    } finally {
      setLoggingIn(false)
    }
  }

  function handleStaffLogout() {
    localStorage.removeItem(STAFF_TOKEN_KEY)
    localStorage.removeItem(STAFF_USER_KEY)
    setStaffToken('')
    setStaffUser(null)
  }

  useEffect(() => {
    if (!adminToken) return
    requestAdminNotificationPermission()
  }, [adminToken])

  function handleAdminLogout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminToken('')
  }

  if (!isAdmin && !isStaff) {
    return (
      <AdminAgendaLoginForm
        loginMode={loginMode}
        onLoginModeChange={(mode) => {
          setLoginMode(mode)
          setLoginError('')
        }}
        adminPassword={adminPassword}
        onAdminPasswordChange={setAdminPassword}
        staffName={staffName}
        onStaffNameChange={setStaffName}
        staffPassword={staffPassword}
        onStaffPasswordChange={setStaffPassword}
        loginError={loginError}
        loggingIn={loggingIn}
        onAdminLogin={handleAdminLogin}
        onStaffLogin={handleStaffLogin}
      />
    )
  }

  if (isStaff && staffUser) {
    return (
      <StaffAgendaPanel token={staffToken} staff={staffUser} onLogout={handleStaffLogout} />
    )
  }

  return (
    <AdminAgendaWorkspace
      selectedDate={selectedDate}
      onDateChange={setSelectedDate}
      adminToken={adminToken}
      agenda={agenda}
      openAppointmentFromNotification={openAppointmentFromNotification}
      onLogout={handleAdminLogout}
    />
  )
}
