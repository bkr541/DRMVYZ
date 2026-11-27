import type { Cinema2EchoformDrawState } from './Cinema2EchoformRenderer'
import { ECHOFORM_WAVE_COUNT } from './Cinema2EchoformPerformance'

export interface EchoformFieldControls {
  readonly orbitCount: number; readonly orbitSpread: number; readonly echoCount: number; readonly echoDistance: number
  readonly particleDensity: number; readonly shockwave: number; readonly headphone: number; readonly filaments: number
  readonly scan: number; readonly turbulence: number; readonly recoil: number; readonly blackout: number; readonly surface: number
  readonly environment: boolean; readonly orbitColor: readonly number[]; readonly atmosphere: readonly number[]; readonly intensity: number
}

// No mesh assets or per-frame geometry allocations: a bounded procedural vertex stream in world space.
export const ECHOFORM_FIELD_VERTEX = `#version 300 es
precision highp float;
uniform mat4 u_mvp;
uniform highp int u_kind;
uniform vec4 u_motion; // time, orbit gain, contraction, vortex
uniform vec4 u_music; // energy, impact, darkness, charge
uniform vec4 u_style; // mode, scan position, scan gain, stereo side
uniform vec4 u_counts; // orbit count, spread, particle density, turbulence
uniform vec4 u_fx; // shockwave, headphones, filaments, surface
uniform vec4 u_misc; // stereo gain, intensity, pixel scale, figure scale
uniform vec4 u_waves[6]; // age, amplitude, side, reserved
uniform vec3 u_cyan;
uniform vec3 u_violet;
uniform vec3 u_atmosphere;
uniform vec3 u_figure; // yaw, pitch, roll
uniform float u_depth;
out vec4 v_color;
out vec2 v_floor;
const float TAU=6.28318530718;
float hash(float x){return fract(sin(x*127.1+7.31)*43758.5453);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
vec3 ring(float a,float r){return vec3(cos(a)*r,sin(a)*r,0.0);}
vec3 anchor(vec3 p){p*=u_misc.w;p.xz=rot(-u_figure.x)*p.xz;p.yz=rot(u_figure.y)*p.yz;p.xy=rot(u_figure.z)*p.xy;p.z+=u_depth;return p;}
void main(){
 float id=float(gl_VertexID), seg=floor(id/2.0), end=mod(id,2.0), t=u_motion.x;
 float a=0.0, gain=0.0, radius=0.0; vec3 p=vec3(0.0), col=u_cyan;
 float mode=u_style.x, dark=1.0-u_music.z;
 v_floor=vec2(0.0); gl_PointSize=1.0;
 if(u_kind==0){ // five separately tilted segmented orbits
   float layer=floor(seg/96.0), i=mod(seg,96.0);
   float direction=mod(layer,2.0)<0.5?1.0:-1.0;
   a=(i+end*0.86)/96.0*TAU;
   radius=(1.03+layer*0.145*u_counts.y)*(1.0-0.38*u_motion.z+0.14*u_music.y);
   p=ring(a,radius);p.y*=0.76;
   p.yz=rot(0.42+layer*0.45+sin(t*0.17+layer)*0.25)*p.yz;
   p.xy=rot(layer*0.79+direction*t*(0.09+u_music.w*0.09))*p.xy;
   p.z+=0.11*sin(layer*2.3);
   float chase=pow(max(0.0,cos(a-direction*t*1.9-layer*1.2)),5.0);
   float gate=step(0.18,fract(i/12.0+layer*0.31));
   gain=step(layer+0.5,u_counts.x)*gate*u_motion.y*(0.10+0.66*chase+0.48*u_music.y);
   if(mode==4.0) gain*=0.7+0.8*pow(max(0.0,cos(a+t*2.5+layer)),8.0);
   col=mix(u_cyan,u_violet,mod(layer,2.0)*0.65);
 }else if(u_kind==1){ // independent expanding event wavefronts
   int slot=int(floor(seg/96.0));vec4 w=u_waves[slot];
   a=(mod(seg,96.0)+end)/96.0*TAU;
   radius=0.25+w.x*2.25;
   p=ring(a,radius);p.y*=0.73;p.yz=rot(0.48+w.z*0.23)*p.yz;p.x+=w.z*0.58;p.z-=0.1+w.x*0.65;
   gain=w.y*pow(max(0.0,1.0-w.x),1.6)*u_fx.x*1.4;col=mix(u_cyan,u_violet,abs(w.z)*0.55);
 }else if(u_kind==2){ // stereo earcup coils, anchored to the figure's transform
   float side=floor(seg/128.0)*2.0-1.0, layer=floor(mod(seg,128.0)/64.0);
   a=(mod(seg,64.0)+end*0.9)/64.0*TAU;
   radius=0.20+layer*0.13+u_music.y*0.1;
   p=ring(a,radius);p.y*=1.2;p.x+=side*0.74;p.y-=0.12;p.z+=0.06;p=anchor(p);
   float chase=pow(max(0.0,cos(a-side*t*2.8)),5.0);
   float stereo=mode==8.0?(side==u_style.w?1.0:0.12):0.8;
   gain=u_fx.y*u_misc.x*stereo*(0.09+0.55*chase+0.8*u_music.y);col=mix(u_cyan,u_violet,step(0.0,side)*0.65);
 }else if(u_kind==3){ // dark reactor deck: four concentric rings and radial spokes
   float layer=floor(seg/96.0);a=(mod(seg,96.0)+end)/96.0*TAU;
   radius=0.35+layer*0.38;
   p=vec3(cos(a)*radius,-1.13,sin(a)*radius);
   if(layer>=4.0){a=mod(seg,96.0)/96.0*TAU; radius=mix(0.4,1.49,end);p=vec3(cos(a)*radius,-1.13,sin(a)*radius);}
   gain=u_fx.w*(0.025+u_music.y*0.45+u_music.w*0.12)*(0.35+0.65*pow(max(0.0,cos(a-t)),3.0));col=mix(u_atmosphere,u_cyan,0.55);
 }else if(u_kind==4){ // thin energy filaments link the two emitters to orbit space
   float strand=floor(seg/24.0), f=(mod(seg,24.0)+end)/24.0;
   float side=mod(strand,2.0)*2.0-1.0;
   vec3 origin=anchor(vec3(side*0.74,-0.12,0.06));
   a=strand*TAU/12.0+t*0.15;
   vec3 target=vec3(cos(a)*1.65,sin(a)*1.25,sin(a*2.0)*0.6);
   p=mix(origin,target,f)+vec3(0.0,sin(f*12.0-t*2.8+strand)*0.12,sin(f*8.0+strand)*0.15)*sin(f*3.14159);
   gain=u_fx.z*(0.07+u_music.y*0.55+u_music.w*0.28)*pow(max(0.0,cos(f*7.0-t*2.4+strand)),5.0);col=mix(u_cyan,u_violet,hash(strand));
 }else if(u_kind==5){ // stable particle identities and depth-distributed vortex
   float h=hash(id+0.13), h2=hash(id+14.1), h3=hash(id+57.0);
   a=h*TAU+t*(0.025+u_motion.w*0.12)*(0.5+h2);
   radius=(0.78+h2*1.55)*(1.0-0.55*u_motion.z+0.16*u_music.y);
   p=vec3(cos(a)*radius,sin(a)*radius*0.72,(h3-0.5)*2.5);
   p.y+=sin(a*3.0+h3*TAU+t*0.13)*u_counts.w*0.24;
   gain=step(h3,u_counts.z)*(0.07+u_motion.w*0.20+u_music.y*0.28)*(0.45+0.55*hash(id+8.0));
   col=mix(u_cyan,u_violet,h2);gl_PointSize=max(1.0,(1.0+2.4*h*h+u_music.y)*u_misc.z);
 }else if(u_kind==6){ // scanning plane, rows travel across the actual figure
   float row=floor(seg/32.0), f=(mod(seg,32.0)+end)/32.0;
   float y=(u_style.y*2.0-1.0)*1.04+(row-2.0)*0.023;
   p=anchor(vec3(mix(-1.0,1.0,f),y,0.22+row*0.025));
   gain=u_style.z*(row==2.0?0.95:0.19)*(0.5+0.5*sin(f*3.14159));
 }else { // triangulated matte deck, light falls off radially from the reactor
   float tri=floor(id/3.0), corner=mod(id,3.0);
   a=(tri+max(0.0,corner-1.0))/96.0*TAU;
   radius=corner<0.5?0.0:1.52;
   p=vec3(cos(a)*radius,-1.135,sin(a)*radius);v_floor=p.xz;
   col=u_atmosphere;gain=u_fx.w*(0.035+u_music.y*0.40+u_music.w*0.12);
 }
 gain*=dark*u_misc.y;
 v_color=vec4(col*gain,gain);
 gl_Position=u_mvp*vec4(p,1.0);
}`
export const ECHOFORM_FIELD_FRAGMENT = `#version 300 es
precision highp float;
uniform highp int u_kind;
in vec4 v_color;
in vec2 v_floor;
out vec4 outColor;
void main(){float a=1.0;if(u_kind==5)a=1.0-smoothstep(0.12,0.5,length(gl_PointCoord-0.5));if(u_kind==7)a=pow(max(0.0,1.0-length(v_floor)/1.52),2.0);if(a*v_color.a<0.001)discard;outColor=v_color*a;}`

export class Cinema2EchoformEnergyField {
  private readonly vao: WebGLVertexArrayObject
  private readonly locations = new Map<string, WebGLUniformLocation | null>()
  private readonly waveUniform = new Float32Array(ECHOFORM_WAVE_COUNT * 4)
  private readonly mvp = new Float32Array(16)
  constructor(private readonly gl: WebGL2RenderingContext, private readonly program: WebGLProgram) {
    const vao = gl.createVertexArray()
    if (!vao) { gl.deleteProgram(program); throw new Error('EchoForm energy field VAO allocation failed') }
    this.vao = vao
  }
  draw(state: Readonly<Cinema2EchoformDrawState>): void {
    const p = state.performance, c = state.field
    if (!p || !c) return
    const gl = this.gl, program = this.program
    const loc = (key: string) => { if (!this.locations.has(key)) this.locations.set(key, gl.getUniformLocation(program, key)); return this.locations.get(key) ?? null }
    const vec = (key: string, a: number,b: number,d: number,e: number) => gl.uniform4f(loc(key),a,b,d,e)
    gl.useProgram(program); gl.bindVertexArray(this.vao)
    const a=state.viewProjectionMatrix,b=state.modelMatrix
    for(let col=0;col<4;col++) for(let row=0;row<4;row++) this.mvp[col*4+row]=a[row]!*b[col*4]!+a[row+4]!*b[col*4+1]!+a[row+8]!*b[col*4+2]!+a[row+12]!*b[col*4+3]!
    gl.uniformMatrix4fv(loc('u_mvp'),false,this.mvp)
    vec('u_motion',p.time % 16384,p.orbit,p.contraction,p.vortex)
    vec('u_music',p.energy,p.impact,p.darkness*c.blackout,p.charge)
    vec('u_style',p.mode,p.scan,p.scanGain*c.scan,p.stereoSide)
    vec('u_counts',c.orbitCount,c.orbitSpread,c.particleDensity,c.turbulence)
    vec('u_fx',c.shockwave,c.headphone,c.filaments,c.environment?c.surface:0)
    vec('u_misc',p.stereo,c.intensity,Math.max(0.5,gl.drawingBufferHeight/900),state.scale)
    gl.uniform3f(loc('u_figure'),state.yawRadians,p.pitch,p.roll)
    gl.uniform1f(loc('u_depth'),p.depth*c.recoil)
    gl.uniform3f(loc('u_cyan'),c.orbitColor[0]!,c.orbitColor[1]!,c.orbitColor[2]!)
    gl.uniform3f(loc('u_violet'),state.accent[0],state.accent[1],state.accent[2])
    gl.uniform3f(loc('u_atmosphere'),c.atmosphere[0]!,c.atmosphere[1]!,c.atmosphere[2]!)
    this.waveUniform.fill(0)
    p.waves.forEach((w,i)=>{if(i<ECHOFORM_WAVE_COUNT){this.waveUniform[i*4]=w.age;this.waveUniform[i*4+1]=w.gain;this.waveUniform[i*4+2]=w.side}})
    gl.uniform4fv(loc('u_waves[0]'),this.waveUniform)
    const batch=(kind:number,mode:number,count:number)=>{gl.uniform1i(loc('u_kind'),kind);gl.drawArrays(mode,0,count)}
    if(c.environment && c.surface>0){batch(7,gl.TRIANGLES,96*3);batch(3,gl.LINES,5*96*2)}
    batch(0,gl.LINES,5*96*2)
    if(p.waves.length && c.shockwave>0)batch(1,gl.LINES,ECHOFORM_WAVE_COUNT*96*2)
    if(c.headphone>0)batch(2,gl.LINES,2*128*2)
    if(c.filaments>0)batch(4,gl.LINES,12*24*2)
    if(c.particleDensity>0)batch(5,gl.POINTS,4200)
    if(p.scanGain*c.scan>0)batch(6,gl.LINES,5*32*2)
  }
  dispose():void{this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program)}
}
