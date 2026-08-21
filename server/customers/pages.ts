import type { AppointmentRow } from '@server/pg/types.js'
import { buildLinkPreviewMetaTags, appendLocaleToCustomerUrl, publicBaseUrl, encodeId, decodeId, verifyCancelToken } from '@server/appointments/links.js'
import { getAppointmentById, getAppointmentsByBookingGroup } from '@server/appointments/index.js'
import { appointmentLocale } from '@/i18n/localeHelpers'
import { publicAppointmentErrorMessage } from '@/i18n/publicAppointmentErrors'
import { getTranslation } from '@/i18n/translations'
import { normalizeLocale, type Locale } from '@/i18n/types'
import { formatDisplayDate } from '@/lib/core/dates'
import { formatAppointmentTimeRange, isColorGroupWashRow } from '@/lib/booking/occupancy'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function resolvePageLocale(
  row: AppointmentRow | null | undefined,
  queryLang?: string,
): Locale {
  if (row) return appointmentLocale(row)
  return normalizeLocale(queryLang === 'en' ? 'en' : undefined)
}

function cp(locale: Locale) {
  return getTranslation(locale).customerPages
}

export function customerPageShell(
  title: string,
  bodyHtml: string,
  locale: Locale,
  options?: { pageUrl?: string; description?: string },
): string {
  const description = options?.description ?? cp(locale).metaDescription
  return [
    `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    buildLinkPreviewMetaTags({ title, description, ...options }),
    '<style>',
    'body{font-family:system-ui,-apple-system,sans-serif;background:#faf7f5;color:#2b2b2b;',
    'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}',
    '.card{background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);max-width:420px;width:100%;padding:2rem;text-align:center}',
    'h1{font-size:1.4rem;margin:0 0 1rem}p{line-height:1.5;margin:.5rem 0}',
    '.detail{background:#f4efec;border-radius:10px;padding:1rem;margin:1rem 0;text-align:left}',
    '.btn{display:inline-block;border:0;border-radius:10px;padding:.85rem 1.4rem;font-size:1rem;',
    'font-weight:600;cursor:pointer;text-decoration:none;margin-top:.5rem}',
    '.btn:disabled{opacity:.65;cursor:wait}',
    '.btn-danger{background:#c0392b;color:#fff}.btn-secondary{background:#e7e0db;color:#2b2b2b}',
    '.btn-primary{background:#1f1b18;color:#fff}',
    '.section-label{font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#9a8f86;margin:1.25rem 0 .5rem;text-align:left}',
    '.date-form,.staff-form{margin:.5rem 0 1rem;text-align:left}.date-form input[type=date],.staff-form select{width:100%;padding:.65rem;border:1px solid #d4c4bc;border-radius:8px;font-size:1rem}',
    '.slots{display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin:.5rem 0 1rem}.slot-form{margin:0}',
    '.slot-btn{width:100%;padding:.65rem;border:1px solid #d4c4bc;background:#fff;border-radius:8px;cursor:pointer;font-size:.95rem}',
    '.slot-btn:hover{border-color:#1f1b18;background:#faf7f5}',
    '.muted{color:#888;font-size:.9rem}',
    '.treatment-list{display:flex;flex-direction:column;gap:.75rem;margin:1rem 0}',
    '.treatment-card{background:#f4efec;border-radius:10px;padding:1rem;text-align:left}',
    '.treatment-card p{margin:.35rem 0;font-size:.95rem}',
    '.treatment-card .btn{margin-top:.75rem;width:100%;box-sizing:border-box}',
    '.link-back{display:inline-block;margin:.75rem 0;font-size:.9rem;color:#6b5f57}',
    '</style></head><body><div class="card">',
    bodyHtml,
    webHomeButtonHtml(locale),
    '</div></body></html>',
  ].join('')
}

export function webHomeButtonHtml(locale: Locale): string {
  const base = publicBaseUrl()
  if (!base) return ''
  return `<p style="margin-top:1rem"><a class="btn btn-secondary" href="${escapeHtml(base)}">${escapeHtml(cp(locale).goToWebsite)}</a></p>`
}

export function backToManageLink(manageUrl: string | null, locale: Locale): string {
  if (!manageUrl) return ''
  return `<p style="margin-top:1rem"><a class="btn btn-secondary" href="${escapeHtml(manageUrl)}">${escapeHtml(cp(locale).backToManage)}</a></p>`
}

export function appointmentDetailHtml(row: AppointmentRow, locale: Locale): string {
  const t = cp(locale)
  const dateLabel = escapeHtml(formatDisplayDate(row.appointment_date, locale))
  const timeRange = escapeHtml(
    formatAppointmentTimeRange(row.service_id, row.start_time, row.duration_minutes, locale, {
      colorGroupRole: row.color_group_role,
    }),
  )
  const service = escapeHtml(row.service_name)
  const staff = row.staff_name ? `<p>${escapeHtml(t.withStaff(row.staff_name))}</p>` : ''
  return `<div class="detail"><p>📅 ${dateLabel}</p><p>🕐 ${timeRange}</p><p>💇 ${service}</p>${staff}</div>`
}

/** Filas visibles al cliente en un grupo multi-tratamiento (sin lavados enlazados). */
export function customerVisibleBookingRows(rows: AppointmentRow[]): AppointmentRow[] {
  return rows
    .filter((row) => !isColorGroupWashRow(row.color_group_role))
    .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id))
}

export function customerLangSuffix(locale: Locale): string {
  return locale === 'en' ? '&lang=en' : ''
}

export function customerLangQueryHidden(locale: Locale): string {
  return locale === 'en' ? '<input type="hidden" name="lang" value="en">' : ''
}

export type CustomerBookingContext = {
  linkId: string
  linkRow: AppointmentRow
  locale: Locale
  groupRows: AppointmentRow[]
  /** Citas activas del grupo; si hay más de una, hace falta elegir con ?apt= */
  activeRows: AppointmentRow[]
  targetRow: AppointmentRow | null
}

export async function resolveCustomerBookingContext(
  code: string,
  token: string | undefined,
  queryLang: string | undefined,
  aptCode?: string,
): Promise<
  | { ok: true; ctx: CustomerBookingContext }
  | { ok: false; reason: 'invalid' | 'not_found'; locale: Locale }
> {
  const linkId = decodeId(code)
  if (!linkId || !verifyCancelToken(linkId, token)) {
    return { ok: false, reason: 'invalid', locale: resolvePageLocale(null, queryLang) }
  }

  const linkRow = await getAppointmentById(linkId)
  if (!linkRow) {
    return { ok: false, reason: 'not_found', locale: resolvePageLocale(null, queryLang) }
  }

  const locale = resolvePageLocale(linkRow, queryLang)
  const rawGroup = linkRow.booking_group_id
    ? await getAppointmentsByBookingGroup(linkRow.booking_group_id)
    : [linkRow]
  const groupRows = customerVisibleBookingRows(rawGroup)
  const activeRows = groupRows.filter((row) => row.status === 'confirmed')

  let targetRow: AppointmentRow | null = null
  if (activeRows.length <= 1) {
    targetRow = activeRows[0] ?? groupRows.find((row) => row.id === linkId) ?? linkRow
  } else if (aptCode) {
    const aptId = decodeId(aptCode)
    if (aptId && groupRows.some((row) => row.id === aptId)) {
      targetRow = groupRows.find((row) => row.id === aptId) ?? null
    }
  }

  return {
    ok: true,
    ctx: { linkId, linkRow, locale, groupRows, activeRows, targetRow },
  }
}

export function bookingTreatmentSummaryHtml(row: AppointmentRow, locale: Locale): string {
  const t = cp(locale)
  const dateLabel = escapeHtml(formatDisplayDate(row.appointment_date, locale))
  const timeRange = escapeHtml(
    formatAppointmentTimeRange(row.service_id, row.start_time, row.duration_minutes, locale, {
      colorGroupRole: row.color_group_role,
    }),
  )
  const service = escapeHtml(row.service_name)
  const staff = row.staff_name
    ? `<p>${escapeHtml(t.withStaff(row.staff_name))}</p>`
    : ''
  return `<p>💇 ${service}</p>${staff}<p>📅 ${dateLabel}</p><p>🕐 ${timeRange}</p>`
}

export function bookingTreatmentPickerHtml(
  rows: AppointmentRow[],
  locale: Locale,
  options: {
    intro: string
    actionLabel: string
    basePath: string
    token: string
  },
): string {
  const langSuffix = customerLangSuffix(locale)
  const cards = rows
    .map((row) => {
      const href = `${escapeHtml(options.basePath)}?t=${escapeHtml(options.token)}&apt=${encodeURIComponent(encodeId(row.id))}${langSuffix}`
      return `<div class="treatment-card">
        ${bookingTreatmentSummaryHtml(row, locale)}
        <a class="btn btn-primary" href="${href}">${escapeHtml(options.actionLabel)}</a>
      </div>`
    })
    .join('')
  return `<p>${escapeHtml(options.intro)}</p><div class="treatment-list">${cards}</div>`
}

export function changeTreatmentLinkHtml(
  basePath: string,
  token: string,
  locale: Locale,
): string {
  const t = cp(locale).manage
  const href = `${escapeHtml(basePath)}?t=${escapeHtml(token)}${customerLangSuffix(locale)}`
  return `<p><a class="link-back" href="${href}">← ${escapeHtml(t.changeTreatment)}</a></p>`
}

export function bookingGroupDetailHtml(rows: AppointmentRow[], locale: Locale): string {
  const cards = rows
    .map((row) => `<div class="treatment-card">${bookingTreatmentSummaryHtml(row, locale)}</div>`)
    .join('')
  return `<div class="treatment-list">${cards}</div>`
}

export function isMultiTreatmentVisit(groupRows: AppointmentRow[]): boolean {
  return groupRows.length > 1
}

export function visitChangesPromptHtml(
  code: string,
  token: string,
  locale: Locale,
  activeCount: number,
): string {
  const t = cp(locale).visitChanges
  if (activeCount <= 0) return ''

  const manageHref = `/m/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}${customerLangSuffix(locale)}`
  return `<p>${escapeHtml(t.continuePrompt)}</p>
    <p style="margin-top:1rem"><a class="btn btn-primary" href="${escapeHtml(manageHref)}">${escapeHtml(t.continueButton)}</a></p>
    <p class="muted">${escapeHtml(t.finishHint)}</p>`
}

export function cancelAllVisitLinkHtml(
  cancelBase: string,
  token: string,
  locale: Locale,
  options: { sectionLabel: string; buttonLabel: string },
): string {
  const href = `${escapeHtml(cancelBase)}?t=${escapeHtml(token)}&scope=all${customerLangSuffix(locale)}`
  return `<p class="section-label">${escapeHtml(options.sectionLabel)}</p>
    <a class="btn btn-danger" href="${href}">${escapeHtml(options.buttonLabel)}</a>`
}

export function manageErrorMessage(code: string, locale: Locale): string {
  return publicAppointmentErrorMessage(code, locale) ?? cp(locale).changeFailed.defaultError
}

export function customerPageUrlFromRequest(
  reqUrl: string,
  reqPath: string,
  locale: Locale,
): string | undefined {
  const base = publicBaseUrl()
  if (!base) return undefined
  try {
    const incoming = new URL(reqUrl)
    const url = `${base}${incoming.pathname}${incoming.search}`
    if (locale === 'en' && !incoming.searchParams.has('lang')) {
      return appendLocaleToCustomerUrl(url, locale)
    }
    return url
  } catch {
    const path = locale === 'en' ? `${reqPath}?lang=en` : reqPath
    return `${base}${path}`
  }
}

export function renderInvalidLinkPage(
  locale: Locale,
  variant: 'cancel' | 'manage' | 'action' | 'confirm',
): { title: string; html: string } {
  const t = cp(locale).invalidLink
  const body =
    variant === 'cancel'
      ? t.bodyCancel
      : variant === 'manage'
        ? t.bodyManage
        : variant === 'confirm'
          ? t.bodyConfirm
          : t.bodyAction
  return {
    title: t.title,
    html: customerPageShell(
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(body)}</p>`,
      locale,
    ),
  }
}

export function renderNotFoundPage(
  locale: Locale,
  inactive = false,
): { title: string; html: string } {
  const t = cp(locale).notFound
  return {
    title: t.title,
    html: customerPageShell(
      t.title,
      `<h1>${escapeHtml(t.heading)}</h1><p>${escapeHtml(inactive ? t.bodyInactive : t.body)}</p>`,
      locale,
    ),
  }
}
