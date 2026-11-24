import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { PURITY_PATTERNS, type PurityPattern } from './Cinema2PurityPatterns'

export const PURITY_MAX_INSTANCES = 2048
const STRIDE = 12
const clamp = (v:number,a=0,b=1) => Math.max(a,Math.min(b,v))
const wrap = (v:number,p:number) => ((v%p)+p)%p
export interface PurityVisualState {
  number(name:string):number; enabled(name:string):boolean;
  pattern:PurityPattern; previous:PurityPattern; transition:number;
  travel:number; chase:number; wave:number;
  segments:number; motion:number; flash:number; silence:number;
}
/** Bounded instanced solid housings and programmable luminous faces. A virtual floor is rendered by the shared depth-aware floor effect. */
export class PurityGeometry {
  readonly data = new Float32Array(PURITY_MAX_INSTANCES*STRIDE)
  count=0
  pattern=0; previous=0; transition=1; chase=0; density=.65; contrast=.8; blackout=.75
  private box(x:number,y:number,z:number,angle:number,w:number,h:number,d:number,role:number,light:number,spill:number,detail=0,group=0) {
    if(this.count>=PURITY_MAX_INSTANCES) throw new Error('PURITY instance budget exceeded')
    const i=this.count++*STRIDE
    const dta=this.data; dta[i]=x;dta[i+1]=y;dta[i+2]=z;dta[i+3]=angle;dta[i+4]=Math.max(.001,w);dta[i+5]=Math.max(.001,h);dta[i+6]=Math.max(.001,d);dta[i+7]=role;dta[i+8]=light;dta[i+9]=spill;dta[i+10]=detail;dta[i+11]=group
  }
  private line(ax:number,ay:number,bx:number,by:number,z:number,width:number,role:number,light:number,group:number) {
    this.box((ax+bx)*.5,(ay+by)*.5,z,Math.atan2(by-ay,bx-ax),Math.hypot(bx-ax,by-ay),width,width,role,light,0,0,group)
  }
  update(s:PurityVisualState) {
    this.count=0
    const n=s.number, W=n('tunnelWidth'), spacing=3.5*n('tunnelDepth'), thick=n('frameThickness'), detail=n('structuralDetail')
    this.pattern=PURITY_PATTERNS.indexOf(s.pattern); this.previous=PURITY_PATTERNS.indexOf(s.previous)
    const t=clamp(s.transition); this.transition=t*t*(3-2*t); this.chase=s.chase; this.density=n('fixtureDensity'); this.contrast=n('lightingContrast');this.blackout=n('blackoutDepth')
    const base=n('intensity')*(1-.94*s.silence), rail=s.enabled('perimeterLighting')?n('perimeterIntensity'):0, face=s.enabled('recessedFixtures')?n('fixtureIntensity'):0
    const hit=n('dropAccent')*n('dropStrength'), bass=n('bassPressure'), vocal=n('vocalPresence'), energy=n('overallEnergy')
    const floor=-2.4, top=2.6
    // Stable recycled world bays; housing stays dark while the addressable skin changes independently.
    const segments=Math.min(22,Math.max(1,Math.floor(s.segments)))
    const offset=wrap(s.travel,spacing)
    for(let j=0;j<segments;j++) {
      const z=-1.2-j*spacing+offset
      if(z>.7) continue
      const id=j+Math.floor(s.travel/spacing), fade=clamp((segments-j)/3)
      const phase=id*.43+s.chase
      const halo=base*(.7+.19*energy+.13*n('subAmount'))*fade
      const spill=n('lightSpill')*halo*(.12+.16*n('midAmount')+.17*bass+.18*s.flash*hit)
      // Industrial sidewalls and overhead slabs with recessed ribs; floor is shared SSR, not an opaque slab.
      for(const sign of [-1,1]) {
        this.box(sign*(W+.12),.1,z-spacing*.5,0,.24,5.1,spacing+.05,1,0,spill,detail)
        this.box(sign*(W-.02),.1,z,0,thick*.65,5.1,.22,0,0,spill,detail)
        this.box(sign*(W-.08),1.65,z-spacing*.5,0,.09,thick,spacing*.83,0,0,spill,detail)
      }
      this.box(0,top+.14,z-spacing*.5,0,W*2+.2,.26,spacing+.04,1,0,spill,detail)
      this.box(0,top-.025,z,0,W*2,thick*.75,.26,0,0,spill,detail)
      // Center portal and two smaller flanking portals. The central passage remains open at every width.
      for(let g=-1;g<=1;g++) {
        const center=g*W*.72, half=W*(g===0?.44:.13), height=g===0?4.72:2.62
        const column=Math.min(thick*(g===0?3.2:2.15),W*(g===0?.15:.13)), beamDepth=thick*3.4, y=floor+height*.5, roof=floor+height
        const group=id*3+g+1
        const accent=s.flash*(.21*n('kickAccent')+.19*n('beatAccent')+.23*n('snareAccent')*(g===0?.3:1)+.36*hit)
        const recruitment=1-.14*vocal*(g===0?0:1)+.12*n('buildAmount')+.09*n('directorIntensity')
        const gain=halo*face*recruitment*(.86+.13*n('lowMidAmount')+.13*n('highsAmount')+.08*n('airAmount')+.1*n('fluxAmount')+accent)
        const trim=halo*rail*(.52+s.flash*(.11*n('downbeatAccent')+.1*n('directorImpact'))+accent)
        const localPhase=phase+g*.91+.16*n('sectionAccent')+.18*n('variation')
        const part=(x:number,cy:number,w:number,h:number)=>{
          // Physical metal surround, front inset, and narrower recessed perimeter rails on two vertical sides.
          this.box(x,cy,z,0,w,h,beamDepth,0,0,spill,detail,group)
          if(s.enabled('recessedFixtures')) {
            this.box(x,cy,z+beamDepth*.5+.012,0,w*.87,h*.94,.023,3,gain,spill,localPhase,group)
            if(h>w) for(const k of [-1,1]) this.box(x+k*(w*.5+.012),cy,z,0,.023,h*.94,beamDepth*.88,3,gain*.85,spill,localPhase,group)
          }
          if(s.enabled('perimeterLighting')) {
            const r=Math.max(.012,thick*.13)
            for(const k of [-1,1]){
              this.box(x+k*w*.46,cy,z+beamDepth*.5+.03,0,r,h*.94,.035,2,trim,spill,localPhase,group)
              this.box(x,cy+k*h*.47,z+beamDepth*.5+.03,0,w*.92,r,.035,2,trim,spill,localPhase,group)
            }
          }
        }
        part(center-half,y,column,height)
        part(center+half,y,column,height)
        part(center,roof,half*2+column,column)
      }
      // Angled peripheral bars provide the first reference's alternating diagonal/X vocabulary.
      if(s.enabled('perimeterLighting')) for(const sign of [-1,1]) {
        const direction=id%2===0?1:-1, x=sign*(W-.32), wobble=s.motion*n('depthWave')*.20*Math.sin(s.wave+id*.8)
        this.line(x-sign*.43,floor+.12,x+sign*direction*.24,top-.21,z-spacing*.48,thick*.35,4,halo*rail*(.55+.17*n('phraseAccent')+.14*n('bassPressure')),id*3+1)
        this.line(x-sign*.45+wobble,top-.16,x+sign*.14,floor+.35,z-spacing*.7,thick*.23,4,halo*rail*.65,id*3+2)
      }
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
uniform mat4 u_viewProjection;
out vec3 v_world; out vec3 v_normal; out vec2 v_uv; flat out vec4 v_light; flat out float v_role;
void main(){float c=cos(i_pose.w),s=sin(i_pose.w);mat2 r=mat2(c,s,-s,c);vec3 local=a_position*i_size.xyz;v_world=i_pose.xyz+vec3(r*local.xy,local.z);v_normal=vec3(r*a_normal.xy,a_normal.z);v_uv=a_uv;v_light=i_light;v_role=i_size.w;gl_Position=u_viewProjection*vec4(v_world,1.0);}`
const FRAG=`#version 300 es
precision highp float;
in vec3 v_world; in vec3 v_normal; in vec2 v_uv; flat in vec4 v_light; flat in float v_role;
uniform vec3 u_cameraPosition,u_metal,u_panel,u_perimeter,u_geometry,u_accent;
uniform float u_roughness,u_reflections,u_falloff,u_visibility;
uniform float u_pattern,u_previous,u_transition,u_chase,u_density,u_contrast,u_blackout;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float stripe(float x,float duty){float aa=clamp(fwidth(x)*.5,.012,.3);float f=abs(fract(x)-.5);return mix(1.-smoothstep(max(0.,duty*.5-aa),duty*.5+aa,f),duty,smoothstep(.15,.5,aa));}
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
  return (1.-u_blackout)*.12 + border*.08 + .85*smoothstep(.82,1.,.5+.5*cos(u_chase*.45-groupPhase)); // eclipse
}
float lightMask(float mode){
  if(v_role<2.5) { // perimeter trim tracks face choreography without erasing the physical outline
    if(mode>10.5)return .06+(1.-u_blackout)*.4;
    if(mode>8.5&&mode<9.5)return .12;
    if(mode>7.5&&mode<8.5)return mask(mode,v_uv,v_light.z,v_light.w);
    return mode>4.5&&mode<5.5?1.:.42;
  }
  if(v_role>3.5){ // diagonal beams are primary only in CROSSWIRE; other patterns retain restrained spatial cues
    if(mode>9.5&&mode<10.5)return 1.;
    if(mode>10.5)return .04+(1.-u_blackout)*.2;
    return .24+ .18*sin(v_light.w*.6-u_chase);
  }
  return mask(mode,v_uv,v_light.z,v_light.w);
}
out vec4 outColor;
void main(){
  vec3 N=normalize(v_normal),V=normalize(u_cameraPosition-v_world);
  float depth=length(v_world-u_cameraPosition),fade=exp(-depth*u_falloff*.034);
  float edge=1.-smoothstep(.0,.10,min(min(v_uv.x,1.-v_uv.x),min(v_uv.y,1.-v_uv.y)));
  vec3 tint=v_role<2.?mix(u_metal,u_panel,step(.5,v_role)):v_role<2.5?u_perimeter:v_role<3.5?u_geometry:u_accent;
  if(v_role>1.5){
    float m=mix(lightMask(u_previous),lightMask(u_pattern),u_transition);
    float lit=mix(m*.55+.25,m,u_contrast);
    if(u_pattern>10.5 && u_previous>10.5)lit=m;
    vec3 dormant=u_metal*.10*u_visibility;
    outColor=vec4((dormant+tint*v_light.x*lit*(2.6+.7*(1.-edge)))*fade,1.);return;
  }
  float diffuse=.2+.42*abs(dot(N,normalize(vec3(.25,.5,1.))));
  float fresnel=pow(1.-abs(dot(N,V)),3.);
  float groove=.84+.16*sin(v_uv.x*140.+sin(v_uv.y*57.)*1.2);
  float grain=fract(sin(dot(floor(v_uv*vec2(180.,240.)),vec2(12.9898,78.233)))*43758.5453);
  float material=mix(1.,groove*(.87+.23*grain),v_light.z*.65);
  float spec=pow(max(dot(reflect(-normalize(vec3(.2,.3,1.)),N),V),0.),mix(60.,5.,u_roughness));
  vec3 spill=u_perimeter*v_light.y*(.25+.45*diffuse);
  vec3 reflected=mix(u_perimeter,u_geometry,.13)*v_light.y*u_reflections*(spec*.8+fresnel*.35+edge*.28);
  vec3 color=tint*material*(diffuse+edge*.24)+spill+reflected;
  outColor=vec4(color*fade*u_visibility,1.);
}`
export interface PurityDrawState {
  viewProjection:readonly number[]; cameraPosition:readonly [number,number,number];
  colors:readonly (readonly [number,number,number,number])[];
  roughness:number; reflections:number; falloff:number; visibility:number; geometry:PurityGeometry;
}
export class Cinema2PurityRenderer {
  private readonly program:ShaderProgram
  private readonly vao:WebGLVertexArrayObject
  private readonly buffers:WebGLBuffer[]=[]
  private readonly instances:WebGLBuffer
  private readonly matrix=new Float32Array(16)
  private disposed=false
  constructor(private readonly gl:WebGL2RenderingContext){
    const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/PURITY/World',vertSrc:VERT,fragSrc:FRAG,requiredUniforms:['u_viewProjection','u_cameraPosition','u_metal','u_panel','u_perimeter','u_geometry','u_accent','u_roughness','u_reflections','u_falloff','u_visibility','u_pattern','u_previous','u_transition','u_chase','u_density','u_contrast','u_blackout']})
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
    for(let a=0;a<3;a++){gl.enableVertexAttribArray(a+3);gl.vertexAttribPointer(a+3,4,gl.FLOAT,false,STRIDE*4,a*16);gl.vertexAttribDivisor(a+3,1)}
    gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);assertCinema2NoGlErrors(gl,'PURITY setup')
    } catch(error) { gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);for(const b of this.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(vao);this.program.dispose();throw error }
  }
  estimateGpuBytes(){return PURITY_MAX_INSTANCES*STRIDE*4+24*32+36*2}
  draw(s:PurityDrawState){if(this.disposed)return;const {gl,program}=this;program.activate();this.matrix.set(s.viewProjection);program.setMat4('u_viewProjection',this.matrix);program.setVec3('u_cameraPosition',...s.cameraPosition)
    const names=['u_metal','u_panel','u_perimeter','u_geometry','u_accent'];for(let i=0;i<names.length;i++){const c=s.colors[i]!;program.setVec3(names[i]!,c[0],c[1],c[2])}
    program.setFloat('u_roughness',s.roughness);program.setFloat('u_reflections',s.reflections);program.setFloat('u_falloff',s.falloff);program.setFloat('u_visibility',s.visibility)
    const g=s.geometry; for(const [name,value] of [['u_pattern',g.pattern],['u_previous',g.previous],['u_transition',g.transition],['u_chase',g.chase],['u_density',g.density],['u_contrast',g.contrast],['u_blackout',g.blackout]] as const)program.setFloat(name,value)
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
