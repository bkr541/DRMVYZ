import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'

export const CORRIDOR_BAY_LENGTH = 2.8
const BAY_COUNT = 12
const LANES = 4

export const CORRIDOR_PATTERNS = [
  { value: 'night-transit', label: 'Night Transit' },
  { value: 'relay', label: 'Relay' },
  { value: 'counterflow', label: 'Counterflow' },
  { value: 'shaft', label: 'Shaft' },
  { value: 'signal-fault', label: 'Signal Fault' },
  { value: 'gate', label: 'Gate' },
] as const
export type CorridorPattern = typeof CORRIDOR_PATTERNS[number]['value']

export interface CorridorLook {
  travel: number
  phase: number
  roll: number
  sway: number
  width: number
  density: number
  intensity: number
  haze: number
  pattern: CorridorPattern
  kick: number
  transient: number
  build: number
  drop: number
  voidColor: Cinema2Color
  wall: Cinema2Color
  amber: Cinema2Color
  hot: Cinema2Color
  markings: Cinema2Color
}

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 aTile; // across the wall, depth along the bay, recess depth
layout(location=1) in vec2 aUV;
layout(location=2) in vec3 aCell; // surface, bay, lane
uniform mat4 uView;
uniform mat4 uProjection;
uniform vec4 uPose; // wrapped axial travel, roll, lateral sway, width
out vec2 vUV;
out vec3 vPosition;
out float vRecess;
flat out vec3 vCell;
void main() {
  float bank = aCell.x;
  vec2 p = vec2(aTile.x, 1.0 + aTile.z);
  if (bank < 0.5) p = vec2(-p.y, p.x);
  else if (bank < 1.5) p = vec2(p.x, p.y);
  else if (bank < 2.5) p = vec2(p.y, -p.x);
  else p = vec2(-p.x, -p.y);
  p *= uPose.w;
  float s = sin(uPose.y), c = cos(uPose.y);
  p = mat2(c, s, -s, c) * (p - vec2(uPose.z, 0.0));
  vPosition = vec3(p, -(aCell.y + aTile.y) * ${CORRIDOR_BAY_LENGTH} + uPose.x);
  vUV = aUV;
  vCell = aCell;
  vRecess = aTile.z;
  gl_Position = uProjection * uView * vec4(vPosition, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vPosition;
in float vRecess;
flat in vec3 vCell;
uniform vec4 uLook;    // first world bay, phase, density, intensity
uniform vec4 uAccents; // kick, transient, build, drop
uniform int uPattern;
uniform float uHaze;
uniform vec3 uVoid;
uniform vec3 uWall;
uniform vec3 uAmber;
uniform vec3 uHot;
uniform vec3 uMarkings;
out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float boxSdf(vec2 p, vec2 size, float corner) {
  vec2 d = abs(p) - size + corner;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - corner;
}
float stroke(float d, float width) {
  float aa = max(fwidth(d), .001);
  return 1.0 - smoothstep(width - aa, width + aa, abs(d));
}

float selection(float row, float bank, float lane, float random, float density) {
  float phase = uLook.y;
  float strength = smoothstep(1.0-density-.06, 1.0-density+.03, random);
  if (uPattern == 1) {
    float relay = abs(fract((row + bank * 1.8 - phase * 2.0) / 7.0) - 0.5);
    return (1.0-smoothstep(.102,.23,relay)) * mix(.43,1.0,strength);
  }
  if (uPattern == 2) {
    float direction = bank < 1.5 ? 1.0 : -1.0;
    float pass = abs(fract((row * direction + lane * .26 - phase * 2.45) / 5.0)-.5);
    return (1.0-smoothstep(.10,.22,pass)) * mix(.26,1.0,strength);
  }
  if (uPattern == 3) {
    float overhead = mod(bank,2.0);
    float laneLight = 1.0 - smoothstep(.47, 1.42, abs(lane - 1.5));
    return mix(strength*.24, laneLight*(0.48+.52*cos(row*.83-phase*2.9)*cos(row*.83-phase*2.9)), overhead);
  }
  if (uPattern == 4) {
    float tick = floor(phase * 2.0);
    float fault = hash(vec2(row+tick*13.0, bank * 7.6 + floor(lane/2.0)));
    return smoothstep(.66,.86,fault)*strength + .12*strength;
  }
  if (uPattern == 5) {
    float bay = abs(fract((row - phase * 1.75) / 6.5)-.5);
    return (1.0-smoothstep(.057,.15,bay))*.94 + strength*.16;
  }
  return strength * (.67 + .33 * sin(row*.78-phase*2.45+bank*.72)*sin(row*.78-phase*2.45+bank*.72));
}

float motif(vec2 p, float kind) {
  vec2 q = abs(p);
  if (kind < .33) {
    float octagon = max(max(q.x,q.y), (q.x+q.y)*.72)-.165;
    return max(stroke(octagon,.009), stroke(p.y,.009) * (1.0-smoothstep(.12,.16,q.x)));
  }
  if (kind < .66) {
    float diamond = q.x + q.y - .235;
    float crossBar = stroke(p.x,.008) * (1.0-smoothstep(.12,.16,q.y));
    return max(stroke(diamond,.008), crossBar);
  }
  float brackets = max(stroke(q.x-.14,.013)*(1.0-smoothstep(.10,.16,q.y)),
                       stroke(q.y-.145,.012)*(1.0-smoothstep(.05,.10,q.x)));
  return max(brackets, stroke(p.y,.011)*(1.0-smoothstep(.04,.075,q.x)));
}

void main() {
  float bank = vCell.x, row = mod(vCell.y + uLook.x,4096.0), lane = vCell.z;
  vec2 id = vec2(row,bank*13.5+lane);
  float random = hash(id + 1.3);
  float detail = hash(id + 31.5);
  float distanceIn = max(0.0,-vPosition.z);
  float level = selection(row,bank,lane,random,uLook.z);
  float guide = step(.90,random)*smoothstep(9.0,22.0,distanceIn)*.16;
  float bassHit = uAccents.x * (bank < .5 || bank > 2.5 ? .66 : .24) * exp(-distanceIn*.20);
  float nearbyBuild = uAccents.z * (1.0-smoothstep(1.8,10.0,distanceIn))*.50;
  // A short energetic ring comes toward the lens with only one main bay raised.
  float ringDepth = mix(1.55,4.25,clamp(uAccents.w,0.0,1.0));
  float bayCenter = -vPosition.z + (.5 - vUV.y) * ${CORRIDOR_BAY_LENGTH};
  float ring = uAccents.w * exp(-pow((bayCenter / ${CORRIDOR_BAY_LENGTH} - ringDepth) / .54,2.0));
  level = max(guide,max(level + bassHit + nearbyBuild,ring*1.28));
  float fixture = smoothstep(.18,.34,level);
  vec2 local = vUV - .5;
  vec2 size = vec2(mix(.255,.414,random),mix(.215,.429,detail));
  size = mix(size, vec2(.412,.365), smoothstep(.55,.88,ring));
  float lamp = boxSdf(local,size,.014);
  float aa = max(fwidth(lamp),.0008);
  float diffuser = 1.0-smoothstep(-aa,aa,lamp);
  float reveal = stroke(lamp-.016,.009);
  float seam = min(min(vUV.x,1.0-vUV.x),min(vUV.y,1.0-vUV.y));
  float gasket = mix(.14,1.0,smoothstep(.010,.030,seam));
  float brushed = hash(vec2(floor(vUV.x*94.0),floor(vUV.y*405.0)) + id*9.0);
  float edge = exp(-abs(lamp-.034)*32.0) * fixture;
  float spill = exp(-max(lamp,0.0)*14.0) * fixture;
  float recess = smoothstep(.012,.032,vRecess);
  float warm = mix(.16,.88,smoothstep(.57,.94,detail));
  vec3 lampColor = mix(uAmber,uHot,warm + (1.0-warm)*min(1.0,ring*.75));
  float stipple = mix(.90,1.0,hash(floor(vUV*vec2(92.0,146.0))+id));
  float bezel = smoothstep(.021,.065,seam)*(1.0-smoothstep(.065,.093,seam));
  float shoulder = stroke(seam-.068,.006);
  vec3 metal = uWall * (0.16 + .16 * spill + .085 * brushed + .19 * bezel) * gasket * mix(1.0,.49,recess);
  metal += lampColor * (edge*.17 + spill*.064 + reveal*fixture*.065 + shoulder*fixture*.04) * uLook.w;
  if (bank > 2.5) metal += lampColor * exp(-abs(lamp - .061)*9.0) * fixture * uLook.w * .035;
  float warmGrain = (1.0-smoothstep(.21,.48,length(local))) * .14 + stipple;
  vec3 emission = lampColor * diffuser * fixture * min(5.5, (.50+2.95*level)*uLook.w) * warmGrain;
  // Each original diagnostic sign occupies a darker cassette rather than competing with a lit diffuser.
  float mark = motif(local,hash(id + 67.0));
  float annotation = step(.60,detail) * (1.0-fixture) * (0.62 + .30 * uAccents.y);
  vec3 marking = mark * annotation * uMarkings * uLook.w;
  float vignette = exp(-pow(distanceIn * (.034 + uHaze *.13),1.34));
  float apertureFade = 1.0-smoothstep(24.0,33.0,distanceIn);
  float depthFade = mix(.67,1.0,smoothstep(.75,4.6,distanceIn));
  outColor = vec4(mix(uVoid,metal+emission+marking,vignette*apertureFade*depthFade),1.0);
}`

// Each recessed cassette has a continuous outer quad, a raised lip and an inset face.
function geometry() {
  const data: number[] = []
  for (let bank = 0; bank < 4; bank++) {
    for (let bay = 0; bay < BAY_COUNT; bay++) {
      for (let lane = 0; lane < LANES; lane++) {
        const rim = (border: number, depth: number) => [[border,border,depth],[1-border,border,depth],[1-border,1-border,depth],[border,1-border,depth]]
        const outer = rim(0, 0)
        const lip = rim(.04, -.012)
        const inner = rim(.078, .026)
        const vertex = ([u, v, recess]: number[]) => data.push((lane + u!) * 2 / LANES - 1, v!, recess!, u!, v!, bank, bay, lane)
        for (const [a, b] of [[outer,lip],[lip,inner]]) {
          for (let corner = 0; corner < 4; corner++) {
            const next = (corner + 1) % 4
            for (const point of [a![corner],a![next],b![next],a![corner],b![next],b![corner]]) vertex(point!)
          }
        }
        for (const index of [0,1,2,0,2,3]) vertex(inner[index]!)
      }
    }
  }
  return Float32Array.from(data)
}

export class Cinema2CorridorRenderer {
  private readonly vao: WebGLVertexArrayObject
  private readonly buffer: WebGLBuffer
  private readonly program: ShaderProgram
  private readonly guard: Cinema2GlStateGuard
  private readonly count: number
  readonly bytes: number

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.guard = new Cinema2GlStateGuard(gl)
    const data = geometry()
    this.count = data.length / 8
    this.bytes = data.byteLength
    this.guard.capture()
    const vao = gl.createVertexArray()
    const buffer = gl.createBuffer()
    try {
      if (!vao || !buffer) throw new Error('Corridor could not allocate its cassette mesh.')
      const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
        vertSrc: VERTEX, fragSrc: FRAGMENT, label: 'cinema2/corridor',
        requiredUniforms: ['uView', 'uProjection', 'uPose', 'uLook', 'uAccents', 'uPattern', 'uHaze', 'uVoid', 'uWall', 'uAmber', 'uHot', 'uMarkings'],
      })
      if (!compiled.program) throw new Error(compiled.error.log)
      this.program = compiled.program
      this.vao = vao
      this.buffer = buffer
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      for (const [index, size, offset] of [[0,3,0],[1,2,12],[2,3,20]]) {
        gl.enableVertexAttribArray(index!)
        gl.vertexAttribPointer(index!,size!,gl.FLOAT,false,32,offset!)
      }
    } catch (error) {
      gl.deleteVertexArray(vao)
      gl.deleteBuffer(buffer)
      throw error
    } finally {
      this.guard.restore()
    }
  }

  draw(execution: Cinema2ModuleRenderExecutionContext, look: Readonly<CorridorLook>) {
    const camera = execution.camera
    if (!camera || !execution.depthAvailable) throw new Error('Corridor requires a world camera and depth attachment.')
    const gl = this.gl
    const program = this.program
    const bay = Math.floor(look.travel / CORRIDOR_BAY_LENGTH)
    this.guard.capture()
    try {
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.depthMask(true)
      gl.disable(gl.CULL_FACE)
      gl.disable(gl.BLEND)
      gl.bindVertexArray(this.vao)
      program.activate()
      program.setMat4('uView',new Float32Array(camera.viewMatrix))
      program.setMat4('uProjection',new Float32Array(camera.projectionMatrix))
      program.setVec4('uPose',look.travel - bay * CORRIDOR_BAY_LENGTH,look.roll,look.sway,look.width)
      program.setVec4('uLook',bay % 4096,look.phase,look.density,look.intensity)
      program.setVec4('uAccents',look.kick,look.transient,look.build,look.drop)
      program.setInt('uPattern',CORRIDOR_PATTERNS.findIndex(pattern => pattern.value === look.pattern))
      program.setFloat('uHaze',look.haze)
      for (const [name,value] of [['uVoid',look.voidColor],['uWall',look.wall],['uAmber',look.amber],['uHot',look.hot],['uMarkings',look.markings]] as const) {
        program.setVec3(name,value[0],value[1],value[2])
      }
      gl.drawArrays(gl.TRIANGLES,0,this.count)
    } finally {
      this.guard.restore()
    }
  }

  dispose() {
    this.program.dispose()
    this.gl.deleteVertexArray(this.vao)
    this.gl.deleteBuffer(this.buffer)
  }
}
