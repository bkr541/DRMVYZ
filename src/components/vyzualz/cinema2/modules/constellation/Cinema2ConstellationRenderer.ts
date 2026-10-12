import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'

const INSTANCE_FLOATS=4
export const CINEMA2_CONSTELLATION_QUALITY_COUNTS=Object.freeze({
  nodes:Object.freeze([32,96,176] as const),stars:Object.freeze([80,320,900] as const),
})

const POSITION_GLSL=`
vec3 topologyPosition(float rawId,vec3 seed){
  float count=max(u_activeNodes,1.0),id=mod(rawId,count),t=id/max(count-1.0,1.0),tau=6.28318530718;
  float a=t*tau,ring=mod(id,3.0),branch=mod(id,6.0),stepId=floor(id/6.0);
  vec3 p=vec3(0);
  if(u_look==0){float z=seed.x*2.0-1.0,az=seed.y*tau,r=sqrt(max(0.0,1.0-z*z));p=vec3(cos(az)*r,z,sin(az)*r)*(0.32+1.35*t);}
  else if(u_look==1){float ba=branch/6.0*tau,reach=.22+stepId/max(1.0,floor(count/6.0))*1.45;p=vec3(cos(ba)*reach,(seed.x-.5)*.46+sin(reach*3.0)*.22,sin(ba)*reach*.72);}
  else if(u_look==2){float cluster=mod(id,4.0),ca=cluster/4.0*tau;p=vec3(cos(ca)*.92+(seed.x-.5)*.34,(seed.y-.5)*1.55,sin(ca)*.92+(seed.z-.5)*.34);}
  else if(u_look==3){float side=mod(id,2.0)<1.0?-1.0:1.0;p=vec3(side*(.72+seed.x*.78),(seed.y-.5)*1.55,(seed.z-.5)*1.15+side*.22*sin(a*3.0));}
  else if(u_look==4){p=vec3(cos(a)*1.42,sin(a*2.0)*.16,sin(a)*1.42);}
  else if(u_look==5){float x=mod(id,4.0),y=mod(floor(id/4.0),4.0),z=floor(id/16.0);p=vec3(x-1.5,y-1.5,z-max(1.0,floor(count/16.0))*.5)*.72;}
  else if(u_look==6){float petals=5.0,radial=.22+1.35*t,wave=.3*sin(a*petals+u_phrase*tau);p=vec3(cos(a)*(radial+wave),sin(a*2.0+seed.x)*.58,sin(a)*(radial-wave));}
  else if(u_look==7){p=vec3((t-.5)*2.7,sin(a*1.5)*.32,cos(a*1.5)*.42);}
  else if(u_look==8){float z=seed.x*2.0-1.0,az=seed.y*tau,r=sqrt(max(0.0,1.0-z*z));p=vec3(cos(az)*r,z,sin(az)*r)*(.48+seed.z*.92);}
  else if(u_look==9){float turns=3.2;p=vec3(cos(t*tau*turns)*.86,(t-.5)*2.7,sin(t*tau*turns)*.86);}
  else if(u_look==10){float z=seed.x*2.0-1.0,az=seed.y*tau,r=sqrt(max(0.0,1.0-z*z));p=vec3(cos(az)*r,z,sin(az)*r)*(.38+1.45*pow(t,.72));}
  else{if(id<.5)p=vec3(0);else{float orbit=mod(id-1.0,3.0),local=floor((id-1.0)/3.0),oa=local/max(1.0,floor((count-1.0)/3.0))*tau+orbit*1.1;p=vec3(cos(oa)*(1.0+orbit*.38),(orbit-1.0)*.34,sin(oa)*(1.0+orbit*.38));}}
  p.x*=u_spread;p.y*=mix(.72,1.25,u_depthSpread);p.z*=u_depthSpread;
  p*=1.0-u_collapse*.78;p+=normalize(p+vec3(.0001))*u_burst*(.42+seed.x*.72);
  float turn=u_time*u_spin*(.055+float(u_look==4||u_look==11)*.04)+u_phrase*.32;
  float c=cos(turn),s=sin(turn);p.xz=mat2(c,-s,s,c)*p.xz;
  p+=vec3(sin(u_time*.21+seed.x*9.0),cos(u_time*.17+seed.y*8.0),sin(u_time*.13+seed.z*7.0))*u_drift*.09;
  return p;
}`

const NODE_VERT=`#version 300 es
precision highp float;precision highp int;
layout(location=0) in vec3 a_position;layout(location=1) in vec3 a_normal;layout(location=2) in vec4 i_idSeed;
uniform mat4 u_viewProjection;uniform float u_time;uniform int u_look;uniform float u_activeNodes;uniform float u_spread;uniform float u_depthSpread;uniform float u_nodeScale;uniform float u_scaleVariation;uniform float u_spin;uniform float u_drift;uniform float u_collapse;uniform float u_burst;uniform float u_phrase;uniform float u_bass;uniform float u_kick;uniform int u_starMode;
out vec3 v_world;out vec3 v_normal;flat out float v_random;flat out float v_group;flat out float v_star;
${POSITION_GLSL}
void main(){
  vec3 center;
  if(u_starMode==1){float z=i_idSeed.y*2.0-1.0,a=i_idSeed.z*6.2831853,r=7.0+i_idSeed.w*24.0,flatRadius=sqrt(max(0.0,1.0-z*z));center=vec3(cos(a)*flatRadius*r,z*r,sin(a)*flatRadius*r);}
  else center=topologyPosition(i_idSeed.x,i_idSeed.yzw);
  float pulse=1.0+u_bass*.18+u_kick*.24;float variation=mix(1.0-u_scaleVariation*.42,1.0+u_scaleVariation*.52,i_idSeed.y);
  float scale=u_starMode==1?(.012+i_idSeed.y*.032):u_nodeScale*variation*pulse;
  float spin=u_time*u_spin*(.32+i_idSeed.z*.55)+i_idSeed.y*6.2831853;float c=cos(spin),s=sin(spin);mat3 rotation=mat3(c,-s,0,s,c,0,0,0,1);
  vec3 local=rotation*(a_position*scale);v_world=center+local;v_normal=rotation*a_normal;v_random=i_idSeed.y;v_group=mod(i_idSeed.x,8.0);v_star=float(u_starMode);gl_Position=u_viewProjection*vec4(v_world,1);
}`

const NODE_FRAG=`#version 300 es
precision highp float;precision highp int;
in vec3 v_world;in vec3 v_normal;flat in float v_random;flat in float v_group;flat in float v_star;
uniform vec3 u_cameraPosition;uniform vec3 u_primary;uniform vec3 u_secondary;uniform vec3 u_accent;uniform vec3 u_highlight;uniform float u_intensity;uniform float u_internalGlow;uniform float u_edgeGlow;uniform float u_energy;uniform float u_highs;uniform float u_snare;uniform float u_drop;uniform float u_activeGroup;
out vec4 outColor;
void main(){vec3 n=normalize(v_normal),view=normalize(u_cameraPosition-v_world);float diffuse=max(dot(n,normalize(vec3(-.38,.72,.58))),0.0),rim=pow(1.0-max(dot(n,view),0.0),2.7);if(v_star>.5){float twinkle=.68+.32*sin(v_random*43.0+u_energy*2.0);outColor=vec4(mix(u_secondary,u_highlight,v_random)*(1.1+u_highs*.8)*twinkle,1);return;}float groupHit=1.0-step(.45,abs(v_group-u_activeGroup));vec3 base=mix(u_primary,u_secondary,v_random);base=mix(base,u_accent,groupHit*(.22+u_snare*.48));float light=.14+diffuse*.72+rim*u_edgeGlow;vec3 emission=base*(u_internalGlow*(.16+u_energy*.28+u_drop*.5)+groupHit*.22)+u_highlight*rim*.12;outColor=vec4((base*light+emission)*u_intensity,1);}`

interface MeshSet{vao:WebGLVertexArrayObject;buffers:readonly WebGLBuffer[];indexCount:number;counts:readonly[number,number,number];bytes:number}
export interface Cinema2ConstellationDrawState{viewProjection:readonly number[];cameraPosition:readonly[number,number,number];timeSeconds:number;look:number;primary:readonly[number,number,number];secondary:readonly[number,number,number];accent:readonly[number,number,number];highlight:readonly[number,number,number];intensity:number;nodeDensity:number;spread:number;depthSpread:number;nodeScale:number;scaleVariation:number;spin:number;drift:number;collapse:number;burst:number;internalGlow:number;edgeGlow:number;starDensity:number;energy:number;bass:number;kick:number;snare:number;highs:number;downbeat:number;phrase:number;drop:number;quality:'low'|'medium'|'high'}

export class Cinema2ConstellationRenderer{
  private readonly nodeProgram:ShaderProgram;private readonly nodeSets:readonly MeshSet[];private readonly starSet:MeshSet;private readonly gpuBytes:number;private disposed=false
  constructor(private readonly gl:WebGL2RenderingContext){this.nodeProgram=createProgram(gl,'Cinema2/Constellation/Nodes',NODE_VERT,NODE_FRAG,['u_viewProjection','u_cameraPosition','u_time','u_look','u_activeNodes','u_spread','u_depthSpread','u_nodeScale','u_scaleVariation','u_spin','u_drift','u_collapse','u_burst','u_phrase','u_bass','u_kick','u_starMode','u_primary','u_secondary','u_accent','u_highlight','u_intensity','u_internalGlow','u_edgeGlow','u_energy','u_highs','u_snare','u_drop','u_activeGroup'])
    const nodes=buildInstances(176,7001),stars=buildInstances(900,9001),geometries=[buildTetrahedron(),buildOctahedron(),buildIcosahedron()];this.nodeSets=Object.freeze(geometries.map(geometry=>this.createSet(geometry,nodes,CINEMA2_CONSTELLATION_QUALITY_COUNTS.nodes)));this.starSet=this.createSet(geometries[0]!,stars,CINEMA2_CONSTELLATION_QUALITY_COUNTS.stars);this.gpuBytes=[...this.nodeSets,this.starSet].reduce((sum,set)=>sum+set.bytes,0);assertCinema2NoGlErrors(gl,'Constellation renderer setup')}
  estimateGpuBytes():number{return this.gpuBytes}
  draw(state:Readonly<Cinema2ConstellationDrawState>):void{if(this.disposed)return;const {gl}=this,tier=state.quality==='low'?0:state.quality==='medium'?1:2,nodeCount=Math.max(8,Math.floor(this.nodeSets[0]!.counts[tier]*state.nodeDensity)),activeGroup=Math.floor(state.timeSeconds*.35+state.phrase*5+state.downbeat*2)%8;gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.depthMask(true);this.bindNodes(state,nodeCount,activeGroup,1);this.drawSet(this.starSet,Math.floor(this.starSet.counts[tier]*state.starDensity));this.bindNodes(state,nodeCount,activeGroup,0);this.drawSet(this.nodeSets[meshForLook(state.look)],nodeCount);gl.disable(gl.CULL_FACE);assertCinema2NoGlErrors(gl,'Constellation world draw')}
  dispose():void{if(this.disposed)return;this.disposed=true;this.nodeProgram.dispose();for(const set of [...this.nodeSets,this.starSet]){for(const buffer of set.buffers)this.gl.deleteBuffer(buffer);this.gl.deleteVertexArray(set.vao)}}
  private bindShared(program:ShaderProgram,state:Readonly<Cinema2ConstellationDrawState>,nodeCount:number,activeGroup:number):void{program.setMat4('u_viewProjection',new Float32Array(state.viewProjection));program.setInt('u_look',state.look);program.setVec3('u_primary',...state.primary);program.setVec3('u_secondary',...state.secondary);program.setVec3('u_accent',...state.accent);for(const [name,value] of Object.entries({u_time:state.timeSeconds,u_activeNodes:nodeCount,u_spread:state.spread,u_depthSpread:state.depthSpread,u_spin:state.spin,u_drift:state.drift,u_collapse:state.collapse,u_burst:state.burst,u_phrase:state.phrase,u_energy:state.energy,u_kick:state.kick,u_intensity:state.intensity,u_edgeGlow:state.edgeGlow,u_activeGroup:activeGroup}))program.setFloat(name,value)}
  private bindNodes(state:Readonly<Cinema2ConstellationDrawState>,nodeCount:number,activeGroup:number,starMode:number):void{const p=this.nodeProgram;p.activate();this.bindShared(p,state,nodeCount,activeGroup);p.setVec3('u_cameraPosition',...state.cameraPosition);p.setVec3('u_highlight',...state.highlight);p.setInt('u_starMode',starMode);for(const [name,value] of Object.entries({u_nodeScale:state.nodeScale,u_scaleVariation:state.scaleVariation,u_bass:state.bass,u_internalGlow:state.internalGlow,u_highs:state.highs,u_snare:state.snare,u_drop:state.drop}))p.setFloat(name,value)}
  private drawSet(set:MeshSet,count:number):void{this.gl.bindVertexArray(set.vao);this.gl.drawElementsInstanced(this.gl.TRIANGLES,set.indexCount,this.gl.UNSIGNED_SHORT,0,count);this.gl.bindVertexArray(null)}
  private createSet(geometry:Readonly<{vertices:Float32Array;indices:Uint16Array}>,instances:Float32Array,counts:readonly[number,number,number]):MeshSet{const {gl}=this,vao=gl.createVertexArray(),vertex=gl.createBuffer(),index=gl.createBuffer(),instance=gl.createBuffer();if(!vao||!vertex||!index||!instance)throw new Error('Constellation could not allocate instanced geometry.');gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,geometry.vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,geometry.indices,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,instance);gl.bufferData(gl.ARRAY_BUFFER,instances,gl.STATIC_DRAW);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,INSTANCE_FLOATS*4,0);gl.vertexAttribDivisor(2,1);gl.bindVertexArray(null);return{vao,buffers:Object.freeze([vertex,index,instance]),indexCount:geometry.indices.length,counts,bytes:geometry.vertices.byteLength+geometry.indices.byteLength+instances.byteLength}}
}

function createProgram(gl:WebGL2RenderingContext,label:string,vertSrc:string,fragSrc:string,requiredUniforms:string[]):ShaderProgram{const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label,vertSrc,fragSrc,requiredUniforms});if(!result.program)throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`);return result.program}
function meshForLook(look:number):number{return look===3||look===7?0:look===0||look===2||look===6||look===9?2:1}
function seeded(index:number,salt:number):number{const value=Math.sin(index*127.1+salt*311.7)*43758.5453;return value-Math.floor(value)}
function buildInstances(count:number,salt:number):Float32Array{const values:number[]=[];for(let i=0;i<count;i+=1)values.push(i,seeded(i,salt),seeded(i,salt+1),seeded(i,salt+2));return new Float32Array(values)}
function geometryFromFaces(positions:readonly(readonly[number,number,number])[],faces:readonly(readonly number[])[]):{vertices:Float32Array;indices:Uint16Array}{const vertices:number[]=[],indices:number[]=[];for(const face of faces){const a=positions[face[0]!]!,b=positions[face[1]!]!,c=positions[face[2]!]!,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz)||1,base=vertices.length/6;for(const vertexIndex of face){const p=positions[vertexIndex]!;vertices.push(p[0],p[1],p[2],nx/length,ny/length,nz/length)}for(let i=1;i<face.length-1;i+=1)indices.push(base,base+i,base+i+1)}return{vertices:new Float32Array(vertices),indices:new Uint16Array(indices)}}
function buildTetrahedron(){return geometryFromFaces([[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]],[[0,2,1],[0,1,3],[0,3,2],[1,2,3]])}
function buildOctahedron(){return geometryFromFaces([[0,1,0],[1,0,0],[0,0,1],[-1,0,0],[0,0,-1],[0,-1,0]],[[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]])}
function buildIcosahedron(){const p=(1+Math.sqrt(5))/2,v=[[-1,p,0],[1,p,0],[-1,-p,0],[1,-p,0],[0,-1,p],[0,1,p],[0,-1,-p],[0,1,-p],[p,0,-1],[p,0,1],[-p,0,-1],[-p,0,1]] as const,f=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]] as const;return geometryFromFaces(v.map(([x,y,z])=>[x/p,y/p,z/p] as const),f)}
