import sharp from 'sharp'

const [, , inputPath, outputPath = 'resultado.webp', qualityArg = '80'] = process.argv
const quality = Number(qualityArg)

if (!inputPath) {
  console.error('Uso: node src/utils/image-converter.js <input> [output.webp] [quality]')
  process.exit(1)
}

if (Number.isNaN(quality) || quality < 1 || quality > 100) {
  console.error('La calidad debe ser un numero entre 1 y 100.')
  process.exit(1)
}

sharp(inputPath)
  .webp({ quality }) // Convierte a WebP y define la calidad
  .toFile(outputPath)
  .then((info) => {
    console.log(`Imagen convertida con exito: ${inputPath} -> ${outputPath}`, info)
  })
  .catch((err) => {
    console.error('Hubo un error:', err)
  })