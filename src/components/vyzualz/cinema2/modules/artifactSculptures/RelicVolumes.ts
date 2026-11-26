import type * as Three from 'three'
import type { ArtifactState, Point } from './ArtifactDomain'
import { clamp } from './ArtifactDomain'
import { relicPose, type RelicPart } from './Relic'

type XY=readonly [number,number]
type RegisterGeometry=<G extends Three.BufferGeometry>(geometry:G)=>G
const crown:XY[]=[[.035,1.04],[.035,2.79],[.46,2.96],[1.22,2.78],[1.83,2.36],[2.10,1.77],[1.98,1.12],[1.58,.91],[.91,1.04],[.38,.99]]
const face:XY[]=[[.035,.94],[.46,1.05],[1.13,1.02],[1.65,.88],[1.99,1.05],[2.13,.42],[2.06,-.20],[1.74,-.69],[1.37,-.83],[1.30,-1.13],[.13,-1.20],[.035,-.78],[.39,-.49],[.34,-.12],[.035,.10]]
const crownChannel:XY[]=[[.25,2.29],[.85,2.41],[1.36,2.24],[1.30,2.49],[.85,2.66],[.25,2.54]]
const socket:XY[]=[[.40,.53],[.67,.77],[1.25,.77],[1.71,.49],[1.67,.08],[1.32,-.25],[.79,-.24],[.46,.04]]
const jaw:XY[]=[[.035,-2.36],[.64,-2.39],[1.24,-2.14],[1.42,-1.80],[1.22,-1.60],[.80,-1.90],[.035,-1.94]]

/** Static bevel topology. The paired volumes are rigidly animated, never rebuilt per frame. */
export class RelicVolumes {
  readonly root:Three.Group
  private readonly parts:{group:Three.Group;side:number;region:RelicPart}[]=[]
  private readonly eyes:Three.Mesh[]=[]
  private readonly geometries=new Set<Three.BufferGeometry>()
  private readonly matrix:Three.Matrix4
  private readonly vectors:Three.Vector3[]
  constructor(T:typeof Three,register:RegisterGeometry,metal:Three.Material,secondary:Three.Material,core:Three.Material){
    this.root=new T.Group();this.root.name='Relic solid sculpture'
    this.matrix=new T.Matrix4();this.vectors=Array.from({length:4},()=>new T.Vector3())
    const geo=<G extends Three.BufferGeometry>(g:G):G=>{this.geometries.add(g);return register(g)}
    const trace=(path:Three.Path,points:XY[],side:number)=>{
      points.forEach(([x,y],i)=>{if(i===0)path.moveTo(side*x,y);else path.lineTo(side*x,y)});path.closePath()
    }
    const plate=(outline:XY[],side:number,depth:number,bevel:number,holes:XY[][]=[])=>{
      const shape=new T.Shape();trace(shape,outline,side)
      for(const points of holes){const hole=new T.Path();trace(hole,points,side);shape.holes.push(hole)}
      return geo(new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1,curveSegments:4}))
    }
    const mesh=(parent:Three.Group,g:Three.BufferGeometry,material:Three.Material,position:Point,scale:Point=[1,1,1])=>{
      const object=new T.Mesh(g,material);object.position.set(...position);object.scale.set(...scale);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object
    }
    const tooth=plate([[-.10,-.18],[.10,-.18],[.13,.15],[-.13,.15]],1,.22,.035)
    const ellipsoid=geo(new T.SphereGeometry(1,20,12))
    const cut=geo(new T.CircleGeometry(1,32))
    const bolt=geo(new T.CylinderGeometry(1,1,1,8));const bar=geo(new T.BoxGeometry(1,1,1))
    for(const side of [-1,1]){
      const group=(region:RelicPart)=>{const g=new T.Group();g.name=`${region}:${side}`;g.matrixAutoUpdate=false;this.root.add(g);this.parts.push({group:g,side,region});return g}
      const upper=group('crown'),front=group('face'),lower=group('jaw')
      // Half-domes share a sagittal seam; the back is set behind the orbital recess.
      const half=geo(new T.SphereGeometry(1,24,16,side===1?Math.PI/2:Math.PI*1.5,Math.PI))
      mesh(upper,half,metal,[side*.055,1.05,-.58],[2.05,1.95,1.38])
      const cap=mesh(upper,cut,secondary,[side*.055,1.05,-.58],[1.38,1.95,1]);cap.rotation.y=-side*Math.PI/2
      mesh(upper,plate(crown,side,.64,.075,[crownChannel]),metal,[0,0,.74]).name='crown armor'
      mesh(upper,plate([[.19,1.30],[.37,1.77],[.62,2.24],[1.31,2.04],[1.69,1.55],[1.46,1.29]],side,.055,.035),secondary,[0,0,1.40])
      // True through-hole in the front armor, with a dark inner cup set back from the opening.
      mesh(front,plate(face,side,.73,.065,[socket]),metal,[0,0,.86]).name='orbital armor'
      mesh(front,ellipsoid,secondary,[side*1.08,.29,.67],[.76,.56,.25])
      const eye=mesh(front,ellipsoid,core,[side*1.06,.29,1.04],[.36,.11,.10]);eye.name='recessed energy lens';this.eyes.push(eye)
      mesh(front,plate([[1.55,-.34],[1.94,-.19],[1.83,-.59],[1.42,-.83],[.75,-.81]],side,.08,.035),secondary,[0,0,1.64])
      // Solid zygomatic process extends back into the head, leaving the mouth opening clear.
      const cheek=mesh(front,ellipsoid,metal,[side*1.71,-.32,.31],[.30,.51,1.08]);cheek.rotation.z=side*-.27
      mesh(lower,plate(jaw,side,.48,.075),metal,[0,0,1.10])
      const ramus=mesh(lower,plate([[-.85,-.68],[-.50,-.62],[1.31,-1.69],[1.48,-2.04],[.94,-2.15],[-.80,-1.12]],1,.39,.07),metal,[side*1.14+.195,0,0]);ramus.rotation.y=-Math.PI/2
      // Hinge pin and a cheek mounting fastener use the secondary structural palette.
      const hinge=mesh(lower,bolt,secondary,[side*1.45,-.77,-.61],[.31,.20,.31]);hinge.rotation.z=Math.PI/2
      const fastener=mesh(front,bolt,secondary,[side*1.83,-.35,1.48],[.11,.14,.11]);fastener.rotation.x=Math.PI/2
      mesh(lower,bar,secondary,[side*.54,-2.15,1.64],[.62,.10,.09])
      for(let i=0;i<5;i++){
        const x=side*(.15+i*.245),z=1.25-.08*i
        mesh(front,tooth,secondary,[x,-1.27+.015*i,z],[.82,1,.92])
        mesh(lower,tooth,secondary,[x,-1.88+.035*i,z-.06],[.79,.86,.92])
      }
    }
  }
  update(state:ArtifactState){
    const {part}=relicPose(state),[o,x,y,z]=this.vectors
    for(const {group,side,region} of this.parts){
      const transform=part(side,region)
      o!.set(...transform([0,0,0]));x!.set(...transform([1,0,0])).sub(o!);y!.set(...transform([0,1,0])).sub(o!);z!.set(...transform([0,0,1])).sub(o!)
      this.matrix.makeBasis(x!,y!,z!).setPosition(o!);group.matrix.copy(this.matrix);group.matrixWorldNeedsUpdate=true
    }
    const scale=clamp(state.values.coreScale,.35,1.5)
    for(const eye of this.eyes)eye.scale.set(.36*scale,.11*scale,.10*scale)
  }
  inspect(){return {relicSolidParts:this.parts.length,relicSolidMeshes:this.parts.reduce((sum,{group})=>sum+group.children.length,0)}}
  estimateGpuBytes(){let bytes=0;for(const g of this.geometries){for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;bytes+=g.index?.array.byteLength??0}return bytes}
}
