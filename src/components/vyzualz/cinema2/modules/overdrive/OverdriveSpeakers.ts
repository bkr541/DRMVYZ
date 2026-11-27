import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { disposeObject } from '../three/Cinema2ThreeAssetCache'
import speakerUrl from './speaker.glb?url'

export const OVERDRIVE_SPEAKER_DIAMETER = 1.34
export const OVERDRIVE_SPEAKER_FACE_Z = .43

/** The imported driver already faces +Z after its authored GLB node transforms.
 * Keep that orientation: a half-turn exposes the rear motor and basket instead. */
export function normalizeOverdriveSpeaker(T: typeof Three, source: Three.Object3D): Three.Group {
  const mount = new T.Group()
  mount.name = 'overdrive-speaker'
  const oriented = new T.Group()
  oriented.add(source)
  mount.add(oriented)
  const bounds = new T.Box3().setFromObject(oriented, true)
  const size = bounds.getSize(new T.Vector3())
  const center = bounds.getCenter(new T.Vector3())
  const diameter = Math.max(size.x, size.y)
  if (bounds.isEmpty() || !Number.isFinite(diameter) || diameter <= 0) throw new Error('OVERDRIVE speaker has invalid geometry bounds')
  const scale = OVERDRIVE_SPEAKER_DIAMETER / diameter
  oriented.scale.setScalar(scale)
  oriented.position.set(-center.x * scale, -center.y * scale, OVERDRIVE_SPEAKER_FACE_Z - bounds.max.z * scale)
  source.traverse(object => {
    const mesh = object as Three.Mesh
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true }
  })
  return mount
}

/** Decode the single bundled source once per activation. The scene owns the
 * result and shares its GPU resources across all ten driver instances. */
export async function loadOverdriveSpeakerModel(library: Cinema2ThreeLibrary, signal: AbortSignal): Promise<Three.Object3D> {
  const response = await fetch(speakerUrl, { signal })
  if (!response.ok) throw new Error(`OVERDRIVE speaker GLB failed: HTTP ${response.status}`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw new Error('OVERDRIVE speaker is not a GLB')
  if (signal.aborted) throw new Error('OVERDRIVE speaker loading cancelled')
  const { scene } = await new library.GLTFLoader().parseAsync(bytes, '')
  if (signal.aborted) {
    disposeObject(scene)
    throw new Error('OVERDRIVE speaker loading cancelled')
  }
  return scene
}
