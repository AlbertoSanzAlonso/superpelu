import { gallerySection } from '@/data/content'
import { galleryImages } from '@/data/galleryImages'
import { Section } from '@/components/ui/Section'

export function Gallery() {
  return (
    <Section
      id="galeria"
      eyebrow={gallerySection.eyebrow}
      scriptAccent={gallerySection.scriptAccent}
      title={gallerySection.title}
      subtitle={gallerySection.subtitle}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(200px,1fr)]">
        {galleryImages.map((image) => (
          <figure
            key={image.src}
            className={`group relative overflow-hidden rounded-sm ${image.span ?? ''}`}
          >
            <img
              src={image.src}
              alt={image.alt}
              width={800}
              height={1000}
              className="h-full min-h-[240px] w-full object-cover transition-transform duration-700 group-hover:scale-105 lg:min-h-[200px]"
              loading="lazy"
              decoding="async"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-charcoal/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
          </figure>
        ))}
      </div>
    </Section>
  )
}
