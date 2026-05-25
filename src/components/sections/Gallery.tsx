import { gallerySection } from '@/data/content'
import { Section } from '@/components/ui/Section'

const galleryImages = [
  {
    src: '/images/hero-salon.jpeg',
    alt: 'Coloración y mechas en Superpelu Benalmádena',
    span: 'lg:col-span-2 lg:row-span-2',
  },
  {
    src: '/images/brand-identity.jpeg',
    alt: 'Superpelu Hair Studio Benalmádena',
    span: '',
  },
  {
    src: '/images/hero-salon.jpeg',
    alt: 'Tratamiento capilar y cuidado del cabello',
    span: '',
  },
]

export function Gallery() {
  return (
    <Section
      id="galeria"
      eyebrow={gallerySection.eyebrow}
      scriptAccent={gallerySection.scriptAccent}
      title={gallerySection.title}
      subtitle={gallerySection.subtitle}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
        {galleryImages.map((image, index) => (
          <figure
            key={`${image.src}-${index}`}
            className={`group relative overflow-hidden ${image.span}`}
          >
            <img
              src={image.src}
              alt={image.alt}
              className="h-full min-h-[240px] w-full object-cover transition-transform duration-700 group-hover:scale-105 lg:min-h-0"
              loading="lazy"
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
