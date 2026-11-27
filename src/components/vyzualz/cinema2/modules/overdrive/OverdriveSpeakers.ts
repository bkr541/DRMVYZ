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

/** The bundled GLB separates the Black surround/dust cap and Grey diaphragm
 * from its Copper basket. Author one relative morph per owned geometry, then
 * let the ten clones share those buffers with independent morph weights.
 * Work in normalized mount space so the original GLB axis remains untouched. */
export function prepareOverdriveDiaphragm(T:typeof Three, model:Three.Group) {
  model.updateMatrixWorld(true)
  const mountInverse=model.matrixWorld.clone().invert()
  model.traverse(object=>{
    const mesh=object as Three.Mesh
    if(!mesh.isMesh||Array.isArray(mesh.material)||!['Black','Grey'].includes(mesh.material.name))return
    const geometry=mesh.geometry
    const position=geometry.getAttribute('position')
    if(!position||geometry.morphAttributes.position?.length)return
    const toMount=mountInverse.clone().multiply(mesh.matrixWorld)
    const fromMount=toMount.clone().invert()
    const p=new T.Vector3(),offset=new T.Vector3(),origin=new T.Vector3().applyMatrix4(fromMount)
    const values=new Float32Array(position.count*3)
    for(let i=0;i<position.count;i++){
      p.fromBufferAttribute(position,i).applyMatrix4(toMount)
      const r=Math.hypot(p.x,p.y)/(OVERDRIVE_SPEAKER_DIAMETER*.5)
      // Keep the outer surround pinned. The dust cap and inner cone translate
      // together, tapering smoothly into the flexible outer suspension.
      const t=Math.max(0,Math.min(1,(r-.60)/.28))
      const weight=1-t*t*(3-2*t)
      offset.set(0,0,.095*weight).applyMatrix4(fromMount).sub(origin)
      values.set([offset.x,offset.y,offset.z],i*3)
    }
    const morph=new T.BufferAttribute(values,3);morph.name='overdrive-bass-excursion'
    geometry.morphTargetsRelative=true;geometry.morphAttributes.position=[morph]
    mesh.updateMorphTargets()
    // The negative excursion is also legal; conservative bounds prevent culling.
    geometry.computeBoundingBox();geometry.boundingBox?.expandByScalar(.25)
    geometry.computeBoundingSphere();if(geometry.boundingSphere)geometry.boundingSphere.radius+=.25
  })
}

export function applyOverdriveDiaphragm(root:Three.Object3D,amount:number){
  root.traverse(object=>{
    const mesh=object as Three.Mesh
    const index=mesh.morphTargetDictionary?.['overdrive-bass-excursion']
    if(mesh.isMesh&&index!==undefined&&mesh.morphTargetInfluences)mesh.morphTargetInfluences[index]=amount
  })
}
