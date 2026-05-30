import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryImage } from '@/data/galleryImages'
import { getGalleryImages } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { Section } from '@/components/ui/Section'
import { ImageLightbox } from '@/components/ui/lightbox'
import { typography } from '@/styles/typography'

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
  const { t } = useTranslation()
  return (
    <figure
      className={`group ui-rounded relative cursor-pointer overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => onOpen(index)}
        className="block h-full w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold/70"
        aria-label={t.gallery.ariaExpand(image.alt)}
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
  const { t } = useTranslation()
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
        aria-label={t.gallery.ariaGroup(slideIndex + 1, slides.length)}
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
            aria-label={t.gallery.ariaPrevGroup}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-1/2 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-gold/40 bg-cream/95 text-2xl leading-none text-gold shadow-md backdrop-blur-sm transition-colors hover:border-gold/70 hover:bg-cream focus:outline-none focus:ring-2 focus:ring-gold/70"
            aria-label={t.gallery.ariaNextGroup}
          >
            ›
          </button>

          <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label={t.gallery.ariaGroupsTablist}>
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === slideIndex}
                aria-label={t.gallery.ariaGroupTab(index + 1)}
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

type GalleryMobileCarouselProps = {
  images: GalleryImage[]
  onOpen: (index: number) => void
  reduceMotion: boolean
}

function GalleryMobileCarousel({ images, onOpen, reduceMotion }: GalleryMobileCarouselProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el || el.children.length === 0) return

    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)

    const firstCard = el.children[0] as HTMLElement
    const cardStride = firstCard.offsetWidth + 12
    const index = Math.round(el.scrollLeft / cardStride)
    setActiveIndex(Math.min(Math.max(index, 0), images.length - 1))
  }, [images.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      el.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [updateScrollState])

  if (images.length === 0) return null

  return (
    <div className="sm:hidden">
      {images.length > 1 && (
        <p
          id="gallery-swipe-hint"
          className={`${typography.caption} mb-3 flex items-center justify-center gap-2 text-center normal-case tracking-normal`}
        >
          <span aria-hidden className={reduceMotion ? '' : 'motion-safe:animate-pulse'}>
            ←
          </span>
          {t.gallery.swipeHint}
          <span aria-hidden className={reduceMotion ? '' : 'motion-safe:animate-pulse'}>
            →
          </span>
        </p>
      )}

      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
        {canScrollLeft && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-cream via-cream/70 to-transparent"
            aria-hidden
          />
        )}
        {canScrollRight && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-cream via-cream/70 to-transparent"
            aria-hidden
          />
        )}

        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[7.5vw] pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label={t.gallery.ariaGallery}
          aria-describedby={images.length > 1 ? 'gallery-swipe-hint' : undefined}
        >
          {images.map((image, index) => (
            <GalleryFigure
              key={image.src}
              image={image}
              index={index}
              onOpen={onOpen}
              className="w-[85vw] shrink-0 snap-center shadow-lg shadow-charcoal/10"
              imageClassName="aspect-[4/5]"
            />
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <p className={`${typography.caption} mt-3 text-center normal-case tracking-normal`}>
          {t.gallery.counter(activeIndex + 1, images.length)}
        </p>
      )}
    </div>
  )
}

export function Gallery() {
  const { locale, t } = useTranslation()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false)

  const galleryImages = useMemo(() => getGalleryImages(locale), [locale])
  const slides = useMemo(() => buildSlides(galleryImages), [galleryImages])

  const images = useMemo(
    () => galleryImages.map((img) => ({ src: img.src, alt: img.alt })),
    [galleryImages],
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
      eyebrow={t.gallerySection.eyebrow}
      scriptAccent={t.gallerySection.scriptAccent}
      title={t.gallerySection.title}
      subtitle={t.gallerySection.subtitle}
    >
      <GalleryMobileCarousel images={galleryImages} onOpen={openAt} reduceMotion={reduceMotion} />

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
