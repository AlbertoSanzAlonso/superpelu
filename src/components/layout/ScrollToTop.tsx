import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Al cambiar de página, vuelve al inicio del viewport (p. ej. política de cookies desde el footer). */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
