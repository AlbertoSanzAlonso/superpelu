/** Avisos por email al administrador del negocio (cita nueva o cancelada). */

import nodemailer, { type Transporter } from 'nodemailer'
import type { AppointmentRow } from './db.js'
import { formatDisplayDate } from '@/lib/dates'
import { adminAgendaUrl } from './appointmentLinks.js'

export type AppointmentEmailEvent = 'created' | 'cancelled' | 'updated'

type EmailConfig = {
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  from: string
  to: string[]
}

function envFlag(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function getEmailConfig(): EmailConfig | null {
  if (!envFlag('EMAIL_ENABLED')) return null

  const host = (process.env.SMTP_HOST ?? '').trim()
  const to = (process.env.ADMIN_NOTIFICATION_EMAIL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!host || to.length === 0) return null

  const port = Number((process.env.SMTP_PORT ?? '').trim()) || 587
  const user = (process.env.SMTP_USER ?? '').trim() || undefined
  const pass = (process.env.SMTP_PASS ?? '').trim() || undefined
  const secure = envFlag('SMTP_SECURE') || port === 465
  const from = (process.env.EMAIL_FROM ?? '').trim() || user || 'Superpelu <no-reply@superpelu>'

  return { host, port, secure, user, pass, from, to }
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null
}

let cachedTransporter: Transporter | null = null

function getTransporter(config: EmailConfig): Transporter {
  if (cachedTransporter) return cachedTransporter
  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  })
  return cachedTransporter
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const EVENT_LABELS: Record<AppointmentEmailEvent, { heading: string; intro: string; accent: string }> = {
  created: {
    heading: 'Nueva cita reservada',
    intro: 'Se ha registrado una nueva cita en Superpelu.',
    accent: '#1f7a44',
  },
  cancelled: {
    heading: 'Cita cancelada',
    intro: 'Se ha cancelado una cita en Superpelu.',
    accent: '#c0392b',
  },
  updated: {
    heading: 'Cita modificada',
    intro: 'Un cliente ha modificado su cita en Superpelu.',
    accent: '#9a7b4f',
  },
}

type EmailContent = { subject: string; html: string; text: string }

export function buildAppointmentAdminEmail(
  row: AppointmentRow,
  event: AppointmentEmailEvent,
  options?: { previous?: AppointmentRow },
): EmailContent {
  const labels = EVENT_LABELS[event]
  const dateLabel = formatDisplayDate(row.appointment_date)
  const dateTime = `${dateLabel} ${row.start_time}`
  const serviceLine = row.staff_name
    ? `${row.service_name} (${row.staff_name})`
    : row.service_name
  const phone = row.customer_phone ? `\n${row.customer_phone}` : ''
  const notes = row.notes?.trim() || ''

  const agendaUrl = adminAgendaUrl()

  const subject = `${labels.heading} — ${row.customer_name} · ${dateTime}`

  const detailRows: Array<{ label: string; value: string }> = []
  if (event === 'updated' && options?.previous) {
    const prev = options.previous
    const prevStaff = prev.staff_name ? ` · ${prev.staff_name}` : ''
    detailRows.push({
      label: 'Anterior',
      value: `${formatDisplayDate(prev.appointment_date)} ${prev.start_time}${prevStaff}`,
    })
  }
  detailRows.push(
    { label: 'Nombre', value: `${row.customer_name}${phone}` },
    { label: event === 'updated' ? 'Nueva fecha / hora' : 'Fecha / hora', value: dateTime },
    { label: 'Servicio(s) y colaborador(es)', value: serviceLine },
  )
  if (notes) detailRows.push({ label: 'Notas', value: notes })

  const text = [
    labels.intro,
    '',
    ...detailRows.flatMap((d) => [d.label, d.value, '']),
    agendaUrl ? `Ir a agenda: ${agendaUrl}` : '',
  ]
    .join('\n')
    .trim()

  const detailHtml = detailRows
    .map(
      (d) => `
        <tr>
          <td style="padding:14px 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#9a8f86;font-weight:600;">${escapeHtml(
            d.label,
          )}</td>
        </tr>
        <tr>
          <td style="padding:0 0 6px;font-size:16px;color:#2b2b2b;white-space:pre-line;line-height:1.5;">${escapeHtml(
            d.value,
          )}</td>
        </tr>`,
    )
    .join('')

  const buttonHtml = agendaUrl
    ? `
        <tr>
          <td style="padding-top:24px;">
            <a href="${escapeHtml(agendaUrl)}" style="display:inline-block;background:#1f1b18;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 26px;border-radius:8px;">Ir a agenda</a>
          </td>
        </tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#faf7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.06);">
          <tr>
            <td style="padding:22px 28px;background:${labels.accent};">
              <div style="color:#ffffff;font-size:20px;font-weight:700;">${escapeHtml(labels.heading)}</div>
              <div style="color:rgba(255,255,255,.85);font-size:14px;margin-top:4px;">${escapeHtml(labels.intro)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${detailHtml}
                ${buttonHtml}
              </table>
            </td>
          </tr>
        </table>
        <div style="max-width:520px;color:#b7ada4;font-size:12px;margin-top:16px;">Superpelu Hair Studio · aviso automático</div>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html, text }
}

async function sendAppointmentAdminEmail(
  row: AppointmentRow,
  event: AppointmentEmailEvent,
  options?: { previous?: AppointmentRow },
): Promise<void> {
  const config = getEmailConfig()
  if (!config) return

  try {
    const { subject, html, text } = buildAppointmentAdminEmail(row, event, options)
    const info = await getTransporter(config).sendMail({
      from: config.from,
      to: config.to,
      subject,
      html,
      text,
    })
    console.log(
      `Superpelu email: aviso de cita ${event} enviado a ${config.to.join(', ')} (${info.messageId})`,
    )
  } catch (err) {
    console.error(`Superpelu email (cita ${event}):`, err)
  }
}

/** Traza al arrancar si los avisos por email están activos (diagnóstico). */
export function logEmailStartup(): void {
  const config = getEmailConfig()
  if (config) {
    console.log(
      `Superpelu email: avisos activos → ${config.host}:${config.port} (de ${config.from} a ${config.to.join(', ')})`,
    )
    const agendaUrl = adminAgendaUrl()
    if (agendaUrl) {
      console.log(`Superpelu email: botón «Ir a agenda» → ${agendaUrl}`)
    } else {
      console.warn(
        'Superpelu email: falta PUBLIC_BASE_URL, CORS_ORIGIN o ADMIN_AGENDA_URL — el botón «Ir a agenda» no aparecerá en los correos',
      )
    }
    return
  }
  if (envFlag('EMAIL_ENABLED')) {
    console.warn(
      'Superpelu email: EMAIL_ENABLED=true pero faltan SMTP_HOST o ADMIN_NOTIFICATION_EMAIL — avisos desactivados',
    )
  }
}

/** Avisa al administrador de que se ha creado una cita. No lanza errores. */
export function notifyAdminAppointmentCreated(row: AppointmentRow): Promise<void> {
  return sendAppointmentAdminEmail(row, 'created')
}

/** Avisa al administrador de que se ha cancelado/eliminado una cita. No lanza errores. */
export function notifyAdminAppointmentCancelled(row: AppointmentRow): Promise<void> {
  return sendAppointmentAdminEmail(row, 'cancelled')
}

/** Avisa al administrador de que un cliente ha modificado su cita. No lanza errores. */
export function notifyAdminAppointmentUpdated(
  previous: AppointmentRow,
  row: AppointmentRow,
): Promise<void> {
  return sendAppointmentAdminEmail(row, 'updated', { previous })
}
