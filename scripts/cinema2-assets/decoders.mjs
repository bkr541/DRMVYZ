// `npm run cinema2:decoders:sync`   copy the Draco and Basis (KTX2) decoders that match the installed Three.js into public/cinema2/decoders/
// `npm run cinema2:decoders:check`  fail when the shipped copies differ from the installed Three.js (run after a Three upgrade)
//
// The decoders ship with the app instead of loading from a CDN, so they work offline, in Vercel production builds and in the Electron app.
// They are only fetched when a model actually uses KHR_draco_mesh_compression or KHR_texture_basisu; they are not part of the asset budget.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const libs = join(root, 'node_modules/three/examples/jsm/libs')
const target = join(root, 'public/cinema2/decoders')

/** [source relative to three/examples/jsm/libs, destination relative to public/cinema2/decoders] */
export const DECODER_FILES = Object.freeze([
  ['draco/gltf/draco_decoder.js', 'draco/draco_decoder.js'],
  ['draco/gltf/draco_decoder.wasm', 'draco/draco_decoder.wasm'],
  ['draco/gltf/draco_wasm_wrapper.js', 'draco/draco_wasm_wrapper.js'],
  ['basis/basis_transcoder.js', 'basis/basis_transcoder.js'],
  ['basis/basis_transcoder.wasm', 'basis/basis_transcoder.wasm'],
])

const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')

export function checkDecoders() {
  const problems = []
  for (const [from, to] of DECODER_FILES) {
    const source = join(libs, from)
    const shipped = join(target, to)
    if (!existsSync(source)) problems.push(`installed Three.js has no ${from}`)
    else if (!existsSync(shipped)) problems.push(`public/cinema2/decoders/${to} is missing`)
    else if (hash(source) !== hash(shipped)) problems.push(`public/cinema2/decoders/${to} differs from the installed Three.js ${from}`)
  }
  return problems
}

export function syncDecoders() {
  for (const [from, to] of DECODER_FILES) {
    mkdirSync(dirname(join(target, to)), { recursive: true })
    copyFileSync(join(libs, from), join(target, to))
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]
  if (mode === 'sync') {
    syncDecoders()
    console.log(`decoders: copied ${DECODER_FILES.length} files to public/cinema2/decoders/.`)
  } else if (mode === 'check') {
    const problems = checkDecoders()
    for (const problem of problems) console.error(`decoders: ${problem}; run \`npm run cinema2:decoders:sync\`.`)
    if (problems.length > 0) process.exit(1)
    console.log(`decoders: ${DECODER_FILES.length} files match the installed Three.js.`)
  } else {
    console.error('usage: decoders.mjs sync|check')
    process.exit(2)
  }
}
