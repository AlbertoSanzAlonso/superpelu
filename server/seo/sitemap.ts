/** Páginas públicas que Google debe poder descubrir. Sin agenda, clientes ni enlaces de cita. */
const PUBLIC_PATHS = ['/', '/salon', '/reservar', '/politica-de-cookies'] as const

/** Rutas de trabajo y enlaces personales: no indexar. */
const PRIVATE_PREFIXES = [
  '/agenda',
  '/horarios',
  '/servicios',
  '/personal',
  '/stats',
  '/clientes',
  '/api/',
  '/c/',
  '/m/',
  '/a/',
] as const

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function sitemapXml(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const urls = PUBLIC_PATHS.map((pagePath) => {
    const loc = pagePath === '/' ? `${base}/` : `${base}${pagePath}`
    return `  <url><loc>${xmlEscape(loc)}</loc></url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}

export function robotsTxt(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PREFIXES.map((prefix) => `Disallow: ${prefix}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ]
  return lines.join('\n')
}
