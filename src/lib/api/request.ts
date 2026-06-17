const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    })
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Comprueba que la app esté desplegada y en marcha.',
    )
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const isHtml = contentType.includes('text/html')
    const hint =
      res.status === 500 && import.meta.env.DEV
        ? ' En desarrollo: ejecuta npm run dev (web + API) o arranca la API en el puerto 3001.'
        : isHtml && res.ok
          ? ' La ruta /api devuelve HTML: en Coolify quita la etiqueta caddy_0.try_files.'
          : ' Abre /api/health en el navegador (debe ser JSON).'
    throw new ApiError(
      res.ok
        ? `El servidor devolvió una respuesta inválida (¿la API está activa?).${hint}`
        : `Error del servidor (${res.status}).${hint}`,
      res.status,
    )
  }

  const data = await res.json().catch(() => {
    throw new ApiError('Respuesta JSON inválida del servidor.', res.status)
  })

  if (!res.ok) {
    const payload = data as { error?: string; code?: string }
    throw new ApiError(payload.error ?? 'Error en la solicitud', res.status, payload.code)
  }

  return data as T
}

export function adminHeaders(adminToken: string) {
  return { Authorization: `Bearer ${adminToken}` }
}

export function encodeServiceStartOverrides(overrides: (string | undefined)[]): string {
  return overrides.map((value) => value ?? '_').join(',')
}
