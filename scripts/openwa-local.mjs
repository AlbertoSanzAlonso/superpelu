#!/usr/bin/env node
/**
 * Configura OpenWA en local: levanta Docker (si hace falta), lee API key,
 * lista/crea sesión y actualiza OPENWA_* en .env de Superpelu.
 *
 * Uso: node scripts/openwa-local.mjs [--no-docker] [--no-env]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const openwaDir = join(root, 'openwa')
const composeFile = join(root, 'deploy', 'openwa-local.compose.yml')
const envPath = join(root, '.env')
const apiKeyFile = join(openwaDir, 'data', '.api-key')
const qrHtmlPath = join(root, 'openwa-qr.html')
const apiBase = (process.env.OPENWA_API_URL ?? 'http://127.0.0.1:2785/api').replace(/\/$/, '')

const flags = new Set(process.argv.slice(2))
const skipDocker = flags.has('--no-docker')
const skipEnv = flags.has('--no-env')

const DOCKER_CANDIDATES = [
  'docker',
  '/usr/bin/docker',
  '/usr/local/bin/docker',
  '/snap/bin/docker',
]

function resolveDockerBin() {
  for (const bin of DOCKER_CANDIDATES) {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8' })
    if (r.status === 0) return bin
  }
  return null
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: opts.cwd ?? root,
    ...opts,
  })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.status !== 0) {
    if (out.includes('permission denied') && out.includes('docker.sock')) {
      printDockerPermissionHint()
    }
    process.exit(r.status ?? 1)
  }
}

function printDockerPermissionHint() {
  console.error('')
  console.error('Si ves "permission denied" en docker.sock, tu sesión aún no tiene el grupo docker:')
  console.error('  newgrp docker          # en esta terminal (rápido)')
  console.error('  # o cierra sesión y vuelve a entrar')
  console.error('  docker run --rm hello-world')
  console.error('  npm run openwa:setup')
  console.error('')
}

function readApiKey() {
  if (existsSync(apiKeyFile)) {
    const k = readFileSync(apiKeyFile, 'utf8').trim()
    if (k) return k
  }
  return 'dev-admin-key'
}

async function waitHealthy(maxSec = 180) {
  const deadline = Date.now() + maxSec * 1000
  process.stdout.write('Esperando API OpenWA')
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiBase}/health`)
      if (res.ok) {
        console.log(' ✓')
        return
      }
    } catch {
      /* retry */
    }
    process.stdout.write('.')
    await new Promise((r) => setTimeout(r, 3000))
  }
  console.log('')
  console.error(`\nLa API no respondió en ${maxSec}s. Revisa: npm run openwa:logs`)
  process.exit(1)
}

async function api(path, init = {}) {
  const key = readApiKey()
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-API-Key': key,
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? res.statusText
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${msg}`)
  }
  return body.data ?? body
}

function patchEnv(updates) {
  if (!existsSync(envPath)) {
    console.error('No existe .env — copia .env.example')
    process.exit(1)
  }
  let text = readFileSync(envPath, 'utf8')
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^${key}=.*$`, 'm')
    const line = `${key}=${value}`
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`
  }
  writeFileSync(envPath, text)
}

async function writeQrHtml(sessionId) {
  try {
    const qr = await api(`/sessions/${encodeURIComponent(sessionId)}/qr`)
    const src = qr?.qrCode
    if (!src || typeof src !== 'string') return false
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>OpenWA QR</title>
<style>body{font-family:system-ui;text-align:center;padding:2rem}img{max-width:320px}</style></head>
<body><h1>WhatsApp — Superpelu</h1><p>Escanea con el móvil del salón</p><img src="${src}" alt="QR"></body></html>`
    writeFileSync(qrHtmlPath, html, 'utf8')
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!existsSync(join(openwaDir, 'Dockerfile'))) {
    console.error('Falta openwa/ — clona: git clone https://github.com/rmyndharis/OpenWA.git openwa')
    process.exit(1)
  }
  if (!existsSync(composeFile)) {
    console.error('Falta deploy/openwa-local.compose.yml')
    process.exit(1)
  }

  if (!skipDocker) {
    const dockerBin = resolveDockerBin()
    if (!dockerBin) {
      console.error('Docker no está instalado o no está en el PATH.')
      console.error('')
      console.error('En Pop!_OS / Ubuntu, instálalo en tu terminal:')
      console.error('  sudo bash scripts/install-docker.sh')
      console.error('  newgrp docker    # o cierra sesión y vuelve a entrar')
      console.error('  npm run openwa:setup')
      console.error('')
      console.error('Guía oficial: https://docs.docker.com/engine/install/ubuntu/')
      process.exit(1)
    }
    console.log(
      'Levantando OpenWA (solo API; sin dashboard — evita fallo npm del frontend). Primer build ~3–5 min…',
    )
    run(dockerBin, ['compose', '-f', composeFile, 'up', '-d', '--build'], { cwd: root })
  }

  await waitHealthy()

  const apiKey = readApiKey()
  console.log(`API key: ${apiKey}`)

  let sessions = await api('/sessions')
  if (!Array.isArray(sessions)) sessions = []

  let session = sessions.find((s) => s.status === 'ready' || s.status === 'READY') ?? sessions[0]

  if (!session) {
    console.log('Creando sesión "superpelu"…')
    session = await api('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name: 'superpelu' }),
    })
    console.log('Iniciando sesión (generará QR)…')
    session = await api(`/sessions/${session.id}/start`, { method: 'POST' })
  } else if (session.status !== 'ready' && session.status !== 'READY') {
    console.log(`Sesión existente (${session.status}). Iniciando…`)
    try {
      session = await api(`/sessions/${session.id}/start`, { method: 'POST' })
    } catch (err) {
      console.warn(String(err))
    }
  }

  const qrWritten = await writeQrHtml(session.id)

  console.log('')
  console.log('── OpenWA local ──────────────────────────────────────')
  if (qrWritten) {
    console.log(`QR (abrir en el navegador):  file://${qrHtmlPath}`)
  } else {
    console.log(`QR vía API:  GET /sessions/${session.id}/qr (Swagger abajo)`)
  }
  console.log(`API / Swagger:   http://localhost:2785/api/docs`)
  console.log(`Session ID:      ${session.id}`)
  console.log(`Estado sesión:   ${session.status}`)
  console.log('')

  if (session.status !== 'ready' && session.status !== 'READY') {
    console.log('Escanea el QR con el WhatsApp del salón (archivo qr.html o Swagger).')
    console.log('Cuando el estado sea "ready", reinicia Superpelu (npm run dev).')
  } else {
    console.log('Sesión lista. Reinicia Superpelu si ya estaba en marcha.')
  }

  if (!skipEnv) {
    patchEnv({
      OPENWA_ENABLED: 'true',
      OPENWA_API_URL: apiBase,
      OPENWA_API_KEY: apiKey,
      OPENWA_SESSION_ID: session.id,
      OPENWA_NOTIFY_PUBLIC_ONLY: 'false',
    })
    console.log('\nActualizado .env (OPENWA_*).')
  }

  console.log('\nComprobar Superpelu:')
  console.log(
    `  curl -s -H "Authorization: Bearer $(grep '^ADMIN_SECRET=' .env | cut -d= -f2)" http://localhost:3001/api/admin/whatsapp`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
