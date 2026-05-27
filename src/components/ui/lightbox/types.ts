export type ImageLightboxImage = {
  src: string
  alt: string
}

export type ImageLightboxProps = {
  open: boolean
  images: ImageLightboxImage[]
  activeIndex: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

export type Size = { width: number; height: number }
