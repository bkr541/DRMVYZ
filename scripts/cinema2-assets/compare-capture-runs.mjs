#!/usr/bin/env node
// Compares two folders of deterministic captures (the PNGs written by the Cinema 2.0 acceptance scripts) pixel by pixel.
//   node scripts/cinema2-assets/compare-capture-runs.mjs <baselineFolder> <candidateFolder> [--tolerance 0] [--max-different-fraction 0]
// Used to prove an engine change left existing presets rendering identically: the same preset, quality, size and frame must give the same pixels.
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const [baselineArg, candidateArg, ...rest] = process.argv.slice(2)
if (!baselineArg || !candidateArg) { console.error('usage: compare-capture-runs.mjs <baselineFolder> <candidateFolder> [--tolerance n] [--max-different-fraction f]'); process.exit(2) }
const option = (name, fallback) => { const index = rest.indexOf(`--${name}`); return index >= 0 ? Number(rest[index + 1]) : fallback }
const tolerance = option('tolerance', 0)
const allowedFraction = option('max-different-fraction', 0)

async function raw(path) {
  const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

const baseline = resolve(baselineArg)
const candidate = resolve(candidateArg)
const names = (await readdir(baseline)).filter(name => name.endsWith('.png')).sort()
if (names.length === 0) { console.error(`No PNG captures in ${baseline}.`); process.exit(2) }
let failures = 0
for (const name of names) {
  let other
  try { other = await raw(join(candidate, name)) } catch { console.log(`MISSING  ${name}`); failures += 1; continue }
  const base = await raw(join(baseline, name))
  if (base.width !== other.width || base.height !== other.height) { console.log(`SIZE     ${name}: ${base.width}x${base.height} vs ${other.width}x${other.height}`); failures += 1; continue }
  let different = 0
  let maxDelta = 0
  for (let index = 0; index < base.data.length; index += 4) {
    let pixelDelta = 0
    for (let channel = 0; channel < 3; channel += 1) pixelDelta = Math.max(pixelDelta, Math.abs(base.data[index + channel] - other.data[index + channel]))
    if (pixelDelta > tolerance) different += 1
    maxDelta = Math.max(maxDelta, pixelDelta)
  }
  const fraction = different / (base.width * base.height)
  const ok = fraction <= allowedFraction
  if (!ok) failures += 1
  console.log(`${ok ? 'IDENTICAL' : 'DIFFERS  '} ${name}: ${different} pixel(s) over tolerance ${tolerance} (${(fraction * 100).toFixed(4)}%), max channel delta ${maxDelta}`)
}
console.log(failures === 0 ? `All ${names.length} captures match.` : `${failures} of ${names.length} captures differ.`)
process.exit(failures === 0 ? 0 : 1)
