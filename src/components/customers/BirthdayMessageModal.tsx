import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import {
  ApiError,
  fetchBirthdayMessageTemplates,
  updateBirthdayMessageTemplates,
} from '@/lib/api'
import { capitalizePersonName } from '@/lib/customer/name'
import { typography } from '@/styles/typography'

type Props = {
  open: boolean
  adminToken: string
  onClose: () => void
}

function previewTemplate(template: string, sampleName = 'María'): string {
  return template.replaceAll('{nombre}', capitalizePersonName(sampleName))
}

export function BirthdayMessageModal({ open, adminToken, onClose }: Props) {
  const [es, setEs] = useState('')
  const [en, setEn] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setLoading(true)
    void fetchBirthdayMessageTemplates(adminToken)
      .then(({ templates }) => {
        setEs(templates.es)
        setEn(templates.en)
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la plantilla')
      })
      .finally(() => setLoading(false))
  }, [open, adminToken])

  const previewEs = useMemo(() => previewTemplate(es), [es])
  const previewEn = useMemo(() => previewTemplate(en), [en])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!es.includes('{nombre}') || !en.includes('{nombre}')) {
      setError('Cada plantilla debe incluir el marcador {nombre}')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { templates } = await updateBirthdayMessageTemplates(adminToken, { es, en })
      setEs(templates.es)
      setEn(templates.en)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex bg-charcoal/50 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthday-message-title"
      onClick={saving ? undefined : onClose}
    >
      <form
        className="flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-cream shadow-2xl sm:h-auto sm:max-h-[min(90vh,42rem)] sm:border sm:border-gold/35"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => void handleSubmit(e)}
      >
        <header className="relative shrink-0 border-b border-gold/20 px-5 py-4">
          <div className="pr-10">
            <p className={`${typography.caption} text-gold`}>WhatsApp automático</p>
            <h2 id="birthday-message-title" className={`${typography.h3} mt-0.5 text-charcoal`}>
              Felicitación de cumpleaños
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gold/30 text-charcoal-muted transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <p className={`${typography.caption}`}>
            Se envía a las 10:00 (Europe/Madrid). Cada cliente recibe la plantilla de su idioma
            (Español / English en la ficha). Usa {'{nombre}'} — se sustituye por el nombre en
            mayúsculas iniciales.
          </p>

          {loading ? (
            <p className={`${typography.caption} text-center`}>Cargando…</p>
          ) : (
            <>
              <Textarea
                label="Plantilla (español)"
                value={es}
                onChange={(e) => setEs(e.target.value)}
                disabled={saving}
                rows={4}
              />
              <p className={`${typography.caption} rounded border border-gold/20 bg-cream/60 px-3 py-2`}>
                Vista previa: {previewEs}
              </p>

              <Textarea
                label="Plantilla (English)"
                value={en}
                onChange={(e) => setEn(e.target.value)}
                disabled={saving}
                rows={4}
              />
              <p className={`${typography.caption} rounded border border-gold/20 bg-cream/60 px-3 py-2`}>
                Preview: {previewEn}
              </p>
            </>
          )}

          {error && (
            <p
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-gold/15 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="solid" size="sm" disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar plantilla'}
          </Button>
        </footer>
      </form>
    </div>
  )
}
