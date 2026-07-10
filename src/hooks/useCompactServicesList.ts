import { useEffect, useState } from 'react'

const COMPACT_MEDIA_QUERY = '(max-width: 1023px)'

/** Vista compacta del listado /servicios (móvil y tablet). */
export function useCompactServicesList(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_MEDIA_QUERY).matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MEDIA_QUERY)
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return compact
}
