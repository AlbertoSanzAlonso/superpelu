/** Cliente HTTP para la API de OpenWA (WhatsApp), con reintentos y recuperación. */

// Importación diferida para evitar ciclo: openwa ← email (ambos en notifications/)
async function sendWhatsAppDownAlert(minutesDown: number): Promise<void> {
  try {
    const { getEmailConfig } = await import('@server/notifications/email.js')
    const nodemailer = await import('nodemailer')
    const config = getEmailConfig()
    if (!config) return

    // Incluir siempre albertosanzdev@gmail.com aunque no esté en ADMIN_NOTIFICATION_EMAIL
    const to = Array.from(new Set([...config.to, 'albertosanzdev@gmail.com']))

    const transporter = nodemailer.default.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    })

    await transporter.sendMail({
      from: config.from,
      to,
      subject: `⚠️ WhatsApp Superpelu caído (${minutesDown} min)`,
      text: [
        `El servicio de WhatsApp de Superpelu lleva más de ${minutesDown} minutos sin conectar.`,
        '',
        'Acciones recomendadas:',
        '1. Comprueba estado: https://superpelubenalmadena.es/api/admin/whatsapp',
        '2. Escanea QR si hace falta: https://superpelubenalmadena.es/api/admin/whatsapp/qr',
        '3. Si sigue caído: Coolify → OpenWA → Restart',
        '',
        'Este aviso se enviará una vez por caída (no se repetirá hasta que vuelva y vuelva a caer).',
      ].join('\n'),
      html: `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"></head>
<body style="font-family:system-ui;background:#faf7f5;padding:24px;color:#2b2b2b;">
<table style="max-width:520px;background:#fff;border-radius:12px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,.07);">
<tr><td style="background:#c0392b;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;font-size:18px;font-weight:700;">
⚠️ WhatsApp Superpelu caído
</td></tr>
<tr><td style="padding:20px;">
<p>El servicio de WhatsApp lleva más de <strong>${minutesDown} minutos</strong> sin conectar.</p>
<p><strong>Acciones recomendadas:</strong></p>
<ol>
<li><a href="https://superpelubenalmadena.es/api/admin/whatsapp">Comprobar estado</a></li>
<li><a href="https://superpelubenalmadena.es/api/admin/whatsapp/qr">Escanear QR si hace falta</a></li>
<li>Si sigue caído: Coolify → OpenWA → Restart</li>
</ol>
<p style="color:#888;font-size:13px;">Este aviso se envía una vez por caída; no se repetirá hasta que vuelva y caiga de nuevo.</p>
</td></tr></table>
</body></html>`,
    })
    console.log(`Superpelu OpenWA: alerta de caída enviada a ${to.join(', ')}`)
  } catch (err) {
    console.error('Superpelu OpenWA: error enviando alerta de caída por email:', err)
  }
}

export type OpenWaConfig = {
  enabled: true
  apiUrl: string
  apiKey: string
  sessionId: string
  notifyPublicOnly: boolean
}

type OpenWaApiResponse<T> = {
  success?: boolean
  data?: T
  error?: { message?: string; code?: string }
}

/** Opciones por envío (logo usa intentos cortos; texto usa recuperación completa). */
export type OpenWaSendOptions = {
  /** Intentos totales (default 3 para texto, 1 si se indica). */
  attempts?: number
  /** Timeout HTTP por intento (ms). */
  timeoutMs?: number
  /** Si true, ante fallo transitorio hace stop→start de la sesión (con cooldown). */
  allowRecovery?: boolean
}

const DEFAULT_SEND_TIMEOUT_MS = 45_000
const DEFAULT_SEND_ATTEMPTS = 3
const ADMIN_TIMEOUT_MS = 20_000
/** Evita martillar stop/start; solo aplica si OPENWA_AUTO_STOP_START=true. */
const RECOVERY_COOLDOWN_MS = 90_000
const READY_POLL_MS = 2_000
const READY_WAIT_MS = 90_000
const RETRY_BASE_DELAY_MS = 1_500
/** Watchdog cada minuto: arranca si hace falta; no hace stop→start por defecto. */
const WATCHDOG_INTERVAL_MS = 60_000
const WATCHDOG_BOOT_DELAY_MS = 15_000
/** Fallos de envío seguidos (solo diagnóstico; ya no disparan stop→start automático). */
const ZOMBIE_FAILURE_THRESHOLD = 3
/** Ticks sin ready antes de reintentar solo `start` (sin stop). */
const DISCONNECTED_RECOVER_TICKS = 3
/** Log de “esperando QR” como máximo cada N ms (evita spam). */
const QR_WAIT_LOG_COOLDOWN_MS = 5 * 60_000

/**
 * stop→start automático invalida a menudo el vínculo de WhatsApp.
 * Por defecto OFF: solo `start` suave + alerta email; stop→start solo vía
 * POST /api/admin/whatsapp/reconnect o OPENWA_AUTO_STOP_START=true.
 */
function autoStopStartEnabled(): boolean {
  return envFlag('OPENWA_AUTO_STOP_START')
}

/** Serializa envíos: Chromium/Puppeteer no aguanta evaluate concurrentes. */
let sendQueue: Promise<unknown> = Promise.resolve()

let lastRecoveryAt = 0
let recoveryInFlight: Promise<boolean> | null = null
let consecutiveSendFailures = 0
let disconnectedWatchdogTicks = 0
let watchdogStarted = false
let lastQrWaitLogAt = 0

/** Cuántos ticks seguidos lleva caído (not ready, no QR) para la alerta de email. */
let downAlertTicks = 0
/** Si ya se ha enviado la alerta de caída para el episodio actual (no repetir hasta que vuelva). */
let downAlertSent = false
/** Ticks seguidos caído antes de enviar email (~10 min con watchdog cada 60 s). */
const DOWN_ALERT_TICKS = 10

function envFlag(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getOpenWaConfig(): OpenWaConfig | null {
  if (!envFlag('OPENWA_ENABLED')) return null

  const apiKey = (process.env.OPENWA_API_KEY ?? '').trim()
  const sessionId = (process.env.OPENWA_SESSION_ID ?? '').trim()
  if (!apiKey || !sessionId) return null

  const apiUrl = (process.env.OPENWA_API_URL ?? 'http://openwa:2785/api').replace(/\/$/, '')

  return {
    enabled: true,
    apiKey,
    sessionId,
    apiUrl,
    notifyPublicOnly: envFlag('OPENWA_NOTIFY_PUBLIC_ONLY'),
  }
}

export function isOpenWaConfigured(): boolean {
  return getOpenWaConfig() !== null
}

/** Config para tareas de administración (crear sesión, QR): no requiere SESSION_ID. */
export type OpenWaAdminConfig = { apiUrl: string; apiKey: string }

export function getOpenWaAdminConfig(): OpenWaAdminConfig | null {
  if (!envFlag('OPENWA_ENABLED')) return null
  const apiKey = (process.env.OPENWA_API_KEY ?? '').trim()
  if (!apiKey) return null
  const apiUrl = (process.env.OPENWA_API_URL ?? 'http://openwa:2785/api').replace(/\/$/, '')
  return { apiUrl, apiKey }
}

/** Nombre de sesión para el flujo de alta por navegador. */
export function openWaSessionName(): string {
  return (process.env.OPENWA_SESSION_NAME ?? 'superpelu').trim() || 'superpelu'
}

/** OpenWA devuelve `ready`; la documentación antigua usa `CONNECTED`. */
export function isOpenWaSessionConnected(status: string | undefined): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return s === 'ready' || s === 'connected'
}

/**
 * Sesión viva esperando emparejar el móvil (QR) o autenticando.
 * Hacer stop→start aquí invalida el QR y puede forzar re-vínculos innecesarios.
 */
export function isOpenWaSessionAwaitingLink(status: string | undefined): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return (
    s === 'qr_ready' ||
    s === 'authenticating' ||
    s === 'initializing' ||
    s === 'action_required'
  )
}

function logQrWaitOnce(context: string, status: string): void {
  const now = Date.now()
  if (now - lastQrWaitLogAt < QR_WAIT_LOG_COOLDOWN_MS) return
  lastQrWaitLogAt = now
  console.warn(
    `Superpelu OpenWA ${context}: status=${status} — esperando escanear QR ` +
      `(/api/admin/whatsapp/qr). No se hace stop→start para no invalidar el vínculo.`,
  )
}

/** E.164 (+34…) → chatId de WhatsApp (34600…@c.us). */
export function phoneToWhatsAppChatId(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  if (!digits) throw new Error('TELEFONO_INVALIDO')
  return `${digits}@c.us`
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

/** Fallos típicos de Chromium/Puppeteer colgado, sesión caída o red inestable. */
export function isTransientOpenWaError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase()
  return (
    msg.includes('protocol') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('socket') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('service unavailable') ||
    msg.includes('execution context') ||
    msg.includes('target closed') ||
    msg.includes('session closed') ||
    msg.includes('browser') ||
    msg.includes('navigat') ||
    msg.includes('frame was detached') ||
    msg.includes('page crashed') ||
    msg.includes('not connected') ||
    msg.includes('not ready') ||
    msg.includes('client is not ready') ||
    msg.includes('session is not connected')
  )
}

function noteSendSuccess(): void {
  consecutiveSendFailures = 0
}

function noteSendFailure(): void {
  consecutiveSendFailures += 1
}

async function openWaFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const config = getOpenWaConfig()
  if (!config) throw new Error('OPENWA_NO_CONFIG')

  const { timeoutMs = ADMIN_TIMEOUT_MS, ...rest } = init ?? {}
  const url = `${config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': config.apiKey,
      ...(rest.headers ?? {}),
    },
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
  })

  const body = (await res.json().catch(() => ({}))) as OpenWaApiResponse<T>
  if (!res.ok) {
    const msg =
      body.error?.message ??
      (typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : res.statusText)
    throw new Error(`OpenWA ${res.status}: ${msg}`)
  }
  if (body.success === false) {
    throw new Error(body.error?.message ?? 'OpenWA request failed')
  }
  return (body.data ?? body) as T
}

async function openWaAdminFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const config = getOpenWaAdminConfig()
  if (!config) throw new Error('OPENWA_NO_CONFIG')

  const { timeoutMs = ADMIN_TIMEOUT_MS, ...rest } = init ?? {}
  const url = `${config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': config.apiKey,
      ...(rest.headers ?? {}),
    },
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
  })

  const body = (await res.json().catch(() => ({}))) as OpenWaApiResponse<T>
  if (!res.ok) {
    const msg =
      body.error?.message ??
      (typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : res.statusText)
    throw new Error(`OpenWA ${res.status}: ${msg}`)
  }
  return (body.data ?? body) as T
}

function enqueueSend<T>(fn: () => Promise<T>): Promise<T> {
  const run = sendQueue.then(fn, fn)
  sendQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function waitUntilSessionReady(sessionId: string, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const session = await openWaGetSessionById(sessionId)
    if (isOpenWaSessionConnected(session?.status)) return true
    await sleep(READY_POLL_MS)
  }
  return false
}

/** Para la sesión Chromium (no hace logout del móvil). */
export async function openWaStopSession(id: string): Promise<void> {
  try {
    await openWaAdminFetch(`/sessions/${encodeURIComponent(id)}/stop`, {
      method: 'POST',
      timeoutMs: 30_000,
    })
  } catch (err) {
    console.warn('Superpelu OpenWA stop:', errorMessage(err))
  }
}

/**
 * Recupera sesión.
 * - Por defecto: solo `start` suave (no rompe el vínculo).
 * - stop→start solo si OPENWA_AUTO_STOP_START=true o hard=true
 *   (hard=true desde POST /api/admin/whatsapp/reconnect).
 * - force=true: ignora cooldown entre recuperaciones duras.
 */
export async function openWaRecoverSession(force = false, hard = false): Promise<boolean> {
  const config = getOpenWaConfig()
  if (!config) return false

  if (recoveryInFlight) return recoveryInFlight

  const allowHardRecover = hard || autoStopStartEnabled()
  if (!allowHardRecover) {
    console.warn(
      'Superpelu OpenWA: stop→start omitido (OPENWA_AUTO_STOP_START off). Solo start suave.',
    )
    try {
      await openWaStartSession(config.sessionId)
      return waitUntilSessionReady(config.sessionId, READY_WAIT_MS)
    } catch (err) {
      console.error('Superpelu OpenWA start suave:', err)
      return false
    }
  }

  const now = Date.now()
  if (!force && now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) {
    console.warn(
      `Superpelu OpenWA: recuperación omitida (cooldown ${Math.ceil((RECOVERY_COOLDOWN_MS - (now - lastRecoveryAt)) / 1000)}s)`,
    )
    return false
  }

  recoveryInFlight = (async () => {
    lastRecoveryAt = Date.now()
    console.warn('Superpelu OpenWA: recuperando sesión (stop → start)…')
    try {
      await openWaStopSession(config.sessionId)
      await sleep(2_000)
      await openWaStartSession(config.sessionId)
      const ready = await waitUntilSessionReady(config.sessionId, READY_WAIT_MS)
      if (ready) {
        consecutiveSendFailures = 0
        disconnectedWatchdogTicks = 0
        console.log('Superpelu OpenWA: sesión recuperada (ready)')
        return true
      }
      console.error('Superpelu OpenWA: tras stop/start la sesión no llegó a ready')
      return false
    } catch (err) {
      console.error('Superpelu OpenWA recuperación:', err)
      return false
    } finally {
      recoveryInFlight = null
    }
  })()

  return recoveryInFlight
}

async function withSendResilience<T>(
  label: string,
  run: () => Promise<T>,
  options?: OpenWaSendOptions,
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? DEFAULT_SEND_ATTEMPTS)
  const allowRecovery = options?.allowRecovery !== false
  let lastErr: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (allowRecovery) {
        await openWaEnsureStarted()
      }
      const result = await run()
      noteSendSuccess()
      return result
    } catch (err) {
      lastErr = err
      const msg = errorMessage(err)
      // Número inválido / no en WA: no es fallo de Chromium; no contar para zombie ni recuperar.
      const recipientError =
        msg.toLowerCase().includes('could not resolve the recipient') ||
        msg.toLowerCase().includes('not on whatsapp')
      if (allowRecovery && !recipientError) {
        noteSendFailure()
      }
      const transient = !recipientError && isTransientOpenWaError(err)
      console.warn(
        `Superpelu OpenWA ${label}: intento ${attempt}/${attempts} falló${
          recipientError ? ' (destinatario)' : transient ? ' (transitorio)' : ''
        }: ${msg}`,
      )

      if (recipientError || !transient || attempt >= attempts) break

      if (allowRecovery) {
        const current = await openWaGetSessionStatus()
        if (current && isOpenWaSessionAwaitingLink(current.status)) {
          logQrWaitOnce('send', current.status)
          break
        }
        // Solo start suave + espera. stop→start solo si OPENWA_AUTO_STOP_START=true.
        await openWaEnsureStarted()
        if (autoStopStartEnabled() && attempt >= 2) {
          await openWaRecoverSession(attempt >= 3)
        } else {
          await sleep(RETRY_BASE_DELAY_MS * attempt)
        }
      } else {
        await sleep(RETRY_BASE_DELAY_MS * attempt)
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(errorMessage(lastErr))
}

export async function openWaSendText(
  chatId: string,
  text: string,
  options?: OpenWaSendOptions,
): Promise<string | undefined> {
  const config = getOpenWaConfig()
  if (!config) return undefined

  const timeoutMs = options?.timeoutMs ?? DEFAULT_SEND_TIMEOUT_MS

  return enqueueSend(() =>
    withSendResilience(
      'send-text',
      () =>
        openWaFetch<{ messageId?: string }>(
          `/sessions/${encodeURIComponent(config.sessionId)}/messages/send-text`,
          {
            method: 'POST',
            body: JSON.stringify({ chatId, text }),
            timeoutMs,
          },
        ).then((data) => data.messageId),
      options,
    ),
  )
}

export async function openWaSendImage(
  chatId: string,
  image: string,
  caption?: string,
  options?: OpenWaSendOptions,
): Promise<string | undefined> {
  const config = getOpenWaConfig()
  if (!config) return undefined

  const timeoutMs = options?.timeoutMs ?? DEFAULT_SEND_TIMEOUT_MS

  return enqueueSend(() =>
    withSendResilience(
      'send-image',
      () =>
        openWaFetch<{ messageId?: string }>(
          `/sessions/${encodeURIComponent(config.sessionId)}/messages/send-image`,
          {
            method: 'POST',
            body: JSON.stringify({
              chatId,
              image,
              ...(caption?.trim() ? { caption: caption.trim() } : {}),
            }),
            timeoutMs,
          },
        ).then((data) => data.messageId),
      options,
    ),
  )
}

export type OpenWaSessionStatus = {
  id: string
  name?: string
  status: string
  phone?: string | null
  phoneNumber?: string
  pushName?: string | null
}

export async function openWaGetSessionStatus(): Promise<OpenWaSessionStatus | null> {
  const config = getOpenWaConfig()
  if (!config) return null

  try {
    return await openWaFetch<OpenWaSessionStatus>(
      `/sessions/${encodeURIComponent(config.sessionId)}`,
      { method: 'GET' },
    )
  } catch (err) {
    console.error('Superpelu OpenWA session:', err)
    return null
  }
}

/** Lista las sesiones existentes en OpenWA. */
export async function openWaListSessions(): Promise<OpenWaSessionStatus[]> {
  const data = await openWaAdminFetch<OpenWaSessionStatus[]>('/sessions', { method: 'GET' })
  return Array.isArray(data) ? data : []
}

/** Devuelve la sesión con el nombre dado, creándola si no existe. */
export async function openWaEnsureSession(name: string): Promise<OpenWaSessionStatus> {
  const sessions = await openWaListSessions()
  const found = sessions.find((s) => s.name === name)
  if (found) return found
  return openWaAdminFetch<OpenWaSessionStatus>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

/** Arranca una sesión (genera QR). Ignora el error si ya estaba arrancada. */
export async function openWaStartSession(id: string): Promise<void> {
  try {
    await openWaAdminFetch(`/sessions/${encodeURIComponent(id)}/start`, {
      method: 'POST',
      timeoutMs: 30_000,
    })
  } catch (err) {
    console.warn('Superpelu OpenWA start:', String(err))
  }
}

/** Obtiene el QR (data URL PNG) de una sesión, o null si no está disponible. */
export async function openWaGetQr(id: string): Promise<string | null> {
  try {
    const data = await openWaAdminFetch<{ qrCode?: string }>(
      `/sessions/${encodeURIComponent(id)}/qr`,
      { method: 'GET' },
    )
    return data.qrCode ?? null
  } catch {
    return null
  }
}

/** Estado de una sesión por id (admin, sin requerir OPENWA_SESSION_ID). */
export async function openWaGetSessionById(id: string): Promise<OpenWaSessionStatus | null> {
  try {
    return await openWaAdminFetch<OpenWaSessionStatus>(`/sessions/${encodeURIComponent(id)}`, {
      method: 'GET',
    })
  } catch {
    return null
  }
}

/**
 * Si la sesión no está conectada (p. ej. tras reiniciar OpenWA en Coolify),
 * la arranca y espera `ready`. No hace stop→start salvo OPENWA_AUTO_STOP_START.
 * Si pide QR, no se toca.
 */
export async function openWaEnsureStarted(): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return
  try {
    if (recoveryInFlight) {
      await recoveryInFlight
      return
    }

    const session = await openWaGetSessionStatus()
    if (session && isOpenWaSessionConnected(session.status)) {
      if (consecutiveSendFailures >= ZOMBIE_FAILURE_THRESHOLD) {
        console.warn(
          `Superpelu OpenWA: ready pero ${consecutiveSendFailures} fallos seguidos` +
            (autoStopStartEnabled()
              ? ' → stop/start (OPENWA_AUTO_STOP_START)'
              : ' (sin stop/start; OPENWA_AUTO_STOP_START off)'),
        )
        if (autoStopStartEnabled()) {
          await openWaRecoverSession()
        }
      }
      return
    }

    if (session && isOpenWaSessionAwaitingLink(session.status)) {
      logQrWaitOnce('ensureStarted', session.status)
      return
    }

    console.log(
      `Superpelu OpenWA: sesión no conectada (${session?.status ?? 'sin respuesta'}), arrancando…`,
    )
    await openWaStartSession(config.sessionId)

    const afterStart = await openWaGetSessionById(config.sessionId)
    if (afterStart && isOpenWaSessionAwaitingLink(afterStart.status)) {
      logQrWaitOnce('ensureStarted', afterStart.status)
      return
    }

    const ready = await waitUntilSessionReady(config.sessionId, 45_000)
    if (ready) {
      disconnectedWatchdogTicks = 0
      return
    }

    const still = await openWaGetSessionById(config.sessionId)
    if (still && isOpenWaSessionAwaitingLink(still.status)) {
      logQrWaitOnce('ensureStarted', still.status)
      return
    }

    if (autoStopStartEnabled()) {
      console.warn('Superpelu OpenWA: no llegó a ready tras start → stop/start (AUTO_STOP_START)')
      await openWaRecoverSession(true)
    } else {
      console.warn(
        'Superpelu OpenWA: no llegó a ready tras start — no se hace stop/start ' +
          '(OPENWA_AUTO_STOP_START off; escanear QR o POST …/whatsapp/reconnect)',
      )
    }
  } catch (err) {
    console.error('Superpelu OpenWA reconexión:', err)
  }
}

/**
 * Watchdog: cada minuto comprueba si OpenWA/sesión están vivos.
 * Por defecto solo hace `start` (nunca stop→start): reiniciar Chromium
 * invalidaba el vínculo de WhatsApp casi a diario.
 */
export async function openWaWatchdogTick(): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return

  try {
    if (recoveryInFlight) {
      await recoveryInFlight
      return
    }

    const session = await openWaGetSessionStatus()

    if (!session) {
      disconnectedWatchdogTicks += 1
      downAlertTicks += 1
      console.warn('Superpelu OpenWA watchdog: no hay sesión / API caída — intentando start')
      await openWaStartSession(config.sessionId)
      if (autoStopStartEnabled() && disconnectedWatchdogTicks >= DISCONNECTED_RECOVER_TICKS) {
        await openWaRecoverSession(true)
      }
      if (!downAlertSent && downAlertTicks >= DOWN_ALERT_TICKS) {
        downAlertSent = true
        void sendWhatsAppDownAlert(Math.round((downAlertTicks * WATCHDOG_INTERVAL_MS) / 60_000))
      }
      return
    }

    if (isOpenWaSessionAwaitingLink(session.status)) {
      disconnectedWatchdogTicks = 0
      downAlertTicks += 1
      logQrWaitOnce('watchdog', session.status)
      if (!downAlertSent && downAlertTicks >= DOWN_ALERT_TICKS) {
        downAlertSent = true
        void sendWhatsAppDownAlert(Math.round((downAlertTicks * WATCHDOG_INTERVAL_MS) / 60_000))
      }
      return
    }

    if (!isOpenWaSessionConnected(session.status)) {
      disconnectedWatchdogTicks += 1
      downAlertTicks += 1
      console.warn(
        `Superpelu OpenWA watchdog: status=${session.status} (tick ${disconnectedWatchdogTicks}) — start suave`,
      )
      await openWaStartSession(config.sessionId)

      const afterStart = await openWaGetSessionById(config.sessionId)
      if (afterStart && isOpenWaSessionAwaitingLink(afterStart.status)) {
        disconnectedWatchdogTicks = 0
        logQrWaitOnce('watchdog', afterStart.status)
        return
      }

      const ready = await waitUntilSessionReady(config.sessionId, 45_000)
      if (ready) {
        disconnectedWatchdogTicks = 0
        consecutiveSendFailures = 0
        return
      }

      const still = await openWaGetSessionById(config.sessionId)
      if (still && isOpenWaSessionAwaitingLink(still.status)) {
        disconnectedWatchdogTicks = 0
        logQrWaitOnce('watchdog', still.status)
        return
      }

      if (autoStopStartEnabled() && disconnectedWatchdogTicks >= DISCONNECTED_RECOVER_TICKS) {
        await openWaRecoverSession(true)
      }
      if (!downAlertSent && downAlertTicks >= DOWN_ALERT_TICKS) {
        downAlertSent = true
        void sendWhatsAppDownAlert(Math.round((downAlertTicks * WATCHDOG_INTERVAL_MS) / 60_000))
      }
      return
    }

    disconnectedWatchdogTicks = 0
    downAlertTicks = 0
    downAlertSent = false

    if (consecutiveSendFailures >= ZOMBIE_FAILURE_THRESHOLD) {
      console.warn(
        `Superpelu OpenWA watchdog: ${consecutiveSendFailures} fallos de envío con status ready` +
          (autoStopStartEnabled()
            ? ' → stop/start (OPENWA_AUTO_STOP_START)'
            : ' (sin stop/start automático)'),
      )
      if (autoStopStartEnabled()) {
        await openWaRecoverSession()
      }
    }
  } catch (err) {
    disconnectedWatchdogTicks += 1
    downAlertTicks += 1
    console.warn(`Superpelu OpenWA watchdog: error (${errorMessage(err)}) — start suave`)
    try {
      await openWaStartSession(config.sessionId)
    } catch {
      /* ignore */
    }
    if (autoStopStartEnabled() && disconnectedWatchdogTicks >= DISCONNECTED_RECOVER_TICKS) {
      await openWaRecoverSession(true)
    }
    if (!downAlertSent && downAlertTicks >= DOWN_ALERT_TICKS) {
      downAlertSent = true
      void sendWhatsAppDownAlert(Math.round((downAlertTicks * WATCHDOG_INTERVAL_MS) / 60_000))
    }
  }
}

/** Mantiene viva la conexión: watchdog al arrancar y cada minuto. */
export function startOpenWaKeepAlive(): void {
  if (!getOpenWaConfig() || watchdogStarted) return
  watchdogStarted = true
  setTimeout(() => void openWaWatchdogTick(), WATCHDOG_BOOT_DELAY_MS)
  setInterval(() => void openWaWatchdogTick(), WATCHDOG_INTERVAL_MS)
  console.log(
    'Superpelu OpenWA: watchdog activo (cada 60s; solo start suave; ' +
      `stop→start auto=${autoStopStartEnabled() ? 'ON' : 'OFF'})`,
  )
}

export function logOpenWaStartup(): void {
  const config = getOpenWaConfig()
  if (config) {
    console.log(
      `Superpelu: OpenWA activo → ${config.apiUrl} (sesión ${config.sessionId})${
        config.notifyPublicOnly ? ', solo reservas públicas' : ''
      } (watchdog: start suave; stop→start auto=${autoStopStartEnabled() ? 'ON' : 'OFF'})`,
    )
    return
  }
  if (envFlag('OPENWA_ENABLED')) {
    console.warn(
      'Superpelu: OPENWA_ENABLED=true pero faltan OPENWA_API_KEY u OPENWA_SESSION_ID — WhatsApp desactivado',
    )
  }
}
