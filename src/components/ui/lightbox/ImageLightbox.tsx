import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/ScrollArea'
import type { ImageLightboxProps, Size } from '@/components/ui/lightbox/types'
import { computeCoverZoomSize, measureScrollArea } from '@/components/ui/lightbox/utils'
import { useImageLightboxGestures } from '@/components/ui/lightbox/useImageLightboxGestures'

export function ImageLightbox({
  open,
  images,
  activeIndex,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxProps) {
  const dialogId = useId()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const baseImageSizeRef = useRef<Size | null>(null)
  const previousIndexRef = useRef(activeIndex)
  const slideTimeoutRef = useRef<number | null>(null)

  const [zoomed, setZoomed] = useState(false)
  const [zoomSize, setZoomSize] = useState<Size | null>(null)
  const [slideClass, setSlideClass] = useState('')

  const activeImage = useMemo(
    () => images[activeIndex],
    [activeIndex, images],
  )
  const hasNav = images.length > 1 && !!onPrev && !!onNext

  const centerZoomScroll = useCallback((size: Size) => {
    const el = scrollAreaRef.current
    if (!el) return

    el.scrollLeft = Math.max(0, (size.width - el.clientWidth) / 2)
    el.scrollTop = Math.max(0, (size.height - el.clientHeight) / 2)
  }, [])

  const resetScrollArea = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return

    el.scrollLeft = 0
    el.scrollTop = 0
  }, [])

  const applyZoomSize = useCallback(() => {
    const scrollEl = scrollAreaRef.current
    const base = baseImageSizeRef.current
    if (!scrollEl || !base) return

    const container = measureScrollArea(scrollEl)
    const size = computeCoverZoomSize(
      base.width,
      base.height,
      container.width,
      container.height,
    )

    setZoomSize(size)

    window.requestAnimationFrame(() => {
      centerZoomScroll(size)
    })
  }, [centerZoomScroll])

  useEffect(() => {
    if (!open) return
    setZoomed(false)
    setZoomSize(null)
    baseImageSizeRef.current = null
    resetScrollArea()
  }, [activeIndex, open, resetScrollArea])

  useEffect(() => {
    if (!open || zoomed || images.length <= 1) {
      previousIndexRef.current = activeIndex
      return
    }

    const previous = previousIndexRef.current
    if (previous === activeIndex) return

    const movedLeft = activeIndex === previous + 1 || (previous === images.length - 1 && activeIndex === 0)
    setSlideClass(movedLeft ? 'lightbox-slide-left' : 'lightbox-slide-right')
    previousIndexRef.current = activeIndex

    if (slideTimeoutRef.current) {
      window.clearTimeout(slideTimeoutRef.current)
    }
    slideTimeoutRef.current = window.setTimeout(() => {
      setSlideClass('')
      slideTimeoutRef.current = null
    }, 240)

    return () => {
      if (slideTimeoutRef.current) {
        window.clearTimeout(slideTimeoutRef.current)
        slideTimeoutRef.current = null
      }
    }
  }, [activeIndex, images.length, open, zoomed])

  const toggleZoom = useCallback(() => {
    if (zoomed) {
      setZoomed(false)
      setZoomSize(null)
      baseImageSizeRef.current = null
      resetScrollArea()
      window.requestAnimationFrame(resetScrollArea)
      return
    }

    const img = imageRef.current
    if (!img || img.offsetWidth === 0 || img.offsetHeight === 0) return

    baseImageSizeRef.current = {
      width: img.offsetWidth,
      height: img.offsetHeight,
    }
    setZoomed(true)
  }, [zoomed, resetScrollArea])
  const {
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
  } = useImageLightboxGestures({
    zoomed,
    hasNav,
    onPrev,
    onNext,
    onTap: toggleZoom,
  })

  useEffect(() => {
    if (zoomed) return

    const raf = window.requestAnimationFrame(() => {
      resetScrollArea()
      window.requestAnimationFrame(resetScrollArea)
    })

    return () => window.cancelAnimationFrame(raf)
  }, [zoomed, resetScrollArea])

  useEffect(() => {
    if (!open || !zoomed || !baseImageSizeRef.current) return

    let cancelled = false

    const run = () => {
      if (cancelled) return
      applyZoomSize()
    }

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
    }
  }, [open, zoomed, applyZoomSize])

  useEffect(() => {
    if (!zoomed || !zoomSize) return

    const raf = window.requestAnimationFrame(() => {
      centerZoomScroll(zoomSize)
    })

    return () => window.cancelAnimationFrame(raf)
  }, [zoomed, zoomSize, centerZoomScroll])

  useEffect(() => {
    if (!open || !zoomed) return

    const onViewportChange = () => {
      if (!baseImageSizeRef.current) return
      applyZoomSize()
    }

    window.visualViewport?.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('scroll', onViewportChange)
    window.addEventListener('orientationchange', onViewportChange)

    return () => {
      window.visualViewport?.removeEventListener('resize', onViewportChange)
      window.visualViewport?.removeEventListener('scroll', onViewportChange)
      window.removeEventListener('orientationchange', onViewportChange)
    }
  }, [open, zoomed, applyZoomSize])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const t = window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault()
        onPrev()
        return
      }

      if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, onNext, onPrev])

  if (!open || !activeImage) return null

  const label = activeImage.alt || 'Imagen ampliada'

  const imageClassName =
    'ui-rounded block h-auto w-auto max-w-[calc(100vw-1rem)] select-none object-contain shadow-2xl transition-[width,height] duration-200 max-h-[85dvh] sm:max-w-full sm:max-h-[80dvh]'

  const imageStyle =
    zoomed && zoomSize
      ? {
          width: zoomSize.width,
          height: zoomSize.height,
          maxWidth: 'none',
          maxHeight: 'none',
        }
      : undefined

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-charcoal/80 backdrop-blur-sm ${
        zoomed
          ? 'items-stretch justify-stretch p-0'
          : 'items-center justify-center px-2 py-0 sm:p-4'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogId}
      onMouseDown={(e) => {
        if (!zoomed && e.target === e.currentTarget) onClose()
      }}
    >
      <h2 id={dialogId} className="sr-only">
        {label}
      </h2>

      <div
        className={`relative ${
          zoomed ? 'flex h-full min-h-0 w-full max-w-none flex-col' : 'w-full max-w-none sm:max-w-5xl'
        }`}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className={`ui-rounded absolute z-10 cursor-pointer bg-cream/10 px-3 py-2 text-sm text-cream backdrop-blur hover:bg-cream/15 focus:outline-none focus:ring-2 focus:ring-gold/70 ${
            zoomed
              ? 'right-3 top-3 sm:right-4 sm:top-4'
              : 'right-0 top-0 -translate-y-12 sm:-translate-y-12'
          }`}
          aria-label="Cerrar imagen ampliada"
        >
          Cerrar
        </button>

        {hasNav && !zoomed && !isMobileViewport && (
          <>
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-0 top-1/2 z-10 -translate-x-3 -translate-y-1/2 cursor-pointer rounded-full bg-cream/10 p-3 text-cream backdrop-blur hover:bg-cream/15 focus:outline-none focus:ring-2 focus:ring-gold/70"
              aria-label="Imagen anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNext}
              className="absolute right-0 top-1/2 z-10 translate-x-3 -translate-y-1/2 cursor-pointer rounded-full bg-cream/10 p-3 text-cream backdrop-blur hover:bg-cream/15 focus:outline-none focus:ring-2 focus:ring-gold/70"
              aria-label="Imagen siguiente"
            >
              ›
            </button>
          </>
        )}

        <ScrollArea
          ref={scrollAreaRef}
          className={`ui-rounded mx-auto w-full min-h-0 ${
            zoomed
              ? 'h-full flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]'
              : 'flex max-h-[75dvh] items-center justify-center overflow-x-hidden overflow-y-hidden overscroll-x-none sm:max-h-[80dvh]'
          }`}
        >
          {zoomed ? (
            <img
              ref={imageRef}
              src={activeImage.src}
              alt={activeImage.alt}
              className={`${imageClassName} ${slideClass} cursor-zoom-out touch-pan-x touch-pan-y`}
              style={imageStyle}
              draggable={false}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              onClick={handleTapActivate}
            />
          ) : (
            <button
              type="button"
              onClick={handleTapActivate}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              className="mx-auto inline-flex shrink-0 cursor-zoom-in touch-none justify-center focus:outline-none focus:ring-2 focus:ring-gold/70"
              aria-label="Ampliar imagen"
            >
              <img
                ref={imageRef}
                src={activeImage.src}
                alt={activeImage.alt}
                className={`${imageClassName} ${slideClass}`}
                draggable={false}
              />
            </button>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
