import { gallerySection } from '@/data/content'
import { galleryImages } from '@/data/galleryImages'
import { Section } from '@/components/ui/Section'
import { ImageLightbox } from '@/components/ui/lightbox'
import { useCallback, useMemo, useState } from 'react'

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(200px,1fr)]">
        {galleryImages.map((image, index) => (
          <figure
            key={image.src}
            className={`group ui-rounded relative cursor-pointer overflow-hidden ${image.span ?? ''}`}
          >
            <button
              type="button"
              onClick={() => openAt(index)}
              className="block h-full w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-gold/70"
              aria-label={`Ampliar imagen: ${image.alt}`}
            >
              <img
                src={image.src}
                alt={image.alt}
                width={800}
                height={1000}
                className="h-full min-h-[240px] w-full cursor-pointer object-cover transition-transform duration-700 group-hover:scale-105 lg:min-h-[200px]"
                loading="lazy"
                decoding="async"
              />
            </button>
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
          </figure>
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
