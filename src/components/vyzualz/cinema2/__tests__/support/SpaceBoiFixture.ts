import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const SOURCE = 'public/cinema2/models/space-boi.glb'

/** The real Space Boi GLB for Node tests. It has no textures, so the geometry, hierarchy and material names are exactly the shipped file's. */
export async function loadSpaceBoiScene(): Promise<THREE.Group> {
  const bytes = readFileSync(SOURCE)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '')
  gltf.scene.updateMatrixWorld(true)
  return gltf.scene
}
