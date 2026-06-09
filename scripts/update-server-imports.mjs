#!/usr/bin/env node
/**
 * Actualiza rutas @server/ tras reorganización en carpetas por dominio.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

const REPLACEMENTS = [
  ['@server/appointmentBooking.js', '@server/appointments/booking.js'],
  ['@server/appointmentChain.js', '@server/appointments/chain.js'],
  ['@server/appointmentCreate.js', '@server/appointments/create.js'],
  ['@server/appointmentLifecycle.js', '@server/appointments/lifecycle.js'],
  ['@server/appointmentQueries.js', '@server/appointments/queries.js'],
  ['@server/appointmentTime.js', '@server/appointments/time.js'],
  ['@server/appointmentTypes.js', '@server/appointments/types.js'],
  ['@server/appointmentUpdate.js', '@server/appointments/update.js'],
  ['@server/appointmentSeries.js', '@server/appointments/series.js'],
  ['@server/appointmentLinks.js', '@server/appointments/links.js'],
  ['@server/colorBooking.js', '@server/appointments/color.js'],
  ['@server/bookingLock.js', '@server/appointments/lock.js'],
  ['@server/seriesDates.js', '@server/appointments/seriesDates.js'],
  ['@server/staffAuth.js', '@server/staff/auth.js'],
  ['@server/staffBlocks.js', '@server/staff/blocks.js'],
  ['@server/staffSchedule.js', '@server/staff/schedule.js'],
  ['@server/availability.js', '@server/staff/availability.js'],
  ['@server/me.js', '@server/staff/me.js'],
  ['@server/appointmentEmail.js', '@server/notifications/email.js'],
  ['@server/appointmentWhatsApp.js', '@server/notifications/whatsapp.js'],
  ['@server/openwa.js', '@server/notifications/openwa.js'],
  ['@server/whatsappBranding.js', '@server/notifications/branding.js'],
  ['@server/reminderScheduler.js', '@server/notifications/reminders.js'],
  ['@server/reviewRequest.js', '@server/notifications/review.js'],
  ['@server/services.js', '@server/catalog/services.js'],
  ['@server/serviceCategories.js', '@server/catalog/categories.js'],
  ['@server/customers.js', '@server/customers/index.js'],
  ['@server/customerPages.js', '@server/customers/pages.js'],
  // staff.ts → staff/index.ts (después de rutas más específicas)
  ["from '@server/staff.js'", "from '@server/staff/index.js'"],
  ["from \"@server/staff.js\"", "from \"@server/staff/index.js\""],
  ['@server/appointments.js', '@server/appointments/index.js'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|md)$/.test(name)) out.push(full)
  }
  return out
}

let changed = 0
for (const dir of ['server', 'src', 'scripts']) {
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

console.log(`Updated imports in ${changed} files`)
