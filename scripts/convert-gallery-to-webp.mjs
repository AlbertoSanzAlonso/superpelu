/**
 * Convierte JPEG/JPG de src/assets/gallery/ a WebP con nombres SEO.
 * Uso: node scripts/convert-gallery-to-webp.mjs
 */
import { readdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const GALLERY_DIR = path.resolve('src/assets/gallery')

/** @type {Record<string, { out: string; alt: string }>} */
const FILES = {
  '2-AGBbBn4NbQi0ODeD.jpg': {
    out: 'balayage-rubio-bob-liso-benalmadena.webp',
    alt: 'Balayage rubio en bob liso — Superpelu Benalmádena',
  },
  '3-A3Q7Qwlpz4il6EQG.jpg': {
    out: 'peinado-boda-orquideas-madre-hijas-benalmadena.webp',
    alt: 'Peinados de boda con orquídeas para madre e hijas — Superpelu Benalmádena',
  },
  '4-YKblb68PraI6MpbP.jpg': {
    out: 'balayage-rubio-melena-ondas-benalmadena.webp',
    alt: 'Balayage rubio en melena con ondas — Superpelu Benalmádena',
  },
  '7-YKblbErl2wfeGDoL.jpg': {
    out: 'balayage-rubio-ondas-salon-benalmadena.webp',
    alt: 'Balayage rubio con ondas en el salón — Superpelu Benalmádena',
  },
  '10-AQEZEDpa3KI2QkZ7.jpg': {
    out: 'rubio-platino-ondas-raiz-difuminada-benalmadena.webp',
    alt: 'Rubio platino con ondas y raíz difuminada — Superpelu Benalmádena',
  },
  '12-2-YBgbgepWgMcg63Og.jpeg': {
    out: 'balayage-rubio-ceniza-ondas-benalmadena.webp',
    alt: 'Balayage de rubio ceniza a dorado con ondas — Superpelu Benalmádena',
  },
  '21-1-Yg2y2qlR5WSKXaXN.jpeg': {
    out: 'mechas-balayage-rubio-ondas-benalmadena.webp',
    alt: 'Mechas balayage rubio con ondas suaves — Superpelu Benalmádena',
  },
  '23-2-AQEZEDJDnkCjgQPE.jpeg': {
    out: 'balayage-rubio-medio-ondas-benalmadena.webp',
    alt: 'Balayage rubio en pelo medio con ondas — Superpelu Benalmádena',
  },
  '26-2-m2WEWa4zbQTWrNvj.jpeg': {
    out: 'balayage-rubio-miel-melena-larga-benalmadena.webp',
    alt: 'Balayage rubio miel en melena larga — Superpelu Benalmádena',
  },
  '27-2-YD0w0pQpr4clxO1w.jpeg': {
    out: 'balayage-rubio-miel-ondas-playa-benalmadena.webp',
    alt: 'Balayage rubio miel con ondas playeras — Superpelu Benalmádena',
  },
  '29-1-YKblbJGJvQczBzwR.jpeg': {
    out: 'balayage-caramelo-ondas-benalmadena.webp',
    alt: 'Balayage caramelo con ondas voluminosas — Superpelu Benalmádena',
  },
  '30-1-YKblbJD45JiB15LB.jpeg': {
    out: 'balayage-rubio-dorado-melena-ondas-benalmadena.webp',
    alt: 'Balayage rubio dorado en melena con ondas — Superpelu Benalmádena',
  },
  '30-3-d9545pGL0wHw57xP.jpeg': {
    out: 'mechas-rubio-dorado-ondas-benalmadena.webp',
    alt: 'Mechas rubio dorado con ondas — Superpelu Benalmádena',
  },
  '33-1-AMq8qnZ00LCJ08J2.jpeg': {
    out: 'rubio-ceniza-liso-melena-benalmadena.webp',
    alt: 'Rubio ceniza liso en melena — Superpelu Benalmádena',
  },
  '34-1-Awv9vrwVRKFZ9qna.jpeg': {
    out: 'balayage-rubio-crema-ondas-benalmadena.webp',
    alt: 'Balayage rubio crema con ondas — Superpelu Benalmádena',
  },
  '35-1-mv0J0jwNgaT36w5K.jpeg': {
    out: 'balayage-rubio-rizos-melena-benalmadena.webp',
    alt: 'Balayage rubio con rizos en melena — Superpelu Benalmádena',
  },
  '36-1-YD0w0pGJ1Ds37OLq.jpeg': {
    out: 'coloracion-magenta-borgona-ondas-benalmadena.webp',
    alt: 'Coloración magenta borgoña con ondas — Superpelu Benalmádena',
  },
}

const QUALITY = 82
const MAX_WIDTH = 1600

for (const [inputName, { out, alt }] of Object.entries(FILES)) {
  const inputPath = path.join(GALLERY_DIR, inputName)
  const outputPath = path.join(GALLERY_DIR, out)

  await sharp(inputPath)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 4 })
    .toFile(outputPath)

  const inStat = await stat(inputPath)
  const outStat = await stat(outputPath)
  console.log(
    `${inputName} → ${out} (${Math.round(inStat.size / 1024)}KB → ${Math.round(outStat.size / 1024)}KB)`,
  )
  void alt
}

const onDisk = await readdir(GALLERY_DIR)
const toRemove = onDisk.filter(
  (f) => /\.(jpe?g|jpg)$/i.test(f) && Object.keys(FILES).includes(f),
)
for (const f of toRemove) {
  await unlink(path.join(GALLERY_DIR, f))
  console.log(`eliminado: ${f}`)
}

console.log(`\nListo: ${toRemove.length} WebP en src/assets/gallery/`)
