/** Cliente HTTP para la API de OpenWA (WhatsApp), con reintentos y recuperación. */

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
const RECOVERY_COOLDOWN_MS = 2 * 60_000
const READY_POLL_MS = 2_000
const READY_WAIT_MS = 60_000
const RETRY_BASE_DELAY_MS = 1_500

/** Serializa envíos: Chromium/Puppeteer no aguanta evaluate concurrentes. */
let sendQueue: Promise<unknown> = Promise.resolve()

let lastRecoveryAt = 0
let recoveryInFlight: Promise<boolean> | null = null

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

/** Fallos típicos de Chromium/Puppeteer colgado o red inestable. */
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
    msg.includes('page crashed')
  )
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
 * Recupera un Chromium colgado: stop → start → espera `ready`.
 * Cooldown global para no martillar OpenWA si fallan muchos envíos a la vez.
 */
export async function openWaRecoverSession(force = false): Promise<boolean> {
  const config = getOpenWaConfig()
  if (!config) return false

  if (recoveryInFlight) return recoveryInFlight

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
      return await run()
    } catch (err) {
      lastErr = err
      const transient = isTransientOpenWaError(err)
      console.warn(
        `Superpelu OpenWA ${label}: intento ${attempt}/${attempts} falló${transient ? ' (transitorio)' : ''}: ${errorMessage(err)}`,
      )

      if (!transient || attempt >= attempts) break

      if (allowRecovery && attempt >= 2) {
        await openWaRecoverSession()
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
 * Si la sesión no está conectada (p. ej. tras reiniciar OpenWA), intenta
 * arrancarla. Como la autenticación persiste en el volumen, reconecta a
 * `ready` sin pedir QR nuevo.
 */
export async function openWaEnsureStarted(): Promise<void> {
  const config = getOpenWaConfig()
  if (!config) return
  try {
    const session = await openWaGetSessionStatus()
    if (session && isOpenWaSessionConnected(session.status)) return
    console.log('Superpelu OpenWA: sesión no conectada, intentando reconectar…')
    await openWaStartSession(config.sessionId)
    await waitUntilSessionReady(config.sessionId, 30_000)
  } catch (err) {
    console.error('Superpelu OpenWA reconexión:', err)
  }
}

/** Mantiene viva la conexión: reconecta al arrancar y cada pocos minutos. */
export function startOpenWaKeepAlive(): void {
  if (!getOpenWaConfig()) return
  setTimeout(() => void openWaEnsureStarted(), 20_000)
  setInterval(() => void openWaEnsureStarted(), 5 * 60_000)
}

export function logOpenWaStartup(): void {
  const config = getOpenWaConfig()
  if (config) {
    console.log(
      `Superpelu: OpenWA activo → ${config.apiUrl} (sesión ${config.sessionId})${
        config.notifyPublicOnly ? ', solo reservas públicas' : ''
      } (reintentos + cola + recuperación stop/start)`,
    )
    return
  }
  if (envFlag('OPENWA_ENABLED')) {
    console.warn(
      'Superpelu: OPENWA_ENABLED=true pero faltan OPENWA_API_KEY u OPENWA_SESSION_ID — WhatsApp desactivado',
    )
  }
}
