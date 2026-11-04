// Converte vídeos de pratos para o formato do story (vertical 720x1280, H.264, curto e leve)
// e gera o poster de cada um.
//
//   node scripts/preparar-videos.mjs                -> converte videos-brutos/<slug>.mp4
//   node scripts/preparar-videos.mjs --placeholder  -> gera vídeos de gradiente para a demo
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const pastaBrutos = join(raiz, 'videos-brutos')
const pastaSaida = join(raiz, 'public', 'demo', 'videos')

const SLUGS_DEMO = [
  'mix-da-casa',
  'pizza-margherita',
  'parmegiana-da-casa',
  'picanha-na-chapa',
  'chopp-500ml',
  'petit-gateau',
]
const DURACAO_MAXIMA_S = '12'
const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024

const VIDEO_STORY = [
  '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
  '-c:v', 'libx264', '-profile:v', 'main', '-crf', '28', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
]

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
}

function gerarPoster(video, slug) {
  ffmpeg(['-ss', '1', '-i', video, '-frames:v', '1', '-q:v', '4', join(pastaSaida, `${slug}.jpg`)])
}

function converter(entrada, slug) {
  const saida = join(pastaSaida, `${slug}.mp4`)
  ffmpeg(['-i', entrada, '-t', DURACAO_MAXIMA_S, ...VIDEO_STORY, '-c:a', 'aac', '-b:a', '96k', saida])
  gerarPoster(saida, slug)
  return saida
}

function gerarPlaceholder(slug, indice) {
  const saida = join(pastaSaida, `${slug}.mp4`)
  // Cada slug ganha uma semente diferente para os gradientes não ficarem iguais.
  ffmpeg([
    '-f', 'lavfi', '-i', `gradients=s=720x1280:d=8:speed=0.02:seed=${indice + 1}`,
    ...VIDEO_STORY, '-an', saida,
  ])
  gerarPoster(saida, slug)
  return saida
}

function conferirTamanho(arquivo) {
  const bytes = statSync(arquivo).size
  const mb = (bytes / 1024 / 1024).toFixed(2)
  if (bytes > TAMANHO_MAXIMO_BYTES) {
    console.warn(`AVISO ${basename(arquivo)}: ${mb} MB (acima de 3 MB, considere encurtar o vídeo)`)
  } else {
    console.log(`ok ${basename(arquivo)}: ${mb} MB`)
  }
}

mkdirSync(pastaSaida, { recursive: true })

if (process.argv.includes('--placeholder')) {
  SLUGS_DEMO.forEach((slug, i) => conferirTamanho(gerarPlaceholder(slug, i)))
} else {
  const brutos = existsSync(pastaBrutos) ? readdirSync(pastaBrutos).filter((f) => f.endsWith('.mp4')) : []
  if (brutos.length === 0) {
    console.error(`Nenhum .mp4 em ${pastaBrutos}. Use os slugs: ${SLUGS_DEMO.join(', ')}`)
    process.exit(1)
  }
  for (const arquivo of brutos) {
    conferirTamanho(converter(join(pastaBrutos, arquivo), basename(arquivo, '.mp4')))
  }
}
