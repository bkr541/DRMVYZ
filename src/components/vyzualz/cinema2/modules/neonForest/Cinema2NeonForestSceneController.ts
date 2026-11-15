import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { type NeonForestControls } from './Cinema2NeonForestDomain'
import { NEON_FOREST_MUSIC_DEFAULTS, type NeonForestMusic } from './Cinema2NeonForestAudio'

// Identical position function is installed on surface and depth materials. Roots
// remain fixed, convex pattern blends and final clamps preserve route clearance.
const motion = `
attribute vec3 _nf_root;
attribute float _nf_height, _nf_id, _nf_role;
uniform float uPhase,uAmount,uScale,uDensity,uPortalSize,uPortalMotion;
uniform float uKick,uSnare,uBeat,uBuild,uDrop,uBass,uKickTravel,uDropTravel;
uniform float uWeights[8];
varying float vHeight,vRole,vKeep,vPulse;
varying vec2 vPortalPosition;
float nfHash(float id){return fract(sin(id*127.1+3.7)*43758.5453);}
vec3 nfPosition(vec3 p,float h){
 if(_nf_role==3.0){
  vec3 l=(p-_nf_root)*uPortalSize;
  float bloom=uWeights[4]*(.5+.5*sin(uPhase*.8))+uWeights[7]*uDrop;
  float turn=uPortalMotion*uAmount*(uPhase*.035+uSnare*.16);
  if(_nf_id < -2.5){turn+=uPortalMotion*uAmount*sin(uPhase*.6+_nf_id)*.06;l.xy*=1.0+uPortalMotion*uAmount*.12*bloom;}
  l.xy=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*l.xy;
  return _nf_root+l;
 }
 if(_nf_id<0.0)return p;
 vec3 local=(p-_nf_root)*uScale;
 vec2 radial=normalize(_nf_root.xz+vec2(.001));
 vec2 tangent=vec2(radial.y,-radial.x);
 float r=length(_nf_root.xz),a=atan(_nf_root.x,_nf_root.z),t=uPhase*1.570796327,w=h*h;
 vec3 d=vec3(0.0);
 d.x+=uWeights[0]*sin(t-_nf_root.x*.24)*.72*w;
 d.y+=uWeights[1]*sin(t*.8-r*.38)*local.y*.08;
 d.xz+=uWeights[2]*radial*sin(t-_nf_root.z*.4)*.65*w;
 float twist=sin(t*.7+a*2.0)*.28*w;
 d.xz+=uWeights[3]*(mat2(cos(twist),-sin(twist),sin(twist),cos(twist))*local.xz-local.xz);
 d.xz+=uWeights[4]*radial*(.5+.5*sin(t*.5-r*.2))*.72*w;
 d.xz+=uWeights[5]*vec2(1.0,-1.0)*sin(t+floor((_nf_root.x+_nf_root.z)/4.0)*3.14159)*.44*w;
 d.y+=uWeights[6]*pow(max(0.0,sin(t-floor(mod(_nf_id,4.0))*1.57)),3.0)*local.y*.08;
 d.xz+=uWeights[7]*radial*pow(max(0.0,sin(t*.65-r*.24)),2.0)*.72*w;
 float kick=exp(-abs(r-uKickTravel*35.0)*.18),drop=exp(-abs(r-uDropTravel*40.0)*.12);
 d.xz+=(radial*(uDrop*drop*2.0-uBuild)+tangent*uSnare*sin(a*2.0))*w;
 d.y+=(uKick*kick+uBeat+uSnare*mod(_nf_id,2.0))*.9*w;
 d.x+=sin(t*.7+_nf_id*.2)*uBass*.2*w;
 d*=uAmount;d*=min(1.0,.75*uAmount/max(.0001,length(d)));
 return _nf_root+local+d;
}
void nfVaryings(){
 vHeight=_nf_height;vRole=_nf_role;vPortalPosition=(modelMatrix*vec4(position,1.0)).xy-_nf_root.xy;
 vKeep=_nf_id<0.0||nfHash(_nf_id)<uDensity?1.0:0.0;
 float t=uPhase*1.570796327;
 vPulse=clamp(.5+.5*sin(t-length(_nf_root.xz)*.4)+uKick*3.0+uSnare*2.0+uDrop*2.0-uBuild,0.0,1.0);
}
`
const fragment = `
uniform float uMaster,uEmission,uLight;
uniform vec3 uPrimary,uSecondary,uPortal,uGround;
varying float vHeight,vRole,vKeep,vPulse;
varying vec2 vPortalPosition;
`
export class Cinema2NeonForestSceneController {
  private readonly uniforms: Record<string,{value:number|Three.Color|readonly number[]}>
  private readonly depths: Three.MeshDepthMaterial[]=[]
  private points: Three.Points<Three.BufferGeometry,Three.PointsMaterial>|null=null
  constructor(private readonly library:Cinema2ThreeLibrary){
    const {THREE}=library
    this.uniforms=Object.fromEntries(Object.entries({uPhase:0,uAmount:.65,uScale:1,uDensity:1,uPortalSize:1,uPortalMotion:1,uWeights:[1,0,0,0,0,0,0,0],uKick:0,uSnare:0,uBeat:0,uBuild:0,uDrop:0,uBass:0,uKickTravel:0,uDropTravel:0,uMaster:.85,uEmission:.65,uLight:1,uPrimary:new THREE.Color(),uSecondary:new THREE.Color(),uPortal:new THREE.Color(),uGround:new THREE.Color()}).map(([key,value])=>[key,{value}]))
  }
  attach(root:Three.Object3D):void{
    const {THREE}=this.library
    root.traverse(object=>{
      const mesh=object as Three.Mesh
      if(!mesh.isMesh)return
      if(!mesh.geometry.getAttribute('_nf_root'))throw new Error('NEON FOREST requires prepared root attributes')
      mesh.frustumCulled=false
      const vertex=(s:string)=>motion+s.replace('#include <begin_vertex>','#include <begin_vertex>\nnfVaryings();transformed=(inverse(modelMatrix)*vec4(nfPosition((modelMatrix*vec4(position,1.0)).xyz,_nf_height),1.0)).xyz;')
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        const material=m as Three.MeshStandardMaterial
        material.onBeforeCompile=shader=>{
          Object.assign(shader.uniforms,this.uniforms)
          shader.vertexShader=vertex(shader.vertexShader).replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
if(_nf_id>=0.0){
 vec3 wp=(modelMatrix*vec4(position,1.0)).xyz;
 vec3 n=normalize(mat3(modelMatrix)*objectNormal),tx=normalize(cross(abs(n.y)<.9?vec3(0,1,0):vec3(1,0,0),n)),ty=cross(n,tx);
 float height=max(.1,(wp.y-_nf_root.y)/max(.001,_nf_height));
 vec3 a=nfPosition(wp,_nf_height),b=nfPosition(wp+tx*.01,clamp(_nf_height+tx.y*.01/height,0.0,1.0)),c=nfPosition(wp+ty*.01,clamp(_nf_height+ty.y*.01/height,0.0,1.0));
 objectNormal=normalize(transpose(mat3(modelMatrix))*normalize(cross(b-a,c-a)));
}`)
          shader.fragmentShader=fragment+shader.fragmentShader
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
if(vKeep<.5)discard;
vec3 nfColor=vRole<.5?uPrimary:vRole<1.5?uSecondary:vRole<2.5?uGround:vRole<3.5?mix(uPrimary,uPortal,smoothstep(.1,.85,sin(atan(vPortalPosition.x,vPortalPosition.y)*2.0)*.5+.5)):mix(uPrimary,uSecondary,vPulse);
diffuseColor.rgb*=nfColor;`)
          shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float glow=vRole<1.5?(.12+smoothstep(.12,.95,vHeight)*1.7)*(.65+.35*vPulse):vRole<2.5?0.0:vRole<3.5?3.5:1.4*(.3+.7*vPulse);
totalEmissiveRadiance+=nfColor*glow*uMaster*uEmission*3.2*uLight;`)
        }
        material.customProgramCacheKey=()=> 'neon-forest-surface-v1'
      }
      const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide})
      depth.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.uniforms);shader.vertexShader=vertex(shader.vertexShader);shader.fragmentShader='varying float vKeep;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vKeep<.5)discard;')}
      depth.customProgramCacheKey=()=> 'neon-forest-depth-v1'
      mesh.customDepthMaterial=depth;this.depths.push(depth)
    })
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(192*3),3))
    const material=new THREE.PointsMaterial({color:0xaaffff,size:.075,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending})
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(length(gl_PointCoord-vec2(.5))>.5)discard;')}
    this.points=new THREE.Points(geometry,material);this.points.frustumCulled=false;root.add(this.points)
  }
  apply(c:NeonForestControls,phase:number,music:NeonForestMusic={...NEON_FOREST_MUSIC_DEFAULTS},weights:readonly number[]=Array.from({length:8},(_,i)=>i===c.pattern?1:0)):void{
    const u=this.uniforms,moving=c.motion&&c.amount>0&&c.speed>0
    for(const [key,value]of Object.entries({uPhase:phase,uAmount:c.motion?c.amount*(moving?music.musicRange:1):0,uScale:c.scale,uDensity:c.density,uPortalSize:c.portalSize,uPortalMotion:c.portalMotion?1:0,uMaster:c.master,uEmission:c.emission,uLight:music.musicLight}))u[key].value=value
    for(const [key,value]of Object.entries({uKick:music.musicKick,uSnare:music.musicSnare,uBeat:music.musicBeat,uBuild:music.musicBuild,uDrop:music.musicDrop,uBass:music.musicBend}))u[key].value=moving?value:0
    u.uWeights.value=weights;u.uKickTravel.value=music.musicKickTravel;u.uDropTravel.value=music.musicDropTravel
    for(const [key,uniform]of [['primaryColor','uPrimary'],['secondaryColor','uSecondary'],['portalColor','uPortal'],['groundColor','uGround']]as const){const color=c.colors[key];(u[uniform].value as Three.Color).setRGB(color[0],color[1],color[2],this.library.THREE.SRGBColorSpace)}
    if(this.points){
      const count=Math.round(c.particles*192*music.musicParticles),p=this.points.geometry.attributes.position as Three.BufferAttribute
      for(let i=0;i<count;i++){const a=i*2.39996,r=2+i*7.13%27,t=phase*.05;p.setXYZ(i,Math.sin(a+t*.08)*r,.3+(i*.37+t)%8+(moving?music.musicSnare:0),Math.cos(a+t*.08)*r)}
      p.needsUpdate=true;this.points.geometry.setDrawRange(0,count)
      const color=c.colors.particleColor;this.points.material.color.setRGB(color[0],color[1],color[2],this.library.THREE.SRGBColorSpace);this.points.material.opacity=.7*c.master
    }
  }
  dispose():void{for(const d of this.depths)d.dispose();this.depths.length=0;if(this.points){this.points.removeFromParent();this.points.geometry.dispose();this.points.material.dispose();this.points=null}}
}
