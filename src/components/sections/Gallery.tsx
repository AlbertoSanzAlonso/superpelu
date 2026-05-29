import { gallerySection } from '@/data/content'
import { galleryImages, type GalleryImage } from '@/data/galleryImages'
import { Section } from '@/components/ui/Section'
import { ImageLightbox } from '@/components/ui/lightbox'
import { useCallback, useEffect, useMemo, useState } from 'react'

const SLIDE_SIZE = 5
const AUTOPLAY_MS = 6000

type GallerySlideItem = {
  image: GalleryImage
  globalIndex: number
}

type GalleryFigureProps = {
  image: GalleryImage
  index: number
  onOpen: (index: number) => void
  className?: string
  imageClassName?: string
}

function GalleryFigure({ image, index, onOpen, className = '', imageClassName = '' }: GalleryFigureProps) {
  return (
    <figure
      className={`group ui-rounded relative cursor-pointer overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpen(index)}
        className="block h-full w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold/70"
        aria-label={`Ampliar imagen: ${image.alt}`}
      >
        <img
          src={image.src}
          alt={image.alt}
          width={800}
          height={1000}
          className={`h-full w-full cursor-pointer object-cover transition-transform duration-700 group-hover:scale-105 ${imageClassName}`}
          loading="lazy"
          decoding="async"
        />
      </button>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
    </figure>
  )
}

function buildSlides(images: GalleryImage[]): GallerySlideItem[][] {
  if (images.length === 0) return []

  const slideCount = Math.ceil(images.length / SLIDE_SIZE)
  return Array.from({ length: slideCount }, (_, slideIndex) =>
    Array.from({ length: SLIDE_SIZE }, (_, itemIndex) => {
      const globalIndex = (slideIndex * SLIDE_SIZE + itemIndex) % images.length
      return { image: images[globalIndex], globalIndex }
    }),
  )
}

type GalleryDesktopCarouselProps = {
  slides: GallerySlideItem[][]
  onOpen: (index: number) => void
  paused: boolean
}

function GalleryDesktopCarousel({ slides, onOpen, paused }: GalleryDesktopCarouselProps) {
  const [slideIndex, setSlideIndex] = useState(0)
  const [hovering, setHovering] = useState(false)

  const goTo = useCallback(
    (index: number) => {
      setSlideIndex((index + slides.length) % slides.length)
    },
    [slides.length],
  )

  const goPrev = useCallback(() => goTo(slideIndex - 1), [goTo, slideIndex])
  const goNext = useCallback(() => goTo(slideIndex + 1), [goTo, slideIndex])

  useEffect(() => {
    if (slides.length <= 1 || paused || hovering) return

    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length)
    }, AUTOPLAY_MS)

    return () => window.clearInterval(timer)
  }, [hovering, paused, slides.length, slideIndex])

  if (slides.length === 0) return null

  return (
    <div
      className="relative hidden sm:block"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHovering(false)
        }
      }}
    >
      <div
        className="relative min-h-[min(52vw,520px)] lg:min-h-[480px]"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Galería, grupo ${slideIndex + 1} de ${slides.length}`}
      >
        {slides.map((slide, index) => {
          const [featured, ...rest] = slide
          const isActive = index === slideIndex

          return (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
              }`}
              aria-hidden={!isActive}
            >
              <div className="grid h-full grid-cols-4 grid-rows-2 gap-4">
                <GalleryFigure
                  image={featured.image}
                  index={featured.globalIndex}
                  onOpen={onOpen}
                  className="col-span-2 row-span-2"
                  imageClassName="min-h-[240px]"
                />
                {rest.map((item) => (
                  <GalleryFigure
                    key={`${index}-${item.globalIndex}`}
                    image={item.image}
                    index={item.globalIndex}
                    onOpen={onOpen}
                    imageClassName="min-h-[200px]"
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gold/40 bg-cream/95 text-2xl leading-none text-gold shadow-md backdrop-blur-sm transition-colors hover:border-gold/70 hover:bg-cream focus:outline-none focus:ring-2 focus:ring-gold/70"
            aria-label="Grupo anterior de la galería"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gold/40 bg-cream/95 text-2xl leading-none text-gold shadow-md backdrop-blur-sm transition-colors hover:border-gold/70 hover:bg-cream focus:outline-none focus:ring-2 focus:ring-gold/70"
            aria-label="Grupo siguiente de la galería"
          >
            ›
          </button>

          <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label="Grupos de la galería">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === slideIndex}
                aria-label={`Grupo ${index + 1}`}
                onClick={() => goTo(index)}
                className={`h-2.5 cursor-pointer rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gold/70 ${
                  index === slideIndex ? 'w-7 bg-gold' : 'w-2.5 bg-gold/30 hover:bg-gold/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Gallery() {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  const slides = useMemo(() => buildSlides(galleryImages), [])

  const images = useMemo(
    () => galleryImages.map((img) => ({ src: img.src, alt: img.alt })),
    [],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduceMotion(media.matches)
    sync()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }

    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  const openAt = useCallback((index: number) => {
    setActiveIndex(index)
    setLightboxOpen(true)
  }, [])

  const close = useCallback(() => setLightboxOpen(false), [])
  const prev = useCallback(
    () => setActiveIndex((i) => (i - 1 + images.length) % images.length),
    [images.length],
  )
  const next = useCallback(
    () => setActiveIndex((i) => (i + 1) % images.length),
    [images.length],
  )

  return (
    <Section
      id="galeria"
      eyebrow={gallerySection.eyebrow}
      scriptAccent={gallerySection.scriptAccent}
      title={gallerySection.title}
      subtitle={gallerySection.subtitle}
    >
      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 sm:hidden">
        <div
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[7.5vw] pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Galería de imágenes"
        >
          {galleryImages.map((image, index) => (
            <GalleryFigure
              key={image.src}
              image={image}
              index={index}
              onOpen={openAt}
              className="w-[85vw] shrink-0 snap-center shadow-lg shadow-charcoal/10"
              imageClassName="aspect-[4/5]"
            />
          ))}
        </div>
      </div>

      <GalleryDesktopCarousel
        slides={slides}
        onOpen={openAt}
        paused={lightboxOpen || reduceMotion}
      />

      <ImageLightbox
        open={lightboxOpen}
        images={images}
        activeIndex={activeIndex}
        onClose={close}
        onPrev={prev}
        onNext={next}
      />
    </Section>
  )
}
