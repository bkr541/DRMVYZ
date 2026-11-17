// Repacks the owner-supplied space.glb (a 50,000-star spiral galaxy: float32 positions + float32 RGBA colors, 1.34 MiB) into
// public/cinema2/models/event-horizon-space.glb (0.57 MiB) so it fits the installer budget:
//   positions -> unsigned 16-bit integers (KHR_mesh_quantization) with the dequantizing scale/offset on the mesh node, padded to 8 bytes per vertex
//   colors    -> normalized unsigned 8-bit RGBA
// Every star keeps its place to within 0.005 source units (about 0.001 world units at the scale the renderer draws it) and its color to 1/255.
// Usage: node scripts/cinema2-assets/pack-event-horizon-space.mjs /path/to/space.glb
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = process.argv[2]
if (!source) { console.error('Usage: node scripts/cinema2-assets/pack-event-horizon-space.mjs /path/to/space.glb'); process.exit(1) }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const output = join(root, 'public/cinema2/models/event-horizon-space.glb')

const input = readFileSync(source)
if (input.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB file.')
const jsonLength = input.readUInt32LE(12)
const json = JSON.parse(input.subarray(20, 20 + jsonLength).toString('utf8'))
const binStart = 20 + jsonLength + 8
const bin = input.subarray(binStart)
const primitive = json.meshes[0].primitives[0]
if (primitive.mode !== 0 || json.meshes.length !== 1) throw new Error('Expected one point-cloud primitive.')
const positionAccessor = json.accessors[primitive.attributes.POSITION], colorAccessor = json.accessors[primitive.attributes.COLOR_0]
const count = positionAccessor.count
const view = accessor => ({ byteOffset: (json.bufferViews[accessor.bufferView].byteOffset ?? 0) + (accessor.byteOffset ?? 0) })
const positions = new Float32Array(bin.buffer.slice(bin.byteOffset + view(positionAccessor).byteOffset, bin.byteOffset + view(positionAccessor).byteOffset + count * 12))
const colors = new Float32Array(bin.buffer.slice(bin.byteOffset + view(colorAccessor).byteOffset, bin.byteOffset + view(colorAccessor).byteOffset + count * 16))

const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < count; i += 1) for (let a = 0; a < 3; a += 1) { min[a] = Math.min(min[a], positions[i * 3 + a]); max[a] = Math.max(max[a], positions[i * 3 + a]) }
const extent = max.map((value, a) => (value - min[a]) || 1)

const positionBytes = Buffer.alloc(count * 8)
const colorBytes = Buffer.alloc(count * 4)
const quantizedMin = [65535, 65535, 65535], quantizedMax = [0, 0, 0]
for (let i = 0; i < count; i += 1) {
  for (let a = 0; a < 3; a += 1) {
    const q = Math.round((positions[i * 3 + a] - min[a]) / extent[a] * 65535)
    positionBytes.writeUInt16LE(q, i * 8 + a * 2)
    quantizedMin[a] = Math.min(quantizedMin[a], q); quantizedMax[a] = Math.max(quantizedMax[a], q)
  }
  for (let a = 0; a < 4; a += 1) colorBytes[i * 4 + a] = Math.round(Math.min(1, Math.max(0, colors[i * 4 + a])) * 255)
}

// The mesh node dequantizes (scale, then translate) and the original scene transform stays on its parent nodes.
const nodes = json.nodes.map(node => ({ ...node }))
const meshNodeIndex = nodes.findIndex(node => node.mesh === 0)
if (meshNodeIndex < 0 || nodes[meshNodeIndex].matrix || nodes[meshNodeIndex].translation || nodes[meshNodeIndex].scale) throw new Error('Unexpected mesh node transform.')
nodes[meshNodeIndex].translation = min
nodes[meshNodeIndex].scale = extent.map(value => value / 65535)

const out = {
  asset: { ...json.asset, extras: { ...json.asset.extras, modifiedBy: 'DRMVYZ: positions quantized to 16 bits (KHR_mesh_quantization) and colors to 8 bits to fit the installer budget.' } },
  extensionsUsed: ['KHR_materials_unlit', 'KHR_mesh_quantization'],
  extensionsRequired: ['KHR_mesh_quantization'],
  scene: json.scene ?? 0, scenes: json.scenes, nodes,
  meshes: [{ ...json.meshes[0], primitives: [{ mode: 0, attributes: { POSITION: 0, COLOR_0: 1 }, material: primitive.material }] }],
  materials: json.materials,
  accessors: [
    { bufferView: 0, componentType: 5123, count, type: 'VEC3', min: quantizedMin, max: quantizedMax },
    { bufferView: 1, componentType: 5121, normalized: true, count, type: 'VEC4' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: positionBytes.length, byteStride: 8, target: 34962 },
    { buffer: 0, byteOffset: positionBytes.length, byteLength: colorBytes.length, byteStride: 4, target: 34962 },
  ],
  buffers: [{ byteLength: positionBytes.length + colorBytes.length }],
}
const pad = (buffer, byte) => { const rest = (4 - (buffer.length % 4)) % 4; return rest ? Buffer.concat([buffer, Buffer.alloc(rest, byte)]) : buffer }
const jsonChunk = pad(Buffer.from(JSON.stringify(out)), 0x20)
const binChunk = pad(Buffer.concat([positionBytes, colorBytes]), 0)
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonChunk.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binChunk.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
writeFileSync(output, Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]))
console.log(`event-horizon-space.glb: ${count} stars, ${((12 + 16 + jsonChunk.length + binChunk.length) / 1024 / 1024).toFixed(2)} MiB`)
