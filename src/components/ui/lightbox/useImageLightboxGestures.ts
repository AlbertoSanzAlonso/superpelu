import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from 'react'
import {
  MOBILE_LIGHTBOX_QUERY,
  SWIPE_THRESHOLD,
  TAP_MOVE_THRESHOLD,
} from '@/components/ui/lightbox/constants'

type UseImageLightboxGesturesOptions = {
  zoomed: boolean
  hasNav: boolean
  onPrev?: () => void
  onNext?: () => void
  onTap: () => void
}

export function useImageLightboxGestures({
  zoomed,
  hasNav,
  onPrev,
  onNext,
  onTap,
}: UseImageLightboxGesturesOptions) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const pointerDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const swipeHandledRef = useRef(false)
  const pointerMovedRef = useRef(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(MOBILE_LIGHTBOX_QUERY)
    const sync = () => setIsMobileViewport(media.matches)
    sync()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }

    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  function startGesture(x: number, y: number) {
    pointerStartRef.current = { x, y }
    pointerDeltaRef.current = { x: 0, y: 0 }
    swipeHandledRef.current = false
    pointerMovedRef.current = false
  }

  function updateGesture(x: number, y: number) {
    const start = pointerStartRef.current
    if (!start) return

    const dx = x - start.x
    const dy = y - start.y
    pointerDeltaRef.current = { x: dx, y: dy }
    if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) {
      pointerMovedRef.current = true
    }
  }

  function finishGesture() {
    if (swipeHandledRef.current) {
      pointerStartRef.current = null
      pointerDeltaRef.current = { x: 0, y: 0 }
      return
    }

    const { x, y } = pointerDeltaRef.current
    const isHorizontalSwipe =
      Math.abs(x) >= SWIPE_THRESHOLD && Math.abs(x) > Math.abs(y) * 1.2

    if (!zoomed && isMobileViewport && hasNav && isHorizontalSwipe) {
      if (x < 0) onNext?.()
      else onPrev?.()
      swipeHandledRef.current = true
    }

    pointerStartRef.current = null
    pointerDeltaRef.current = { x: 0, y: 0 }
  }

  function handlePointerDown(e: PointerEvent) {
    if (isMobileViewport) return
    startGesture(e.clientX, e.clientY)
  }

  function handlePointerMove(e: PointerEvent) {
    if (isMobileViewport) return
    updateGesture(e.clientX, e.clientY)
  }

  function handlePointerUp() {
    if (isMobileViewport) return
    finishGesture()
  }

  function handlePointerCancel() {
    pointerStartRef.current = null
    pointerDeltaRef.current = { x: 0, y: 0 }
    swipeHandledRef.current = false
  }

  function handleTouchStart(e: TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    startGesture(t.clientX, t.clientY)
  }

  function handleTouchMove(e: TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    updateGesture(t.clientX, t.clientY)

    if (!zoomed && isMobileViewport) {
      // En modo detalle sin zoom, el swipe debe navegar fotos,
      // no desplazar horizontalmente el contenedor/viewport.
      e.preventDefault()
    }

    const { x, y } = pointerDeltaRef.current
    const isHorizontalSwipe =
      Math.abs(x) >= SWIPE_THRESHOLD && Math.abs(x) > Math.abs(y) * 1.2

    if (!zoomed && isMobileViewport && hasNav && isHorizontalSwipe && !swipeHandledRef.current) {
      e.preventDefault()
      if (x < 0) onNext?.()
      else onPrev?.()
      swipeHandledRef.current = true
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    const t = e.changedTouches[0]
    if (t) updateGesture(t.clientX, t.clientY)
    finishGesture()
  }

  function handleTouchCancel() {
    handlePointerCancel()
  }

  function handleTapActivate() {
    if (pointerMovedRef.current) return
    onTap()
  }

  return {
    isMobileViewport,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleTapActivate,
  }
}
