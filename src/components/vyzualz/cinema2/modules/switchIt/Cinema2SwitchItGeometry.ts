import type * as Three from 'three'
import { SWITCH_IT_HUMAN_METADATA, SWITCH_IT_HUMAN_POSITIONS } from './Cinema2SwitchItHuman.generated'

export const SWITCH_IT_STATIC_STATES = ['human', 'skull', 'hybrid', 'crown'] as const
export type SwitchItStaticState = typeof SWITCH_IT_STATIC_STATES[number]
export const SWITCH_IT_LANDMARKS = Object.freeze({ crown: 1.21, eyes: .22, chin: -.95, eyeX: .277, projectionNeckCut: -.98 })
export function decodeSwitchItHuman(): Float32Array {
  const source=atob(SWITCH_IT_HUMAN_POSITIONS),bytes=new Uint8Array(source.length)
  for(let i=0;i<source.length;i++)bytes[i]=source.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}
export function decorateSwitchItGeometry(THREE: typeof Three, geometry: Three.BufferGeometry): Three.BufferGeometry {
  const flat=geometry.index?geometry.toNonIndexed():geometry
  flat.computeVertexNormals()
  const p=flat.getAttribute('position'),centers=new Float32Array(p.count*3),seeds=new Float32Array(p.count)
  for(let i=0;i<p.count;i+=3){
    const c=[0,1,2].map(k=>(p.array[i*3+k]+p.array[(i+1)*3+k]+p.array[(i+2)*3+k])/3)
    const seed=((Math.imul(i+19,2654435761)>>>0)%10007)/10007
    for(let j=0;j<3;j++){centers.set(c,(i+j)*3);seeds[i+j]=seed}
  }
  flat.setAttribute('aCenter',new THREE.BufferAttribute(centers,3));flat.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1))
  return flat
}
export function buildSwitchItHuman(THREE: typeof Three): Three.BufferGeometry {
  return decorateSwitchItGeometry(THREE,new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(decodeSwitchItHuman(),3)))
}
export function buildSwitchItEyes(THREE: typeof Three): Three.BufferGeometry[] {
  return SWITCH_IT_HUMAN_METADATA.eyes.map(eye=>{
    const [x,y,z]=eye.center,shape=new THREE.Shape()
    shape.moveTo(-.135,0);shape.quadraticCurveTo(-.025,.085,.135,0);shape.quadraticCurveTo(.025,-.05,-.135,0)
    const geometry=new THREE.ShapeGeometry(shape,5);geometry.translate(x,y,z+.015)
    return decorateSwitchItGeometry(THREE,geometry)
  })
}
