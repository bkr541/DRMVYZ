#!/usr/bin/env node
// Builds the shipped MARQUEE model. Two reproducible steps:
//   1. scripts/cinema2-assets/marquee/build_marquee_runtime_model.py: the owner's V2 reconstruction builder with a few marked
//      `# RUNTIME DELTA` changes (stronger crown, towers and LED cells). Needs Python 3 with trimesh, numpy, Pillow and shapely
//      (set MARQUEE_PYTHON to a virtualenv's python).
//   2. Texture caps so the model fits every Cinema 2.0 GPU budget. Geometry, node names, materials and hierarchy are untouched:
//        - the three default sign-text planes are fallbacks only (the runtime draws sign text itself at 2048x440), so they are small
//        - the brick albedo is capped at 1280 px wide
// Run with: node scripts/cinema2-assets/build-marquee-runtime.mjs
// The unmodified V2 GLB stays in docs/Marquee/Marquee_Reconstruction_v2 for comparison and rollback.
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const root = resolve(import.meta.dirname, '../..')
const require = createRequire(resolve(root, 'package.json'))
const { NodeIO } = require('@gltf-transform/core')
const sharp = require('sharp')

const builder = resolve(root, 'scripts/cinema2-assets/marquee/build_marquee_runtime_model.py')
const built = mkdtempSync(join(tmpdir(), 'marquee-runtime-'))
const run = spawnSync(process.env.MARQUEE_PYTHON ?? 'python3', [builder], { env: { ...process.env, MARQUEE_BUILD_OUT: built }, encoding: 'utf8' })
if (run.status !== 0) throw new Error(`Marquee model builder failed:\n${run.stderr || run.stdout}`)
const source = join(built, 'DVYDRM_Marquee_HighFidelity_v2.glb')
const target = resolve(root, 'public/cinema2/models/marquee-theater-v2.glb')
const caps = [
  { match: /default_text/, maxWidth: 640 },
  { match: /velvet/, maxWidth: 1024 },
  { match: /brick/, maxWidth: 1280 },
]

const io = new NodeIO()
const document = await io.read(source)
for (const material of document.getRoot().listMaterials()) {
  for (const slot of [material.getBaseColorTexture(), material.getEmissiveTexture()]) {
    if (!slot) continue
    const cap = caps.find(entry => entry.match.test(material.getName()))
    if (!cap) continue
    const image = Buffer.from(slot.getImage())
    const meta = await sharp(image).metadata()
    if (!meta.width || meta.width <= cap.maxWidth) continue
    const resized = await sharp(image).resize({ width: cap.maxWidth }).png({ compressionLevel: 9 }).toBuffer()
    slot.setImage(new Uint8Array(resized))
    console.log(`${material.getName()}: ${meta.width}x${meta.height} -> ${cap.maxWidth} wide`)
  }
}
await io.write(target, document)
console.log(`wrote ${target}`)
