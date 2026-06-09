/** Cliente HTTP para la API de OpenWA (WhatsApp). */

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

function envFlag(name: string): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
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

async function openWaFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = getOpenWaConfig()
  if (!config) throw new Error('OPENWA_NO_CONFIG')

  const url = `${config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': config.apiKey,
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(20_000),
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

export async function openWaSendText(chatId: string, text: string): Promise<string | undefined> {
  const config = getOpenWaConfig()
  if (!config) return undefined

  const data = await openWaFetch<{ messageId?: string }>(
    `/sessions/${encodeURIComponent(config.sessionId)}/messages/send-text`,
    {
      method: 'POST',
      body: JSON.stringify({ chatId, text }),
    },
  )
  return data.messageId
}

export type OpenWaImagePayload = { url: string } | { base64: string }

export async function openWaSendImage(
  chatId: string,
  image: OpenWaImagePayload,
  caption?: string,
): Promise<string | undefined> {
  const config = getOpenWaConfig()
  if (!config) return undefined

  const data = await openWaFetch<{ messageId?: string }>(
    `/sessions/${encodeURIComponent(config.sessionId)}/messages/send-image`,
    {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        image,
        ...(caption?.trim() ? { caption: caption.trim() } : {}),
      }),
    },
  )
  return data.messageId
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

async function openWaAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getOpenWaAdminConfig()
  if (!config) throw new Error('OPENWA_NO_CONFIG')

  const url = `${config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': config.apiKey,
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(20_000),
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
    await openWaAdminFetch(`/sessions/${encodeURIComponent(id)}/start`, { method: 'POST' })
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
      }`,
    )
    return
  }
  if (envFlag('OPENWA_ENABLED')) {
    console.warn(
      'Superpelu: OPENWA_ENABLED=true pero faltan OPENWA_API_KEY u OPENWA_SESSION_ID — WhatsApp desactivado',
    )
  }
}
