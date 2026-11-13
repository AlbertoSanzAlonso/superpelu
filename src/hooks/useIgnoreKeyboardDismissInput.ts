import { useCallback, useEffect, useRef } from 'react'

/**
 * En móvil, al minimizar el teclado (visualViewport crece) Chrome/Android
 * a veces dispara un `input` fantasma con un carácter extra.
 * Ignora cambios de un solo carácter en esa ventana breve.
 */
export function useIgnoreKeyboardDismissInput() {
  const ignoreUntil = useRef(0)
  const lastValue = useRef('')

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let lastHeight = vv.height
    const onResize = () => {
      const next = vv.height
      // Teclado cerrándose: el viewport visible crece.
      if (next > lastHeight + 40) {
        ignoreUntil.current = performance.now() + 400
      }
      lastHeight = next
    }

    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  const onBlurCapture = useCallback((value: string) => {
    lastValue.current = value
    ignoreUntil.current = performance.now() + 400
  }, [])

  const shouldAcceptChange = useCallback((prev: string, next: string) => {
    if (performance.now() > ignoreUntil.current) {
      lastValue.current = next
      return true
    }
    // Solo bloqueamos la inserción típica: un carácter suelto al cerrar teclado.
    const grewByOne = next.length === prev.length + 1 || next.length === lastValue.current.length + 1
    if (grewByOne) return false
    lastValue.current = next
    return true
  }, [])

  return { onBlurCapture, shouldAcceptChange }
}
