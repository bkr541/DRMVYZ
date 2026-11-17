import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import type { Cinema2EventHorizonSpaceField } from './Cinema2EventHorizonSpaceField'

const PARTICLE_VERTEX_SOURCE = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 i_positionSize;
layout(location=2) in vec4 i_kindBandSectorRandom;
layout(location=3) in vec4 i_orbitPhaseLayer;
uniform mat4 u_viewProjection;
uniform vec3 u_cameraPosition;
uniform float u_time;
uniform float u_coreRadius;
uniform float u_diskRadius;
uniform float u_diskThickness;
uniform float u_tilt;
uniform float u_rotation;
uniform float u_build;
uniform float u_drop;
out vec2 v_uv;
flat out float v_kind;
flat out float v_band;
flat out float v_sector;
flat out float v_random;
out float v_depthFade;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,-s,0,s,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,-s,0,s,c,0,0,0,1);}
void main(){
  float kind=i_kindBandSectorRandom.x;
  float random=i_kindBandSectorRandom.w;
  vec3 center=i_positionSize.xyz;
  float size=i_positionSize.w;
  if(kind<0.5){
    float radius=mix(u_coreRadius*1.28,u_diskRadius,clamp(i_orbitPhaseLayer.w,0.0,1.0));
    radius*=1.0-u_build*0.12+u_drop*(0.08+0.08*random);
    float phase=i_orbitPhaseLayer.x+u_time*u_rotation*(0.18+0.12*i_orbitPhaseLayer.z);
    center=vec3(cos(phase)*radius,i_orbitPhaseLayer.y*u_diskThickness,sin(phase)*radius);
    float layerTilt=(i_orbitPhaseLayer.z-0.5)*0.16;
    mat3 diskRotation=rotateZ(u_tilt*0.22)*rotateX(u_tilt+layerTilt);
    center=diskRotation*center;
    size*=mix(0.72,1.35,u_diskThickness/0.25);
  }else if(kind>1.5){
    float phase=i_orbitPhaseLayer.x+u_time*u_rotation*(0.05+0.07*random);
    center=vec3(cos(phase)*i_orbitPhaseLayer.y,i_orbitPhaseLayer.z,sin(phase)*i_orbitPhaseLayer.y);
    center=rotateX(u_tilt*0.55)*center;
    center*=1.0+u_drop*(0.12+random*0.22);
  }
  vec3 toCamera=normalize(u_cameraPosition-center);
  float tangentPhase=i_orbitPhaseLayer.x+u_time*u_rotation*(0.18+0.12*i_orbitPhaseLayer.z);
  vec3 orbitalTangent=kind<0.5?rotateZ(u_tilt*0.22)*rotateX(u_tilt+(i_orbitPhaseLayer.z-0.5)*0.16)*vec3(-sin(tangentPhase),0,cos(tangentPhase)):vec3(1,0,0);
  vec3 right=normalize(orbitalTangent-toCamera*dot(orbitalTangent,toCamera));
  if(length(right)<0.01)right=vec3(1,0,0);
  vec3 up=normalize(cross(toCamera,right));
  float elongated=kind<0.5?3.1:2.2;
  vec3 world=center+right*a_corner.x*size*elongated+up*a_corner.y*size;
  gl_Position=u_viewProjection*vec4(world,1);
  v_uv=a_corner;v_kind=kind;v_band=i_kindBandSectorRandom.y;v_sector=i_kindBandSectorRandom.z;v_random=random;
  v_depthFade=clamp(1.0-length(center-u_cameraPosition)/32.0,0.12,1.0);
}`

const PARTICLE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_uv;
flat in float v_kind;
flat in float v_band;
flat in float v_sector;
flat in float v_random;
in float v_depthFade;
uniform int u_look;
uniform vec3 u_primary;
uniform vec3 u_secondary;
uniform vec3 u_accent;
uniform float u_intensity;
uniform float u_energy;
uniform float u_bass;
uniform float u_kick;
uniform float u_snare;
uniform float u_downbeat;
uniform float u_phrase;
uniform float u_build;
uniform float u_drop;
uniform float u_activeBand;
uniform float u_activeSector;
out vec4 outColor;
void main(){
  float radius=length(v_uv);
  float soft=exp(-radius*radius*4.8)*(1.0-smoothstep(0.68,1.0,radius));
  float bandHit=1.0-step(0.45,abs(v_band-u_activeBand));
  float sectorDistance=abs(v_sector-u_activeSector);sectorDistance=min(sectorDistance,12.0-sectorDistance);
  float sectorHit=1.0-step(0.55,sectorDistance);
  vec3 color;float alpha;
  if(v_kind<0.5){
    float heat=1.0-clamp((v_band+v_random*0.25)/6.0,0.0,1.0);
    color=mix(u_secondary,u_primary,0.28+0.62*v_random);color=mix(color,u_accent,heat*(0.48+0.32*sectorHit));
    if(u_look==1)color=mix(vec3(0.18,0.005,0.015),mix(u_accent,vec3(1.0,0.18,0.035),heat),0.72);
    if(u_look==2)color=mix(u_primary,u_secondary,step(0.5,v_random));
    float choreography=1.0+bandHit*(u_downbeat*1.6+u_build*0.55)+sectorHit*(u_kick*1.3+u_phrase*0.75);
    alpha=soft*(0.065+0.105*v_random+u_energy*0.065+heat*0.105)*choreography;
    color*=u_intensity*(1.18+heat*1.72+u_bass*0.58+u_drop*0.82);
  }else if(v_kind<1.5){color=mix(u_secondary,u_primary,v_random);alpha=soft*(0.22+0.44*v_random)*v_depthFade;color*=0.55+u_energy*0.28;}
  else{color=mix(u_primary,u_accent,v_random);alpha=soft*(0.24+u_snare*0.34+sectorHit*u_kick*0.25)*v_depthFade;color*=0.38+u_energy*0.3+u_drop*0.42;}
  if(alpha<0.008)discard;outColor=vec4(color*alpha,alpha);
}`

const CORE_VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
uniform mat4 u_viewProjection;
uniform float u_radius;
uniform float u_drop;
out vec3 v_world;
out vec3 v_normal;
void main(){float radius=u_radius*(1.0+u_drop*0.08);v_world=a_position*radius;v_normal=a_normal;gl_Position=u_viewProjection*vec4(v_world,1);}`

const CORE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_normal;
uniform vec3 u_cameraPosition;
uniform vec3 u_primary;
uniform vec3 u_accent;
uniform float u_lensing;
uniform float u_downbeat;
out vec4 outColor;
void main(){vec3 view=normalize(u_cameraPosition-v_world);float rim=pow(1.0-max(dot(normalize(v_normal),view),0.0),7.0);vec3 edge=mix(u_primary,u_accent,0.22)*rim*step(0.12,rim)*(0.24+u_lensing*0.11+u_downbeat*0.08);outColor=vec4(edge,1);}`

const MESH_VERTEX_SOURCE=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 i_positionSize;
layout(location=3) in vec4 i_kindBandSectorRandom;
layout(location=4) in vec4 i_orbitPhaseLayer;
uniform mat4 u_viewProjection;
uniform float u_time;
uniform float u_rotation;
uniform float u_tilt;
uniform float u_drop;
out vec3 v_normal;
flat out float v_kind;
flat out float v_random;
flat out float v_sector;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,-s,0,s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0,s,0,1,0,-s,0,c);}
void main(){
  float kind=i_kindBandSectorRandom.x;
  float random=i_kindBandSectorRandom.w;
  vec3 center=i_positionSize.xyz;
  mat3 rotation=mat3(1);
  vec3 shape=vec3(1);
  if(kind>1.5){
    float phase=i_orbitPhaseLayer.x+u_time*u_rotation*(0.08+random*0.09);
    center=vec3(cos(phase)*i_orbitPhaseLayer.y,i_orbitPhaseLayer.z,sin(phase)*i_orbitPhaseLayer.y);
    center=rotateX(u_tilt*0.55)*center*(1.0+u_drop*(0.12+random*0.22));
    rotation=rotateX(random*3.14159+u_time*(0.18+random*0.24))*rotateY(phase+u_time*(0.12+random*0.31));
    shape=vec3(2.8,0.62,0.9);
  }
  vec3 local=rotation*(a_position*i_positionSize.w*shape);
  v_normal=rotation*a_normal;v_kind=kind;v_random=random;v_sector=i_kindBandSectorRandom.z;
  gl_Position=u_viewProjection*vec4(center+local,1);
}`

const MESH_FRAGMENT_SOURCE=`#version 300 es
precision highp float;
in vec3 v_normal;
flat in float v_kind;
flat in float v_random;
flat in float v_sector;
uniform vec3 u_primary;
uniform vec3 u_secondary;
uniform vec3 u_accent;
uniform float u_time;
uniform float u_energy;
uniform float u_snare;
uniform float u_drop;
uniform float u_activeSector;
out vec4 outColor;
void main(){
  float sectorDistance=abs(v_sector-u_activeSector);sectorDistance=min(sectorDistance,12.0-sectorDistance);
  float sectorHit=1.0-step(0.55,sectorDistance);
  vec3 normal=normalize(v_normal);float light=0.28+0.72*abs(dot(normal,normalize(vec3(-0.4,0.7,0.5))));
  vec3 color=mix(u_primary,u_accent,v_random)*light*(0.8+u_snare*0.8+u_drop*1.2+sectorHit*0.35);
  outColor=vec4(color,1);
}`

/** The supplied galaxy: one point per star. Every musical channel the module already carries (the shared geometry choreography) moves the stars. */
const SPACE_VERTEX_SOURCE = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_color;
layout(location=2) in vec2 a_randomRadial;
uniform mat4 u_viewProjection;
uniform float u_time;
uniform float u_scale;
uniform float u_rotation;
uniform float u_pixelScale;
uniform float u_starSize;
uniform float u_intensity;
uniform float u_tilt;
uniform float u_energy;
uniform float u_bass;
uniform float u_kick;
uniform float u_snare;
uniform float u_downbeat;
uniform float u_phrase;
uniform float u_build;
uniform float u_drop;
uniform float u_activeSector;
uniform vec3 u_primary;
uniform vec3 u_secondary;
uniform vec3 u_accent;
out vec3 v_color;
out float v_alpha;
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0,s,0,1,0,-s,0,c);}
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,-s,0,s,c);}
void main(){
  float random=a_randomRadial.x;
  float radial=a_randomRadial.y;
  float inner=1.0-clamp(radial,0.0,1.0);
  // Differential rotation: the bulge turns faster than the rim, like a real galaxy.
  float turn=u_time*u_rotation*0.035*(0.35+inner*1.1);
  vec3 galaxy=rotateX(u_tilt*0.18)*(rotateY(turn)*a_position);
  float azimuth=atan(galaxy.z,galaxy.x)/6.2831853+0.5;
  float sector=floor(azimuth*12.0);
  float sectorDistance=abs(sector-u_activeSector);sectorDistance=min(sectorDistance,12.0-sectorDistance);
  float sectorHit=1.0-step(0.55,sectorDistance);
  // Build gathers the galaxy toward the core; a drop throws it outward, the rim furthest.
  float gather=1.0-u_build*0.09*(0.4+inner);
  float shock=1.0+u_drop*(0.07+0.14*random)*(0.45+0.55*clamp(radial,0.0,1.0));
  vec3 world=galaxy*u_scale*gather*shock;
  gl_Position=u_viewProjection*vec4(world,1.0);
  // The downbeat sends a bright shell out from the black hole (its envelope falls 1 -> 0, so the front travels outward as it fades).
  float front=(1.0-u_downbeat)*1.7;
  float shell=u_downbeat*exp(-pow((radial-front)*5.0,2.0));
  float twinkle=0.78+0.22*sin(u_time*(0.7+random*2.2)+random*40.0);
  float magnitude=0.35+0.65*random*random;
  float sparkle=u_snare*step(0.88,fract(random*7.0+floor(u_time*3.0)*0.37));
  float kickHit=sectorHit*u_kick*step(0.3,random);
  float light=magnitude*twinkle*(0.55+u_energy*0.55+u_bass*0.4*inner)
    +kickHit*1.1+shell*2.4+sparkle*1.8+u_phrase*0.45*inner+u_build*0.35*inner+u_drop*0.8*(0.4+0.6*random);
  float flash=clamp(kickHit*0.7+shell*0.5+u_drop*0.4+sparkle*0.5,0.0,1.0);
  vec3 tint=mix(u_secondary,u_primary,random);
  v_color=mix(mix(a_color,tint,0.14),u_accent,flash)*u_intensity;
  float sizePx=u_starSize*(0.65+0.9*random*random)*(1.0+kickHit*0.7+u_drop*0.5+shell*0.9+u_bass*0.2*inner)*u_pixelScale/pow(max(gl_Position.w,0.1),0.7);
  float clamped=clamp(sizePx,1.6,9.0);
  gl_PointSize=clamped;
  // A star smaller than a point is dimmed instead of vanishing, so distant stars shimmer rather than pop.
  // Stars shrink more slowly than perspective says and the far ones glow a little brighter, so the whole galaxy reads from deep space.
  v_alpha=clamp(light,0.0,3.0)*min(1.0,sizePx/1.6)*(1.0+clamp(gl_Position.w/40.0,0.0,1.0)*0.7);
}`

const SPACE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_color;
in float v_alpha;
out vec4 outColor;
void main(){
  vec2 p=gl_PointCoord*2.0-1.0;
  float d=dot(p,p);
  if(d>1.0)discard;
  float soft=exp(-d*3.2);
  float a=soft*v_alpha;
  outColor=vec4(v_color*a,min(a,1.0));
}`

/** World units from the black hole to the radius that holds 99% of the galaxy's stars. */
export const CINEMA2_EVENT_HORIZON_SPACE_RADIUS=30
/** Size of an average star; it shrinks with distance more slowly than perspective, so far stars stay visible. */
const SPACE_STAR_SIZE=0.045
const SPACE_STAR_FLOATS=8
const INSTANCE_FLOATS=12
interface InstanceSet{vao:WebGLVertexArrayObject;buffer:WebGLBuffer;counts:readonly[number,number,number];bytes:number}
interface MeshSet extends InstanceSet{geometryBuffers:readonly WebGLBuffer[];indexCount:number}
export const CINEMA2_EVENT_HORIZON_QUALITY_COUNTS=Object.freeze({
  disk:Object.freeze([1200,2600,5000] as const),
  /** Stars of the supplied galaxy drawn per quality tier (a random sample of its 50,000). */
  star:Object.freeze([12000,28000,50000] as const),
  debris:Object.freeze([64,160,400] as const),
})

export interface Cinema2EventHorizonDrawState{
  viewProjection:readonly number[];cameraPosition:readonly[number,number,number];timeSeconds:number;look:number
  primary:readonly[number,number,number];secondary:readonly[number,number,number];accent:readonly[number,number,number]
  intensity:number;coreRadius:number;diskRadius:number;diskThickness:number;tilt:number;lensing:number;rotation:number
  starDensity:number;debris:number;energy:number;bass:number;kick:number;snare:number;downbeat:number;phrase:number;build:number;drop:number
  /** Pixels per world unit at distance 1 (viewport height / 2 * projection scale), so stars keep a steady size on screen at any resolution. */
  pixelScale:number
  quality:'low'|'medium'|'high'
}

export class Cinema2EventHorizonRenderer{
  private readonly particleProgram:ShaderProgram
  private readonly coreProgram:ShaderProgram
  private readonly meshProgram:ShaderProgram
  private readonly quadBuffer:WebGLBuffer
  private readonly coreVao:WebGLVertexArrayObject
  private readonly coreBuffers:WebGLBuffer[]=[]
  private readonly coreIndexCount:number
  private readonly disk:InstanceSet
  private readonly meshes:Readonly<{debris:MeshSet}>
  private readonly spaceProgram:ShaderProgram
  private space:Readonly<{vao:WebGLVertexArrayObject;buffer:WebGLBuffer;count:number;bytes:number}>|null=null
  private readonly gpuBytes:number
  private disposed=false

  constructor(private readonly gl:WebGL2RenderingContext){
    this.particleProgram=createProgram(gl,'Cinema2/EventHorizon/WorldParticles',PARTICLE_VERTEX_SOURCE,PARTICLE_FRAGMENT_SOURCE,['u_viewProjection','u_cameraPosition','u_time','u_coreRadius','u_diskRadius','u_diskThickness','u_tilt','u_rotation','u_build','u_drop','u_look','u_primary','u_secondary','u_accent','u_intensity','u_energy','u_bass','u_kick','u_snare','u_downbeat','u_phrase','u_activeBand','u_activeSector'])
    this.coreProgram=createProgram(gl,'Cinema2/EventHorizon/DepthCore',CORE_VERTEX_SOURCE,CORE_FRAGMENT_SOURCE,['u_viewProjection','u_radius','u_drop','u_cameraPosition','u_primary','u_accent','u_lensing','u_downbeat'])
    this.meshProgram=createProgram(gl,'Cinema2/EventHorizon/OrbitalMeshes',MESH_VERTEX_SOURCE,MESH_FRAGMENT_SOURCE,['u_viewProjection','u_time','u_rotation','u_tilt','u_drop','u_primary','u_accent','u_snare','u_activeSector'])
    this.spaceProgram=createProgram(gl,'Cinema2/EventHorizon/SpaceField',SPACE_VERTEX_SOURCE,SPACE_FRAGMENT_SOURCE,['u_viewProjection','u_time','u_scale','u_rotation','u_pixelScale','u_starSize','u_intensity','u_tilt','u_energy','u_bass','u_kick','u_snare','u_downbeat','u_phrase','u_build','u_drop','u_activeSector','u_primary','u_secondary','u_accent'])
    const quadBuffer=gl.createBuffer();if(!quadBuffer)throw new Error('Event Horizon could not allocate billboard geometry.');this.quadBuffer=quadBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW)
    const disk=buildDiskInstances(5000),debris=buildDebrisInstances(400)
    this.disk=this.createInstanceSet(disk,CINEMA2_EVENT_HORIZON_QUALITY_COUNTS.disk)
    const octahedron=buildOctahedron();this.meshes=Object.freeze({debris:this.createMeshSet(octahedron,debris,CINEMA2_EVENT_HORIZON_QUALITY_COUNTS.debris)})
    const sphere=buildSphere(48,28),coreVao=gl.createVertexArray(),vertex=gl.createBuffer(),index=gl.createBuffer();if(!coreVao||!vertex||!index)throw new Error('Event Horizon could not allocate core geometry.');this.coreVao=coreVao;this.coreBuffers.push(vertex,index);gl.bindVertexArray(coreVao)
    gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,sphere.vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,sphere.indices,gl.STATIC_DRAW);gl.bindVertexArray(null);this.coreIndexCount=sphere.indices.length
    this.gpuBytes=this.disk.bytes+this.meshes.debris.bytes+sphere.vertices.byteLength+sphere.indices.byteLength+48
    assertCinema2NoGlErrors(gl,'Event Horizon world-space renderer setup')
  }

  estimateGpuBytes():number{return this.gpuBytes+(this.space?.bytes??0)}
  hasSpaceField():boolean{return this.space!==null}
  /** Uploads the galaxy (replacing any earlier one). Until it arrives the black hole draws on its own. */
  setSpaceField(field:Readonly<Cinema2EventHorizonSpaceField>):void{
    if(this.disposed)return
    const {gl}=this,vao=gl.createVertexArray(),buffer=gl.createBuffer();if(!vao||!buffer)throw new Error('Event Horizon could not allocate the galaxy star buffer.')
    const data=new Float32Array(field.count*SPACE_STAR_FLOATS)
    for(let i=0;i<field.count;i+=1){const o=i*SPACE_STAR_FLOATS;data[o]=field.positions[i*3]!;data[o+1]=field.positions[i*3+1]!;data[o+2]=field.positions[i*3+2]!;data[o+3]=field.colors[i*3]!;data[o+4]=field.colors[i*3+1]!;data[o+5]=field.colors[i*3+2]!;data[o+6]=field.random[i]!;data[o+7]=field.radial[i]!}
    gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,32,24)
    gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null)
    this.releaseSpace();this.space=Object.freeze({vao,buffer,count:field.count,bytes:data.byteLength})
    assertCinema2NoGlErrors(gl,'Event Horizon galaxy upload')
  }
  private releaseSpace():void{if(!this.space)return;this.gl.deleteBuffer(this.space.buffer);this.gl.deleteVertexArray(this.space.vao);this.space=null}
  private drawSpace(state:Readonly<Cinema2EventHorizonDrawState>,tier:number):void{
    const space=this.space;if(!space)return
    const count=Math.min(space.count,Math.floor(CINEMA2_EVENT_HORIZON_QUALITY_COUNTS.star[tier]!*state.starDensity));if(count<=0)return
    const p=this.spaceProgram;p.activate();p.setMat4('u_viewProjection',new Float32Array(state.viewProjection));p.setVec3('u_primary',...state.primary);p.setVec3('u_secondary',...state.secondary);p.setVec3('u_accent',...state.accent)
    for(const [name,value] of Object.entries({u_time:state.timeSeconds,u_scale:CINEMA2_EVENT_HORIZON_SPACE_RADIUS,u_rotation:state.rotation,u_pixelScale:state.pixelScale,u_starSize:SPACE_STAR_SIZE,u_intensity:state.intensity,u_tilt:state.tilt,u_energy:state.energy,u_bass:state.bass,u_kick:state.kick,u_snare:state.snare,u_downbeat:state.downbeat,u_phrase:state.phrase,u_build:state.build,u_drop:state.drop,u_activeSector:Math.floor(state.timeSeconds*.22+state.phrase*4)%12}))p.setFloat(name,value)
    this.gl.bindVertexArray(space.vao);this.gl.drawArrays(this.gl.POINTS,0,count);this.gl.bindVertexArray(null)
  }
  draw(state:Readonly<Cinema2EventHorizonDrawState>):void{
    if(this.disposed)return
    const {gl}=this,tier=state.quality==='low'?0:state.quality==='medium'?1:2
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK)
    const core=this.coreProgram;core.activate();core.setMat4('u_viewProjection',new Float32Array(state.viewProjection));core.setFloat('u_radius',state.coreRadius);core.setFloat('u_drop',state.drop);core.setVec3('u_cameraPosition',...state.cameraPosition);core.setVec3('u_primary',...state.primary);core.setVec3('u_accent',...state.accent);core.setFloat('u_lensing',state.lensing);core.setFloat('u_downbeat',state.downbeat)
    gl.bindVertexArray(this.coreVao);gl.drawElements(gl.TRIANGLES,this.coreIndexCount,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null)
    this.bindMeshUniforms(state);this.drawMeshSet(this.meshes.debris,Math.floor(this.meshes.debris.counts[tier]*state.debris))
    gl.disable(gl.CULL_FACE);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);this.drawSpace(state,tier);this.bindParticleUniforms(state);this.drawSet(this.disk,this.disk.counts[tier])
    gl.disable(gl.BLEND);gl.depthMask(true);assertCinema2NoGlErrors(gl,'Event Horizon world-space draw')
  }
  dispose():void{if(this.disposed)return;this.disposed=true;this.particleProgram.dispose();this.coreProgram.dispose();this.meshProgram.dispose();this.spaceProgram.dispose();this.releaseSpace();this.gl.deleteBuffer(this.quadBuffer);this.gl.deleteBuffer(this.disk.buffer);this.gl.deleteVertexArray(this.disk.vao);for(const set of Object.values(this.meshes)){this.gl.deleteBuffer(set.buffer);for(const buffer of set.geometryBuffers)this.gl.deleteBuffer(buffer);this.gl.deleteVertexArray(set.vao)}for(const buffer of this.coreBuffers)this.gl.deleteBuffer(buffer);this.gl.deleteVertexArray(this.coreVao)}

  private createInstanceSet(data:Float32Array,counts:readonly[number,number,number]):InstanceSet{const {gl}=this,vao=gl.createVertexArray(),buffer=gl.createBuffer();if(!vao||!buffer)throw new Error('Event Horizon could not allocate an instanced particle set.');gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);const stride=INSTANCE_FLOATS*4;for(let attribute=0;attribute<3;attribute+=1){gl.enableVertexAttribArray(1+attribute);gl.vertexAttribPointer(1+attribute,4,gl.FLOAT,false,stride,attribute*16);gl.vertexAttribDivisor(1+attribute,1)}gl.bindVertexArray(null);return{vao,buffer,counts,bytes:data.byteLength}}
  private createMeshSet(geometry:Readonly<{vertices:Float32Array;indices:Uint16Array}>,instances:Float32Array,counts:readonly[number,number,number]):MeshSet{const {gl}=this,vao=gl.createVertexArray(),vertex=gl.createBuffer(),index=gl.createBuffer(),buffer=gl.createBuffer();if(!vao||!vertex||!index||!buffer)throw new Error('Event Horizon could not allocate instanced orbital geometry.');gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geometry.indices,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,instances,gl.STATIC_DRAW);const stride=INSTANCE_FLOATS*4;for(let attribute=0;attribute<3;attribute+=1){gl.enableVertexAttribArray(2+attribute);gl.vertexAttribPointer(2+attribute,4,gl.FLOAT,false,stride,attribute*16);gl.vertexAttribDivisor(2+attribute,1)}gl.bindVertexArray(null);return{vao,buffer,counts,geometryBuffers:Object.freeze([vertex,index]),indexCount:geometry.indices.length,bytes:instances.byteLength+geometry.vertices.byteLength+geometry.indices.byteLength}}
  private bindParticleUniforms(state:Readonly<Cinema2EventHorizonDrawState>):void{const p=this.particleProgram;p.activate();p.setMat4('u_viewProjection',new Float32Array(state.viewProjection));p.setVec3('u_cameraPosition',...state.cameraPosition);p.setInt('u_look',state.look);p.setVec3('u_primary',...state.primary);p.setVec3('u_secondary',...state.secondary);p.setVec3('u_accent',...state.accent);for(const [name,value] of Object.entries({u_time:state.timeSeconds,u_coreRadius:state.coreRadius,u_diskRadius:state.diskRadius,u_diskThickness:state.diskThickness,u_tilt:state.tilt,u_rotation:state.rotation,u_build:state.build,u_drop:state.drop,u_intensity:state.intensity,u_energy:state.energy,u_bass:state.bass,u_kick:state.kick,u_snare:state.snare,u_downbeat:state.downbeat,u_phrase:state.phrase,u_activeBand:Math.floor(state.timeSeconds*.35+state.downbeat*2)%6,u_activeSector:Math.floor(state.timeSeconds*.22+state.phrase*4)%12}))p.setFloat(name,value)}
  private bindMeshUniforms(state:Readonly<Cinema2EventHorizonDrawState>):void{const p=this.meshProgram;p.activate();p.setMat4('u_viewProjection',new Float32Array(state.viewProjection));p.setVec3('u_primary',...state.primary);p.setVec3('u_accent',...state.accent);for(const [name,value] of Object.entries({u_time:state.timeSeconds,u_rotation:state.rotation,u_tilt:state.tilt,u_drop:state.drop,u_snare:state.snare,u_activeSector:Math.floor(state.timeSeconds*.22+state.phrase*4)%12}))p.setFloat(name,value)}
  private drawSet(set:InstanceSet,count:number):void{this.gl.bindVertexArray(set.vao);this.gl.drawArraysInstanced(this.gl.TRIANGLES,0,6,Math.max(0,count));this.gl.bindVertexArray(null)}
  private drawMeshSet(set:MeshSet,count:number):void{this.gl.bindVertexArray(set.vao);this.gl.drawElementsInstanced(this.gl.TRIANGLES,set.indexCount,this.gl.UNSIGNED_SHORT,0,Math.max(0,count));this.gl.bindVertexArray(null)}
}

function createProgram(gl:WebGL2RenderingContext,label:string,vertSrc:string,fragSrc:string,requiredUniforms:string[]):ShaderProgram{const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label,vertSrc,fragSrc,requiredUniforms});if(!result.program)throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`);return result.program}
function seeded(index:number,salt:number):number{return fract(Math.sin(index*127.1+salt*311.7)*43758.5453)}
function fract(value:number):number{return value-Math.floor(value)}
function pushInstance(values:number[],position:readonly[number,number,number],size:number,kind:number,band:number,sector:number,random:number,phase:number,orbit:number,height:number,layer:number):void{values.push(position[0],position[1],position[2],size,kind,band,sector,random,phase,orbit,height,layer)}
function buildDiskInstances(count:number):Float32Array{const values:number[]=[];for(let i=0;i<count;i+=1){const random=seeded(i,1),band=i%6,sector=Math.floor(i/6)%12,layer=Math.floor(i/72)%5,radial=(band+seeded(i,2)) / 6,phase=(sector+seeded(i,3)*.96)/12*Math.PI*2,height=(seeded(i,4)-.5)*2*(.72+layer*.12);pushInstance(values,[0,0,0],.014+seeded(i,5)*.032,0,band,sector,random,phase,height,layer/4,radial)}return new Float32Array(values)}
function buildDebrisInstances(count:number):Float32Array{const values:number[]=[];for(let i=0;i<count;i+=1){const radius=2.8+seeded(i,21)*1.2,phase=seeded(i,22)*Math.PI*2,heightSample=seeded(i,23),height=(heightSample<.5?-1:1)*(.45+Math.abs(heightSample-.5)*1.6);pushInstance(values,[0,0,0],.009+seeded(i,24)*.025,2,i%6,i%12,seeded(i,25),phase,radius,height,seeded(i,26))}return new Float32Array(values)}
function buildOctahedron():{vertices:Float32Array;indices:Uint16Array}{const positions=[[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1,0]] as const,faces=[[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]] as const,vertices:number[]=[],indices:number[]=[];for(const face of faces){const base=vertices.length/6;for(const index of face){const p=positions[index];vertices.push(p[0],p[1],p[2],p[0],p[1],p[2])}indices.push(base,base+1,base+2)}return{vertices:new Float32Array(vertices),indices:new Uint16Array(indices)}}
function buildSphere(longitude:number,latitude:number):{vertices:Float32Array;indices:Uint16Array}{const vertices:number[]=[],indices:number[]=[];for(let y=0;y<=latitude;y+=1){const v=y/latitude,theta=v*Math.PI;for(let x=0;x<=longitude;x+=1){const u=x/longitude,phi=u*Math.PI*2,nx=Math.sin(theta)*Math.cos(phi),ny=Math.cos(theta),nz=Math.sin(theta)*Math.sin(phi);vertices.push(nx,ny,nz,nx,ny,nz)}}for(let y=0;y<latitude;y+=1)for(let x=0;x<longitude;x+=1){const a=y*(longitude+1)+x,b=a+longitude+1;indices.push(a,a+1,b,b,a+1,b+1)}return{vertices:new Float32Array(vertices),indices:new Uint16Array(indices)}}
