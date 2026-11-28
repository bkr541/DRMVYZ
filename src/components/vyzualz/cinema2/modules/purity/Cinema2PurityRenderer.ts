import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { PURITY_EDGES, PURITY_FLOOR, PURITY_JUNCTION, PURITY_ROUTE, purityHalfWidth, purityWorld, purityRouteAddress } from './Cinema2PurityMaze'
import { purityArchitecture, purityBars } from './Cinema2PurityArchitecture'
import { PURITY_PATTERNS, type PurityPattern } from './Cinema2PurityPatterns'

export const PURITY_MAX_INSTANCES = 2048
export const PURITY_INSTANCE_STRIDE = 20
const STRIDE = PURITY_INSTANCE_STRIDE
const clamp = (v:number,a=0,b=1) => Math.max(a,Math.min(b,v))
export interface PurityVisualState {
  number(name:string):number; enabled(name:string):boolean;
  pattern:PurityPattern; previous:PurityPattern; transition:number;
  travel:number; chase:number; wave:number;
  segments:number; motion:number; flash:number; silence:number;
  cameraPosition?:readonly [number,number,number]; layout?:string;
}
/** Stationary world-space architecture, instanced by the original PURITY renderer. */
export class PurityGeometry {
  readonly data = new Float32Array(PURITY_MAX_INSTANCES*STRIDE)
  count=0
  farFadeEnd=66; farFadeStart=48
  pattern=0; previous=0; transition=1; chase=0; density=.65; contrast=.8; blackout=.75
  routePosition=0; localization=.75
  private box(x:number,y:number,z:number,angle:number,w:number,h:number,d:number,role:number,light:number,spill:number,detail=0,group=0,yaw=0) {
    if(this.count>=PURITY_MAX_INSTANCES) throw new Error('PURITY instance budget exceeded')
    const i=this.count++*STRIDE
    this.data.set([x,y,z,angle,Math.max(.001,w),Math.max(.001,h),Math.max(.001,d),role,light,spill,detail,group,yaw,0,0,0,0,0,0,0],i)
  }
  /** Each opaque surface samples its nearest local emitter, not a global ambient wash. */
  private bindSpill(start:number,end:number){
    const d=this.data
    for(let i=start;i<end;i++){
      const p=i*STRIDE;if(d[p+7]!>=2)continue
      let best=Infinity, chosen=-1
      for(let j=start;j<end;j++){
        const q=j*STRIDE;if(d[q+7]!<2||d[q+8]!<=0)continue
        const dist=(d[p]!-d[q]!)**2+(d[p+1]!-d[q+1]!)**2+(d[p+2]!-d[q+2]!)**2
        if(dist<best){best=dist;chosen=q}
      }
      if(chosen<0)continue
      d[p+13]=d[chosen]!;d[p+14]=d[chosen+1]!;d[p+15]=d[chosen+2]!
      d[p+16]=d[chosen+8]!;d[p+17]=d[chosen+11]!;d[p+18]=d[chosen+10]!;d[p+19]=Math.max(d[chosen+4]!,d[chosen+5]!,d[chosen+6]!)*.5
    }
  }
  update(s:PurityVisualState) {
    this.count=0
    const n=s.number,W=clamp(n('tunnelWidth'),2.8,5.5),spacing=3.5*clamp(n('tunnelDepth'),.75,1.5),thick=clamp(n('frameThickness'),.08,.32),detail=n('structuralDetail')
    this.pattern=PURITY_PATTERNS.indexOf(s.pattern);this.previous=PURITY_PATTERNS.indexOf(s.previous)
    const t=clamp(s.transition);this.transition=t*t*(3-2*t);this.chase=s.chase;this.density=n('fixtureDensity');this.contrast=n('lightingContrast');this.blackout=n('blackoutDepth');this.localization=clamp(n('lightLocalization'))
    const camera=s.cameraPosition??PURITY_ROUTE[0]!.position
    this.routePosition=purityRouteAddress(camera[0],camera[2])*16
    const base=n('intensity')*(1-.94*s.silence),rail=s.enabled('perimeterLighting')?n('perimeterIntensity'):0,face=s.enabled('recessedFixtures')?n('fixtureIntensity'):0
    const hit=n('dropAccent')*n('dropStrength'),bass=n('bassPressure'),energy=n('overallEnergy'),floor=PURITY_FLOOR
    const halo=base*(.76+.2*energy+.15*n('subAmount')),spill=n('lightSpill')*(.7+.2*bass+.2*n('midAmount'))
    const detailTier=s.segments>=16
    // Every edge connects two fixed square junction rooms. Walls have actual
    // openings at turns, so the camera never passes through a solid barrier.
    for(let e=0;e<PURITY_EDGES.length;e++){
      const edge=PURITY_EDGES[e]!, half=purityHalfWidth(W,edge.zone), height=edge.zone==='cathedral'?8.8:5.6, roof=floor+height
      const begin=PURITY_JUNCTION,end=edge.length-PURITY_JUNCTION,len=end-begin
      const bays=Math.max(1,Math.ceil(len/(spacing*(edge.zone==='obsidian'?1.6:1))))
      const cell=len/bays
      const worldBox=(x:number,y:number,z:number,roll:number,w:number,h:number,d:number,role:number,gain:number,group:number,phase=detail,yaw=edge.yaw)=>{
        const p=purityWorld(edge,x,y,z);this.box(...p,roll,w,h,d,role,gain,spill,phase,group,yaw)
      }
      for(let j=0;j<bays;j++){
        const mid=begin+(j+.5)*cell
        const center=purityWorld(edge,0,floor+height*.5,mid)
        if(Math.hypot(center[0]-camera[0],center[1]-camera[1],center[2]-camera[2])>this.farFadeEnd+Math.hypot(half+.6,height*.5+.6,cell*.5+.6))continue
        const start=this.count,group=e*16+(mid/edge.length)*16,phase=group*.43+s.chase
        for(const side of [-1,1]){
          worldBox(side*(half+.12),floor+height*.5,mid,0,.24,height,cell+.003,1,0,group)
          if(detailTier){worldBox(side*(half-.045),floor+height*.5,mid-cell*.5+.05,0,.12,height,.16,0,0,group);worldBox(side*(half-.055),floor+.45,mid,0,.10,.10,cell*.94,0,0,group)}
        }
        worldBox(0,roof+.12,mid,0,half*2+.24,.24,cell+.003,1,0,group)
        if(detailTier)worldBox(0,roof-.06,mid-cell*.5+.07,0,half*2,.15,.19,0,0,group)
        const variant=purityArchitecture(edge.zone,s.layout??'mixed',e)
        const bars=purityBars(variant,j)
        for(let b=0;b<bars.length;b++){
          const [ax,ay,bx,by,depth]=bars[b]!,x1=ax*half,x2=bx*half,y1=floor+ay*height,y2=floor+by*height
          const w=Math.hypot(x2-x1,y2-y1),rot=Math.atan2(y2-y1,x2-x1),x=(x1+x2)*.5,y=(y1+y2)*.5
          const g=group+(b%3)*.17,accent=s.flash*(.20*n('kickAccent')+.14*n('beatAccent')+.20*n('snareAccent')*(b%2)+.36*hit)
          const gain=halo*(.82+.13*n('lowMidAmount')+.12*n('highsAmount')+.08*n('airAmount')+.1*n('fluxAmount')+.13*n('buildAmount')+.1*n('directorIntensity')-.12*n('vocalPresence')+accent)
          const width=thick*(variant==='threshold'?2.15:1.15),d=depth?Math.min(depth,cell*.65):thick*2.0
          const role=b%3===1?4:3
          worldBox(x,y,mid,rot,w,width,d,0,0,g)
          // Light both faces so the installation reads from either direction.
          if(face>0)worldBox(x,y,mid,rot,w*.97,width*.65,d+.035,role,gain*face,g,phase+n('variation')*.18+n('sectionAccent')*.16)
          if(rail>0)worldBox(x-Math.sin(rot)*width*.46,y+Math.cos(rot)*width*.46,mid,rot,w*.98,Math.max(.018,thick*.17),d+.055,2,halo*rail*(.75+accent+.13*n('phraseAccent')+.1*n('downbeatAccent')+.1*n('directorImpact')),g,phase)
        }
        // Longitudinal wall accents create parallax and guide the next turn.
        if(rail>0&&variant!=='obsidian')for(const side of [-1,1])worldBox(side*(half-.15),floor+.28,mid,0,.045,.045,cell*.78,4,halo*rail*(.46+.14*n('depthWave')*Math.sin(s.wave+group)),group,phase)
        this.bindSpill(start,this.count)
      }
      // Junction walls: leave each connected corridor mouth open, close the
      // other two sides, and fill the shoulders of each opening.
      const start=this.count, incoming=PURITY_EDGES[(e+PURITY_EDGES.length-1)%PURITY_EDGES.length]!, J=PURITY_JUNCTION
      const junctionHeight=Math.max(height,incoming.zone==='cathedral'?8.8:5.6),junctionRoof=floor+junctionHeight
      const cornerBox=(x:number,y:number,z:number,w:number,h:number,d:number,role:number,gain:number,group:number,yaw=0)=>this.box(edge.x+x,y,edge.z+z,0,w,h,d,role,gain,spill,detail,group,yaw)
      const group=e*16-1
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
        const mouth=dx===edge.dx&&dz===edge.dz?half:dx===-incoming.dx&&dz===-incoming.dz?purityHalfWidth(W,incoming.zone):0
        const yaw=Math.atan2(-dx,-dz), lateral=[-dz,dx] as const
        const panel=(offset:number,width:number,h:number,y:number)=>cornerBox(dx*J+lateral[0]*offset,y,dz*J+lateral[1]*offset,width,h,.24,1,0,group,yaw)
        if(mouth===0)panel(0,J*2,junctionHeight,floor+junctionHeight*.5)
        else for(const sign of [-1,1])panel(sign*(J+mouth)*.5,J-mouth,junctionHeight,floor+junctionHeight*.5)
        const openingHeight=dx===edge.dx&&dz===edge.dz?height:incoming.zone==='cathedral'?8.8:5.6
        if(mouth>0&&junctionHeight>openingHeight)panel(0,mouth*2,junctionHeight-openingHeight,floor+(junctionHeight+openingHeight)*.5)
        if(rail>0){
          // Narrow strips along the junction wall, framing rather than blocking the exit.
          const at=mouth>0?mouth+.12:J*.60
          for(const sign of [-1,1])cornerBox(dx*(J-.16)+lateral[0]*sign*at,floor+junctionHeight*.5,dz*(J-.16)+lateral[1]*sign*at,.055,junctionHeight*.89,.055,4,halo*rail*.83,group,yaw)
        }
      }
      cornerBox(0,junctionRoof+.12,0,J*2,.24,J*2,1,0,group)
      if(rail>0)for(const side of [-1,1])cornerBox(side*J*.56,junctionRoof-.10,0,.085,.085,J*1.7,2,halo*rail*.9,group)
      this.bindSpill(start,this.count)
    }
  }
}
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec2 a_uv;
layout(location=3) in vec4 i_pose;
layout(location=4) in vec4 i_size;
layout(location=5) in vec4 i_light;
layout(location=6) in vec4 i_orientation;
layout(location=7) in vec4 i_spill;
uniform mat4 u_viewProjection;
out vec3 v_world; out vec3 v_normal; out vec2 v_uv; flat out vec4 v_light; flat out float v_role; flat out vec4 v_spill; flat out vec3 v_source;
vec3 yawRotate(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
void main(){float c=cos(i_pose.w),s=sin(i_pose.w);mat2 r=mat2(c,s,-s,c);vec3 local=a_position*i_size.xyz;v_world=i_pose.xyz+yawRotate(vec3(r*local.xy,local.z),i_orientation.x);v_normal=yawRotate(vec3(r*a_normal.xy,a_normal.z),i_orientation.x);v_uv=a_uv;v_light=i_light;v_role=i_size.w;v_spill=i_spill;v_source=i_orientation.yzw;gl_Position=u_viewProjection*vec4(v_world,1.0);}`
const FRAG=`#version 300 es
precision highp float;
in vec3 v_world; in vec3 v_normal; in vec2 v_uv; flat in vec4 v_light; flat in float v_role; flat in vec4 v_spill; flat in vec3 v_source;
uniform vec3 u_cameraPosition,u_metal,u_panel,u_perimeter,u_geometry,u_accent,u_background;
uniform float u_farFadeStart,u_farFadeEnd;
uniform float u_roughness,u_reflections,u_falloff,u_visibility;
uniform float u_pattern,u_previous,u_transition,u_chase,u_density,u_contrast,u_blackout,u_routePosition,u_localization;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float stripe(float x,float duty){float aa=clamp(fwidth(x)*.5,.012,.3);float f=abs(fract(x)-.5);return mix(1.-smoothstep(max(0.,duty*.5-aa),duty*.5+aa,f),duty,smoothstep(.15,.5,aa));}
float sq(float x){return x*x;}
float mask(float mode,vec2 uv,float phase,float group){
  float cols=floor(mix(3.,15.,u_density)), rows=floor(mix(6.,28.,u_density));
  float x=uv.x,y=uv.y;
  float border=1.-smoothstep(.025,.075,min(min(x,1.-x),min(y,1.-y)));
  vec2 cell=floor(uv*vec2(cols,rows));
  float groupPhase=group*.51;
  float tick=floor(u_chase*1.4);
  if(mode<.5) return .08+.92*smoothstep(y-.13,y+.08,.5+.5*sin(u_chase*.7-groupPhase)); // ignition: upward reveal
  if(mode<1.5) return 1.; // monolith: full face
  if(mode<2.5) return stripe(y*rows-u_chase*.75+groupPhase,.24); // strata: horizontal scan
  if(mode<3.5) return stripe(x*cols+sin(phase)*.2,.23); // pillar: vertical strips
  if(mode<4.5) return max(stripe(x*cols,.11),stripe(y*rows,.11)); // matrix: grid
  if(mode<5.5) return border; // wireframe: physical boundaries
  if(mode<6.5) return step(.48,hash21(floor(uv*vec2(max(2.,cols*.55),max(3.,rows*.4)))+vec2(group,tick))); // fracture: large cells
  if(mode<7.5) {float seed=hash21(vec2(cell.x,group));return stripe(x*cols,.24)*stripe(y*rows*.45+u_chase*(.7+seed)+seed*7.,.28);} // cascade: descending broken lines
  if(mode<8.5) return smoothstep(.0,.7,.5+.5*cos(groupPhase-u_chase)); // relay: spatial selection
  if(mode<9.5) return (1.-smoothstep(.07,.16,abs(x-.5)))*(.55+.45*step(.5,cos(groupPhase))); // spine
  if(mode<10.5) return max(stripe((x+y)*cols-u_chase,.13),stripe((x-y)*cols+u_chase,.13)); // crosswire
  if(mode<11.5)return (1.-u_blackout)*.12 + border*.08 + .85*smoothstep(.82,1.,.5+.5*cos(u_chase*.45-groupPhase)); // eclipse
  float relative=mod(group-u_routePosition+64.,128.)-64.;
  if(mode<12.5)return .09+.91*exp(-sq((relative-mod(u_chase*2.,20.))/5.)); // guidance
  if(mode<13.5)return .08+.92*exp(-sq((mod(relative-u_chase*4.+16.,32.)-16.)/3.)); // pursuit
  if(mode<14.5)return max(stripe((x+y)*cols+u_chase,.20),stripe((x-y)*cols-u_chase+group*.5,.20))*step(.1,cos(groupPhase+u_chase*2.)); // interlock
  if(mode<15.5)return .08+.92*step(mod(group,16.),mod(u_chase*2.,16.)); // domino
  if(mode<16.5)return .1+.9*exp(-sq((mod(abs(relative)+u_chase*3.,24.)-12.)/3.)); // convergence
  return .06+.94*exp(-max(0.,mod(u_routePosition-group+128.,128.))*.20)*(.5+.5*cos(u_chase*.8+groupPhase)); // afterimage
}
float lightMask(float mode){
  float m=mask(mode,v_uv,v_light.z,v_light.w);
  if(v_role<2.5){if(mode>10.5&&mode<11.5)return .04+(1.-u_blackout)*.22;return m*.82+.09;}
  if(v_role>3.5&&mode>9.5&&mode<10.5)return 1.;
  return m;
}
out vec4 outColor;
void main(){
  vec3 N=normalize(v_normal),V=normalize(u_cameraPosition-v_world);
  float depth=length(v_world-u_cameraPosition),fade=exp(-depth*u_falloff*.034);
  float edge=1.-smoothstep(.0,.10,min(min(v_uv.x,1.-v_uv.x),min(v_uv.y,1.-v_uv.y)));
  vec3 tint=v_role<2.?mix(u_metal,u_panel,step(.5,v_role)):v_role<2.5?u_perimeter:v_role<3.5?u_geometry:u_accent;
  // Fade relative to the same world camera used by floor reflections.
  if(depth>=u_farFadeEnd)discard;
  float farWeight=1.-smoothstep(u_farFadeStart,u_farFadeEnd,depth);
  if(v_role>1.5){
    float m=mix(lightMask(u_previous),lightMask(u_pattern),u_transition);
    float lit=mix(m*.55+.25,m,u_contrast);
    if(u_pattern>10.5 && u_pattern<11.5 && u_previous>10.5 && u_previous<11.5)lit=m;
    vec3 dormant=u_metal*.10*u_visibility;
    outColor=vec4(mix(u_background,(dormant+tint*v_light.x*lit*(2.6+.7*(1.-edge)))*fade,farWeight),1.);return;
  }
  float diffuse=.2+.42*abs(dot(N,normalize(vec3(.25,.5,1.))));
  float fresnel=pow(1.-abs(dot(N,V)),3.);
  float groove=.84+.16*sin(v_uv.x*140.+sin(v_uv.y*57.)*1.2);
  float grain=fract(sin(dot(floor(v_uv*vec2(180.,240.)),vec2(12.9898,78.233)))*43758.5453);
  float material=mix(1.,groove*(.87+.23*grain),v_light.z*.65);
  float spec=pow(max(dot(reflect(-normalize(vec3(.2,.3,1.)),N),V),0.),mix(60.,5.,u_roughness));
  float lampDistance=length(v_source-v_world);
  float radius=mix(4.0,1.65,u_localization)+v_spill.w*.34;
  float local=exp(-pow(lampDistance/max(radius,.1),2.));
  float active=mix(mask(u_previous,vec2(.43,.57),v_spill.z,v_spill.y),mask(u_pattern,vec2(.43,.57),v_spill.z,v_spill.y),u_transition);
  float illumination=v_light.y*v_spill.x*local*(.08+.92*active);
  vec3 spill=u_perimeter*illumination*(.27+.60*diffuse);
  vec3 reflected=mix(u_perimeter,u_geometry,.13)*illumination*u_reflections*(spec*.8+fresnel*.35+edge*.28);
  vec3 color=tint*material*(diffuse+edge*.24)+spill+reflected;
  outColor=vec4(mix(u_background,color*fade*u_visibility,farWeight),1.);
}`
export interface PurityDrawState {
  viewProjection:readonly number[]; cameraPosition:readonly [number,number,number];
  colors:readonly (readonly [number,number,number,number])[];
  background:readonly [number,number,number,number]; roughness:number; reflections:number; falloff:number; visibility:number; geometry:PurityGeometry;
}
export class Cinema2PurityRenderer {
  private readonly program:ShaderProgram
  private readonly vao:WebGLVertexArrayObject
  private readonly buffers:WebGLBuffer[]=[]
  private readonly instances:WebGLBuffer
  private readonly matrix=new Float32Array(16)
  private disposed=false
  constructor(private readonly gl:WebGL2RenderingContext){
    const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/PURITY/World',vertSrc:VERT,fragSrc:FRAG,requiredUniforms:['u_viewProjection','u_cameraPosition','u_metal','u_panel','u_perimeter','u_geometry','u_accent','u_roughness','u_reflections','u_falloff','u_visibility','u_pattern','u_previous','u_transition','u_chase','u_density','u_contrast','u_blackout','u_background','u_farFadeStart','u_farFadeEnd','u_routePosition','u_localization']})
    if(!result.program)throw new Error(`PURITY shader: ${result.error.log}`)
    this.program=result.program
    const vao=gl.createVertexArray();if(!vao){this.program.dispose();throw new Error('PURITY VAO allocation failed')};this.vao=vao
    try {
    gl.bindVertexArray(vao)
    const box=buildBox()
    const alloc=(target:number,data:Float32Array|Uint16Array|number,usage:number)=>{const b=gl.createBuffer();if(!b)throw new Error('PURITY buffer allocation failed');this.buffers.push(b);gl.bindBuffer(target,b);if(typeof data==='number')gl.bufferData(target,data,usage);else gl.bufferData(target,data as ArrayBufferView<ArrayBuffer>,usage);return b}
    alloc(gl.ARRAY_BUFFER,box.vertices,gl.STATIC_DRAW)
    for(let a=0;a<3;a++){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,a===2?2:3,gl.FLOAT,false,32,a*12)}
    alloc(gl.ELEMENT_ARRAY_BUFFER,box.indices,gl.STATIC_DRAW)
    this.instances=alloc(gl.ARRAY_BUFFER,PURITY_MAX_INSTANCES*STRIDE*4,gl.DYNAMIC_DRAW)
    for(let a=0;a<5;a++){gl.enableVertexAttribArray(a+3);gl.vertexAttribPointer(a+3,4,gl.FLOAT,false,STRIDE*4,a*16);gl.vertexAttribDivisor(a+3,1)}
    gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);assertCinema2NoGlErrors(gl,'PURITY setup')
    } catch(error) { gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);for(const b of this.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(vao);this.program.dispose();throw error }
  }
  estimateGpuBytes(){return PURITY_MAX_INSTANCES*STRIDE*4+24*32+36*2}
  draw(s:PurityDrawState){if(this.disposed)return;const {gl,program}=this;program.activate();this.matrix.set(s.viewProjection);program.setMat4('u_viewProjection',this.matrix);program.setVec3('u_cameraPosition',...s.cameraPosition)
    const names=['u_metal','u_panel','u_perimeter','u_geometry','u_accent'];for(let i=0;i<names.length;i++){const c=s.colors[i]!;program.setVec3(names[i]!,c[0],c[1],c[2])}
    program.setFloat('u_roughness',s.roughness);program.setFloat('u_reflections',s.reflections);program.setFloat('u_falloff',s.falloff);program.setFloat('u_visibility',s.visibility)
    const g=s.geometry; program.setVec3('u_background',s.background[0],s.background[1],s.background[2]);program.setFloat('u_farFadeStart',g.farFadeStart);program.setFloat('u_farFadeEnd',g.farFadeEnd); for(const [name,value] of [['u_pattern',g.pattern],['u_previous',g.previous],['u_transition',g.transition],['u_chase',g.chase],['u_density',g.density],['u_contrast',g.contrast],['u_blackout',g.blackout],['u_routePosition',g.routePosition],['u_localization',g.localization]] as const)program.setFloat(name,value)
    gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,s.geometry.data,0,s.geometry.count*STRIDE)
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true)
    gl.drawElementsInstanced(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0,s.geometry.count);gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);assertCinema2NoGlErrors(gl,'PURITY draw')
  }
  dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.buffers)this.gl.deleteBuffer(b);this.gl.deleteVertexArray(this.vao);this.program.dispose()}
}

function buildBox(): { vertices: Float32Array; indices: Uint16Array } {
  const faces: readonly (readonly [readonly number[], readonly number[], readonly number[]])[] = [
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  ]
  const vertices: number[] = []
  const indices: number[] = []
  faces.forEach(([normal, tangent, bitangent], faceIndex) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
      const su = u - 0.5
      const sv = v - 0.5
      vertices.push(
        normal[0]! * 0.5 + tangent[0]! * su + bitangent[0]! * sv,
        normal[1]! * 0.5 + tangent[1]! * su + bitangent[1]! * sv,
        normal[2]! * 0.5 + tangent[2]! * su + bitangent[2]! * sv,
        normal[0]!, normal[1]!, normal[2]!, u, v,
      )
    }
    const base = faceIndex * 4
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}
