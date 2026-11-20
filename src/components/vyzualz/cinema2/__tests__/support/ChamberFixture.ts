import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const SOURCE = 'public/cinema2/models/chamber.glb'

/**
 * The real chamber GLB for Node tests: the embedded PNG is dropped (a browser decodes it in the production tests; Node has no image decoder), so the
 * geometry, hierarchy and material names are exactly the shipped file's.
 */
export async function loadChamberScene(): Promise<THREE.Group> {
  const bytes = readFileSync(SOURCE), length = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + length).toString())
  json.textures = []; json.images = []
  for (const material of json.materials) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.emissiveTexture }
  const text = Buffer.from(JSON.stringify(json)), padded = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 32)]), bin = bytes.subarray(28 + length)
  const out = Buffer.alloc(28 + padded.length + bin.length)
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(padded.length, 12); out.writeUInt32LE(0x4e4f534a, 16)
  padded.copy(out, 20); out.writeUInt32LE(bin.length, 20 + padded.length); out.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(out, 28 + padded.length)
  const gltf = await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset, out.byteOffset + out.length), '')
  return gltf.scene
}
