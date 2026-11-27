import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { disposeObject } from '../three/Cinema2ThreeAssetCache'
import speaker1Url from './speaker-1.glb?url'
import speaker2Url from './speaker-2.glb?url'

export type OverdriveSpeakerModels = readonly [Three.Object3D, Three.Object3D]
export const OVERDRIVE_SPEAKER_DIAMETER = 1.34
export const OVERDRIVE_SPEAKER_FACE_Z = .43

/** The supplied drivers are native +Z and -Y respectively. Preserve the imported
 * hierarchy, textures and aspect ratio; match the old circular mounting envelope. */
export function normalizeOverdriveSpeaker(T: typeof Three, source: Three.Object3D, variant: 0 | 1): Three.Group {
  const mount = new T.Group()
  mount.name = `overdrive-speaker-${variant + 1}`
  const oriented = new T.Group()
  oriented.rotation.x = variant === 1 ? -Math.PI / 2 : 0
  oriented.add(source)
  mount.add(oriented)
  const bounds = new T.Box3().setFromObject(oriented, true)
  const size = bounds.getSize(new T.Vector3())
  const center = bounds.getCenter(new T.Vector3())
  const diameter = Math.max(size.x, size.y)
  if (bounds.isEmpty() || !Number.isFinite(diameter) || diameter <= 0) throw new Error(`OVERDRIVE speaker ${variant + 1} has invalid geometry bounds`)
  const scale = OVERDRIVE_SPEAKER_DIAMETER / diameter
  oriented.scale.setScalar(scale)
  oriented.position.set(-center.x * scale, -center.y * scale, OVERDRIVE_SPEAKER_FACE_Z - bounds.max.z * scale)
  source.traverse(object => {
    const mesh = object as Three.Mesh
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true }
  })
  return mount
}

/** Both source scenes are decoded only once per activation, and their ten clones
 * share the original geometry, materials and textures. Never publish half a bank. */
export async function loadOverdriveSpeakerModels(library: Cinema2ThreeLibrary, signal: AbortSignal): Promise<OverdriveSpeakerModels> {
  const results = await Promise.allSettled([speaker1Url, speaker2Url].map(async (url, index) => {
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`OVERDRIVE speaker ${index + 1} GLB failed: HTTP ${response.status}`)
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength < 12 || new DataView(bytes).getUint32(0, true) !== 0x46546c67) throw new Error(`OVERDRIVE speaker ${index + 1} is not a GLB`)
    return (await new library.GLTFLoader().parseAsync(bytes, '')).scene
  }))
  const [a, b] = results
  if (!signal.aborted && a?.status === 'fulfilled' && b?.status === 'fulfilled') return [a.value, b.value]
  for (const result of results) if (result.status === 'fulfilled') disposeObject(result.value)
  const failure = results.find(result => result.status === 'rejected')
  throw failure?.status === 'rejected' ? failure.reason : new Error('OVERDRIVE speaker loading cancelled')
}
