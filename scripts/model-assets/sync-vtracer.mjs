import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const version = '1.0.0-alpha.4'
const root = new URL('../../', import.meta.url)
const upstream = new URL('node_modules/@visioncortex/vtracer/', root)
const output = new URL('src/features/models/trace/vendor/', root)
const pkg = JSON.parse(await readFile(new URL('package.json', upstream), 'utf8'))
if (pkg.version !== version) throw new Error('Unexpected VTracer version; review the adapter before upgrading.')
let glue = await readFile(new URL('pkg/vtracer_wasm.js', upstream), 'utf8')
const marker = 'const wasmPath = `${__dirname}/vtracer_wasm_bg.wasm`;'
if (!glue.includes(marker) || (glue.match(/exports\.vectorize_/g) ?? []).length !== 2) throw new Error('Unexpected WASM glue layout.')
glue = glue.slice(0, glue.indexOf(marker)).replace('/* @ts-self-types="./vtracer_wasm.d.ts" */', '')
  .replace('exports.vectorize_bytes = vectorize_bytes;', '').replace('exports.vectorize_rgba = vectorize_rgba;', '')
glue = `// Generated from @visioncortex/vtracer ${version}; MIT OR Apache-2.0.\n// Run scripts/model-assets/sync-vtracer.mjs; see docs/model-generator-phase02.md.\n` + glue + `
let wasm;
export async function initialize(bytes) {
  if (wasm) return;
  const result = await WebAssembly.instantiate(bytes, __wbg_get_imports());
  wasm = result.instance.exports;
  wasm.__wbindgen_start();
}
export { vectorize_rgba };
`
if (/require\(|__dirname|exports\./.test(glue)) throw new Error('Node-only glue remains in browser adapter.')
const binary = await readFile(new URL('pkg/vtracer_wasm_bg.wasm', upstream))
const digest = createHash('sha256').update(binary).digest('hex')
if (digest !== '63716b70497b7468ef97545b50f5f34b8bbb7acde2d7b00deb4eb40781446d45') throw new Error('Unexpected VTracer binary digest; review before regenerating.')
await mkdir(output, { recursive: true })
await writeFile(new URL('vtracer.js', output), glue)
await writeFile(new URL('vtracer.wasm', output), binary)
const licenseDir = new URL('public/models/vtracer/', root)
await mkdir(licenseDir, { recursive: true })
await writeFile(new URL('LICENSE.txt', licenseDir), await readFile(new URL('LICENSE-VTracer', output)))
console.log(JSON.stringify({ version, wasmBytes: binary.length, glueBytes: Buffer.byteLength(glue), sha256: digest }))
