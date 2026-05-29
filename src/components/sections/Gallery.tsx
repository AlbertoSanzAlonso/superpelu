import { gallerySection } from '@/data/content'
import { galleryImages, type GalleryImage } from '@/data/galleryImages'
import { Section } from '@/components/ui/Section'
import { ImageLightbox } from '@/components/ui/lightbox'
import { useCallback, useMemo, useState } from 'react'

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

export function Gallery() {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const images = useMemo(
    () => galleryImages.map((img) => ({ src: img.src, alt: img.alt })),
    [],
  )

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

      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(200px,1fr)]">
        {galleryImages.map((image, index) => (
          <GalleryFigure
            key={image.src}
            image={image}
            index={index}
            onOpen={openAt}
            className={image.span ?? ''}
            imageClassName="min-h-[240px] lg:min-h-[200px]"
          />
        ))}
      </div>

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
