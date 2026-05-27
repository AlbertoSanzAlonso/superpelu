import type { Size } from '@/components/ui/lightbox/types'

export function computeCoverZoomSize(
  displayWidth: number,
  displayHeight: number,
  containerWidth: number,
  containerHeight: number,
): Size {
  const scale = Math.max(
    containerWidth / displayWidth,
    containerHeight / displayHeight,
  )

  return {
    width: displayWidth * scale,
    height: displayHeight * scale,
  }
}

export function measureScrollArea(el: HTMLElement): Size {
  const rect = el.getBoundingClientRect()
  const viewport = window.visualViewport

  return {
    width: rect.width || viewport?.width || window.innerWidth,
    height: rect.height || viewport?.height || window.innerHeight * 0.8,
  }
}
