#!/usr/bin/env node
/**
 * Actualiza rutas @/lib/ tras reorganización en subcarpetas.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const REPLACEMENTS = [
  ['@/lib/bookingOccupancy', '@/lib/booking/occupancy'],
  ['@/lib/colorComboBooking', '@/lib/booking/colorCombo'],
  ['@/lib/bookingCombo', '@/lib/booking/combo'],
  ['@/lib/adminAppointmentNotifications', '@/lib/agenda/adminNotifications'],
  ['@/lib/adminBrowserNotifications', '@/lib/agenda/adminBrowserNotifications'],
  ['@/lib/pendingAppointmentMoves', '@/lib/agenda/pendingMoves'],
  ['@/lib/appointmentHistoryFilters', '@/lib/customer/historyFilters'],
  ['@/lib/customerAppointmentStatus', '@/lib/customer/appointmentStatus'],
  ['@/lib/agendaGridSelection', '@/lib/agenda/gridSelection'],
  ['@/lib/appointmentPlacement', '@/lib/agenda/placement'],
  ['@/lib/appointmentNoShow', '@/lib/agenda/noShow'],
  ['@/lib/serviceCategoryColors', '@/lib/catalog/serviceCategoryColors'],
  ['@/lib/adminCalendar', '@/lib/agenda/adminCalendar'],
  ['@/lib/servicePicker', '@/lib/catalog/servicePicker'],
  ['@/lib/customerName', '@/lib/customer/name'],
  ['@/lib/scheduleHours', '@/lib/core/scheduleHours'],
  ['@/lib/reviewRequest', '@/lib/customer/reviewRequest'],
  ['@/lib/staffApi', '@/lib/api/staff'],
  ['@/lib/timeGrid', '@/lib/agenda/timeGrid'],
  ['@/lib/calendar', '@/lib/booking/calendar'],
  ['@/lib/dates', '@/lib/core/dates'],
  ['@/lib/phone', '@/lib/customer/phone'],
  ['@/lib/notes', '@/lib/core/notes'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|md)$/.test(name)) out.push(full)
  }
  return out
}

let changed = 0
for (const dir of ['server', 'src', '.cursor', 'scripts']) {
  const base = path.join(ROOT, dir)
  if (!fs.existsSync(base)) continue
  for (const file of walk(base)) {
    let text = fs.readFileSync(file, 'utf8')
    const original = text
    for (const [from, to] of REPLACEMENTS) {
      text = text.split(from).join(to)
    }
    if (text !== original) {
      fs.writeFileSync(file, text)
      changed++
    }
  }
}

console.log(`Updated @/lib imports in ${changed} files`)
