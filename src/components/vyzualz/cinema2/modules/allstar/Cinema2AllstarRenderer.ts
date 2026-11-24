import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { ALLSTAR_PATTERNS, ALLSTAR_PROFILES, type AllstarPattern } from './Cinema2AllstarPatterns'

export const ALLSTAR_MAX_INSTANCES = 8192
const STRIDE = 12
const TAU = Math.PI * 2
const mix = (a: number,b: number,t: number) => a+(b-a)*t
const clamp = (v:number,a=0,b=1) => Math.max(a,Math.min(b,v))
const wrap = (v:number,p:number) => ((v%p)+p)%p
export interface AllstarVisualState {
  number(name:string):number; enabled(name:string):boolean;
  pattern:AllstarPattern; previous:AllstarPattern; transition:number;
  travel:number; geometryTravel:number; spin:number; morphPhase:number; chase:number; wave:number;
  segments:number; motion:number; roll:number; flash:number; silence:number;
}
/** Dynamic instance stream: world position + angle, dimensions + role, light + local spill + panel detail + bevel. */
export class AllstarGeometry {
  readonly data = new Float32Array(ALLSTAR_MAX_INSTANCES*STRIDE)
  count=0
  private roll=0
  private box(x:number,y:number,z:number,angle:number,w:number,h:number,d:number,role:number,light:number,spill:number,detail=0,bevel=0) {
    if (this.count>=ALLSTAR_MAX_INSTANCES) throw new Error('ALLSTAR instance budget exceeded')
    const c=Math.cos(this.roll),s=Math.sin(this.roll),i=this.count++*STRIDE
    this.data[i]=x*c-y*s; this.data[i+1]=x*s+y*c; this.data[i+2]=z; this.data[i+3]=angle+this.roll
    this.data[i+4]=Math.max(0.001,w); this.data[i+5]=Math.max(0.001,h); this.data[i+6]=Math.max(0.001,d); this.data[i+7]=role
    this.data[i+8]=light; this.data[i+9]=spill; this.data[i+10]=detail; this.data[i+11]=bevel
  }
  private line(ax:number,ay:number,bx:number,by:number,z:number,width:number,role:number,light:number,gap:number) {
    const dx=bx-ax,dy=by-ay
    this.box((ax+bx)*.5,(ay+by)*.5,z,Math.atan2(dy,dx),Math.hypot(dx,dy)*(1-gap)+width*.45,width,width,role,light,0,0,1)
  }
  update(s:AllstarVisualState) {
    this.count=0; this.roll=s.roll
    const n=s.number, current=ALLSTAR_PROFILES[ALLSTAR_PATTERNS.indexOf(s.pattern)]!,previous=ALLSTAR_PROFILES[ALLSTAR_PATTERNS.indexOf(s.previous)]!
    const t=clamp(s.transition); const p=(i:number)=>mix(previous[i]!,current[i]!,t*t*(3-2*t))
    const width=n('tunnelWidth'), spacing=2.2*n('tunnelDepth'), frame=n('frameThickness'), detail=n('structuralDetail')
    const base=n('intensity')*(1-.94*s.silence), rail=s.enabled('perimeterLighting')?n('perimeterIntensity'):0, fixtures=s.enabled('recessedFixtures')?n('fixtureIntensity'):0
    const hit=n('dropAccent')*n('dropStrength'), accent=s.flash*(n('snareAccent')*.35+hit*.65), density=n('fixtureDensity'), contrast=n('lightingContrast')
    const darkness=1-n('blackoutDepth')*(1-p(6)); const localSpill=n('lightSpill')
    for(let j=0;j<s.segments;j++) {
      const z=-1.3-j*spacing+wrap(s.travel,spacing), depthPhase=j*.63+s.wave
      if(z>.8) continue
      const ring=width*(1+s.motion*n('depthWave')*.055*Math.sin(depthPhase)*(0.4+n('lowMidAmount')+n('downbeatAccent')))
      const fade=clamp((s.segments-j)/3)
      const apothem=ring*Math.sqrt(3)/2
      for(let k=0;k<6;k++) {
        const theta=Math.PI/2+Math.PI/6+k*TAU/6, nx=Math.cos(theta), ny=Math.sin(theta), a=theta+Math.PI/2
        const chase=.5+.5*Math.cos(k*TAU/6-j*.73-s.chase), relay=mix(1,chase,p(8)*contrast)
        const lit=base*rail*darkness*relay*fade*(.83+.19*n('beatAccent')+.16*n('overallEnergy'))
        const spill=localSpill*(lit*.38+fixtures*base*p(7)*.05)
        // Hexagonal interior panels, stepped ribs, and a pair of recessed rails. Wall panels extend to the next module.
        this.box(nx*(apothem+.25),ny*(apothem+.25),z-spacing*.5,a,ring+.08,.34,spacing+.045,1,0,spill,detail,.4)
        this.box(nx*apothem,ny*apothem,z,a,ring+.07,frame*2.4,.42,0,0,spill,detail,1)
        this.box(nx*(apothem-frame*.54),ny*(apothem-frame*.54),z+.16,a,ring-frame*.15,frame*.94,.17,0,0,spill,detail,1)
        if(s.enabled('perimeterLighting')) {
          this.box(nx*(apothem-frame*.9),ny*(apothem-frame*.9),z+.25,a,ring-frame*.62,frame*.42,.052,2,lit,spill,0,1)
          this.box(nx*(apothem+frame*.47),ny*(apothem+frame*.47),z-.22,a,ring-frame*.35,frame*.19,.06,2,lit*.5,spill,0,1)
        }
        if(detail>.04) {
          // Recessed central housing and side bevels break up otherwise featureless walls.
          this.box(nx*(apothem+.035),ny*(apothem+.035),z-spacing*.49,a,ring*.66,.13,spacing*.61,0,0,spill,detail,1)
          for(let side=-1;side<=1;side+=2) {
            const offset=side*ring*.31,tx=-ny,ty=nx
            this.box(nx*(apothem-.045)+tx*offset,ny*(apothem-.045)+ty*offset,z-spacing*.5,a,frame*.38,.085,spacing*.72*detail,0,0,spill,detail,1)
          }
        }
        for(let f=0;f<4;f++) {
          const offset=(f-1.5)*ring*.19,tx=-ny,ty=nx
          const x=nx*(apothem-.05)+tx*offset,y=ny*(apothem-.05)+ty*offset
          const phase=.5+.5*Math.cos(s.chase*1.3+j*1.14+k*.91+f*1.58)
          const recruited=phase>1-density?1:0
          const lamp=base*fixtures*p(7)*fade*mix(1,recruited,contrast)*(.55+.35*chase+.25*n('highsAmount')+.2*n('airAmount'))
          // Housings remain even when emitter is disabled.
          this.box(x,y,z-spacing*.38,a,ring*.13,.13,.38,0,0,spill,detail,1)
          if(s.enabled('recessedFixtures')) this.box(x-nx*.072,y-ny*.072,z-spacing*.38,a,ring*.105,.06,.30,4,lamp+base*fixtures*accent*recruited,spill,0,1)
        }
      }
    }
    if(!s.enabled('geometry'))return
    const cap=Math.round(n('geometryLayers')), layers=Math.min(cap,Math.max(1,Math.round(cap*p(2)*(1-.25*n('vocalPresence')))))
    const gSpacing=3.2+4*n('geometricSeparation'), period=cap*gSpacing
    for(let j=0;j<layers;j++) {
      const distance=-.9+wrap(j*gSpacing+3.4-s.geometryTravel,period)
      if(distance<.22) continue
      const z=-distance
      const phase=s.morphPhase+j*.78
      const ripple=Math.sin(phase)*p(10)*n('morphAmount')*.23*s.motion
      const inner=clamp(mix(Math.sqrt(3)/2,p(0),n('morphAmount'))+ripple,.24,.866)
      const expansion=1+n('expansionAmount')*s.motion*(.14*Math.sin(phase)+.19*n('bassPressure')+.19*n('kickAccent')+.24*hit+.08*n('directorImpact'))
      const collapse=1-p(9)*s.motion*.68*(.5+.5*Math.cos(phase))
      const radius=width*.82*n('geometrySize')*p(3)*expansion*collapse
      const angle=Math.PI/2+s.spin*p(5)*(j%2===0?1:-n('counterRotation'))
      const gain=base*clamp(distance/1.5)*n('geometryIntensity')*(.72+.13*n('midAmount')+.16*n('subAmount')+.12*n('fluxAmount')+.1*n('sectionAccent'))*clamp((period-distance)/4+.3)
      for(let k=0;k<12;k++) {
        const a=angle+k*TAU/12,b=a+TAU/12,ra=radius*(k%2===0?1:inner),rb=radius*(k%2===0?inner:1)
        this.line(Math.cos(a)*ra,Math.sin(a)*ra,Math.cos(b)*rb,Math.sin(b)*rb,z,n('geometryThickness'),j%3===1?4:3,gain,p(1))
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
out vec4 outColor;
void main(){
  vec3 N=normalize(v_normal),V=normalize(u_cameraPosition-v_world);
  float depth=length(v_world-u_cameraPosition),fade=exp(-depth*u_falloff*.034);
  float edge=1.-smoothstep(.0,.10,min(min(v_uv.x,1.-v_uv.x),min(v_uv.y,1.-v_uv.y)));
  vec3 tint=v_role<2.?mix(u_metal,u_panel,step(.5,v_role)):v_role<2.5?u_perimeter:v_role<3.5?u_geometry:u_accent;
  if(v_role>1.5){outColor=vec4(tint*v_light.x*(2.6+0.7*(1.-edge))*fade,1.);return;}
  float diffuse=.2+.42*abs(dot(N,normalize(vec3(.25,.5,1.))));
  float fresnel=pow(1.-abs(dot(N,V)),3.);
  float groove=.84+.16*sin(v_uv.x*140.+sin(v_uv.y*57.)*1.2);
  float grain=fract(sin(dot(floor(v_uv*vec2(180.,240.)),vec2(12.9898,78.233)))*43758.5453);
  float material=mix(1.,groove*(.87+.23*grain),v_light.z*.65);
  float spec=pow(max(dot(reflect(-normalize(vec3(.2,.3,1.)),N),V),0.),mix(60.,5.,u_roughness));
  vec3 spill=u_perimeter*v_light.y*(.25+.45*diffuse);
  vec3 reflected=mix(u_perimeter,u_geometry,.13)*v_light.y*u_reflections*(spec*.8+fresnel*.35+edge*.28);
  vec3 color=tint*material*(diffuse+v_light.w*edge*.28)+spill+reflected;
  outColor=vec4(color*fade*u_visibility,1.);
}`
export interface AllstarDrawState {
  viewProjection:readonly number[]; cameraPosition:readonly [number,number,number];
  colors:readonly (readonly [number,number,number,number])[];
  roughness:number; reflections:number; falloff:number; visibility:number; geometry:AllstarGeometry;
}
export class Cinema2AllstarRenderer {
  private readonly program:ShaderProgram
  private readonly vao:WebGLVertexArrayObject
  private readonly buffers:WebGLBuffer[]=[]
  private readonly instances:WebGLBuffer
  private readonly matrix=new Float32Array(16)
  private disposed=false
  constructor(private readonly gl:WebGL2RenderingContext){
    const result=ShaderProgram.create(gl,new ShaderCompiler(gl),{label:'Cinema2/ALLSTAR/World',vertSrc:VERT,fragSrc:FRAG,requiredUniforms:['u_viewProjection','u_cameraPosition','u_metal','u_panel','u_perimeter','u_geometry','u_accent','u_roughness','u_reflections','u_falloff','u_visibility']})
    if(!result.program)throw new Error(`ALLSTAR shader: ${result.error.log}`)
    this.program=result.program
    const vao=gl.createVertexArray();if(!vao){this.program.dispose();throw new Error('ALLSTAR VAO allocation failed')};this.vao=vao
    gl.bindVertexArray(vao)
    const box=buildBox()
    const alloc=(target:number,data:Float32Array|Uint16Array|number,usage:number)=>{const b=gl.createBuffer();if(!b)throw new Error('ALLSTAR buffer allocation failed');this.buffers.push(b);gl.bindBuffer(target,b);if(typeof data==='number')gl.bufferData(target,data,usage);else gl.bufferData(target,data as ArrayBufferView<ArrayBuffer>,usage);return b}
    alloc(gl.ARRAY_BUFFER,box.vertices,gl.STATIC_DRAW)
    for(let a=0;a<3;a++){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,a===2?2:3,gl.FLOAT,false,32,a*12)}
    alloc(gl.ELEMENT_ARRAY_BUFFER,box.indices,gl.STATIC_DRAW)
    this.instances=alloc(gl.ARRAY_BUFFER,ALLSTAR_MAX_INSTANCES*STRIDE*4,gl.DYNAMIC_DRAW)
    for(let a=0;a<3;a++){gl.enableVertexAttribArray(a+3);gl.vertexAttribPointer(a+3,4,gl.FLOAT,false,STRIDE*4,a*16);gl.vertexAttribDivisor(a+3,1)}
    gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);assertCinema2NoGlErrors(gl,'ALLSTAR setup')
  }
  estimateGpuBytes(){return ALLSTAR_MAX_INSTANCES*STRIDE*4+24*32+36*2}
  draw(s:AllstarDrawState){if(this.disposed)return;const {gl,program}=this;program.activate();this.matrix.set(s.viewProjection);program.setMat4('u_viewProjection',this.matrix);program.setVec3('u_cameraPosition',...s.cameraPosition)
    const names=['u_metal','u_panel','u_perimeter','u_geometry','u_accent'];for(let i=0;i<names.length;i++){const c=s.colors[i]!;program.setVec3(names[i]!,c[0],c[1],c[2])}
    program.setFloat('u_roughness',s.roughness);program.setFloat('u_reflections',s.reflections);program.setFloat('u_falloff',s.falloff);program.setFloat('u_visibility',s.visibility)
    gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,s.geometry.data,0,s.geometry.count*STRIDE)
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.colorMask(true,true,true,true)
    gl.drawElementsInstanced(gl.TRIANGLES,36,gl.UNSIGNED_SHORT,0,s.geometry.count);gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);assertCinema2NoGlErrors(gl,'ALLSTAR draw')
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
