import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'

export const CORRIDOR_BAY_LENGTH = 2.8
const BAY_COUNT = 12
const LANES = 4
export const CORRIDOR_MAX_INSET = 0.19
export const CORRIDOR_BANK_SPAN = 0.79

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
  bass: number
  extensionBuild: number
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
layout(location=0) in vec3 aTile; // across the wall, depth along the bay, housing depth fraction
layout(location=1) in vec2 aUV;
layout(location=2) in vec3 aCell; // surface, bay, lane
layout(location=3) in vec2 aPart; // backing / side / bevel / recessed strip / face / piston, edge index
uniform mat4 uView;
uniform mat4 uProjection;
uniform vec4 uPose; // wrapped axial travel, roll, lateral sway, width
out vec2 vUV;
out vec3 vPosition;
out float vDepth;
flat out vec3 vCell;
flat out vec2 vPart;
uniform vec4 uLook;
uniform vec4 uAccents;
uniform vec2 uMechanical; // shared bass and slower structural build envelope

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  float bank = aCell.x;
  float row = mod(aCell.y + uLook.x,4096.0);
  vec2 id = vec2(row,bank*13.5+aCell.z);
  float depth = 0.0;
  float across = aTile.x;
  float axial = aTile.y;
  if (aPart.x > .5) {
    // Stable by world bay, not recycled slot. Adjacent lanes and pairs of bays
    // share a piston response while individual modules retain different thicknesses.
    float random = hash(id + 1.3);
    float detail = hash(id + 31.5);
    float group = hash(vec2(floor(row/2.0), bank*3.0+floor(aCell.z/2.0)) + 9.7);
    float bass = uMechanical.x * mix(.012,.068,smoothstep(.18,.85,group));
    float kick = uAccents.x * mix(.012,.074,smoothstep(.38,.78,group));
    // A build progressively recruits groups, rather than popping all pistons at once.
    float build = .070 * uMechanical.y * smoothstep(group*.55,group*.55+.38,uMechanical.y);
    float thickness = mix(.040,.080,random);
    float extension = min(${CORRIDOR_MAX_INSET}-thickness,mix(.010,.035,detail)+bass+kick+build);
    // A rigid cassette translates inward; only its narrower mounting piston stretches.
    depth = aPart.x > 4.5 ? aTile.z * extension : extension + aTile.z * thickness;
    // Reserve a corner gutter: at maximum extension adjacent banks cannot intersect.
    // Uniformly space all four lanes within the gutter, varying actual fixture dimensions.
    float center = (aCell.z + .5) * 2.0 / ${LANES}.0 - 1.0;
    across = ${CORRIDOR_BANK_SPAN} * (center + (aTile.x-center)*mix(.72,1.0,random));
    axial = .5 + (aTile.y-.5)*mix(.66,1.0,detail);
  }
  vec2 p = vec2(across, 1.0 - depth);
  if (bank < 0.5) p = vec2(-p.y, p.x);
  else if (bank < 1.5) p = vec2(p.x, p.y);
  else if (bank < 2.5) p = vec2(p.y, -p.x);
  else p = vec2(-p.x, -p.y);
  p *= uPose.w;
  float s = sin(uPose.y), c = cos(uPose.y);
  p = mat2(c, s, -s, c) * (p - vec2(uPose.z, 0.0));
  vPosition = vec3(p, -(aCell.y + axial) * ${CORRIDOR_BAY_LENGTH} + uPose.x);
  vUV = aUV;
  vCell = aCell;
  vDepth = depth;
  vPart = aPart;
  gl_Position = uProjection * uView * vec4(vPosition, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vPosition;
in float vDepth;
flat in vec3 vCell;
flat in vec2 vPart;
uniform vec4 uLook;    // first world bay, phase, density, intensity
uniform vec4 uAccents; // kick, transient, build, drop
uniform int uPattern;
uniform float uHaze;
uniform float uTravel; // wrapped camera travel, also used for the bay-wide gate
uniform vec3 uVoid;
uniform vec3 uWall;
uniform vec3 uAmber;
uniform vec3 uHot;
uniform vec3 uMarkings;
uniform sampler2D uFeed0;
uniform sampler2D uFeed1;
uniform sampler2D uFeed2;
uniform vec3 uFeedAspect; // zero denotes an unavailable channel
uniform int uFeedCount;
uniform float uPoolStep;
uniform float uCorridorWidth;
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

// At most one of four lanes per bank and bay can carry a picture. The
// original pattern envelope still decides whether that fixture is lit.
// World-space addressing prevents pictures jumping as mesh bays recycle.
float mediaLane(float row, float bank) {
  if (uPattern == 1) return mod(row + bank,4.0); // diagonal relay
  if (uPattern == 2) return mod(row * (bank < 1.5 ? 1.0 : -1.0) + bank,4.0);
  if (uPattern == 3) return mod(bank,2.0) < .5 ? -1.0 : 1.0 + mod(row+bank,2.0);
  if (uPattern == 4) return mod(floor(hash(vec2(row,bank)+81.0)*4.0)+floor(uLook.y*2.0),4.0);
  if (uPattern == 5) return mod(row + 2.0*bank,4.0); // alternating gate spokes
  return mod(row + 3.0*bank,4.0); // staggered night transit
}

vec4 mediaPicture(float bank, float random, float detail, int channel) {
  float aspect = uFeedAspect[channel];
  if (aspect <= 0.0) return vec4(0.0);
  // The four banks have different local orientations. Keep artwork upright
  // relative to the vanishing point, using the actual physical face aspect.
  vec2 uv = (vUV - .135) / .73;
  float across = uCorridorWidth * ${CORRIDOR_BANK_SPAN} * 2.0 / ${LANES}.0 * mix(.72,1.0,random);
  float axial = ${CORRIDOR_BAY_LENGTH} * mix(.66,1.0,detail);
  float screenAspect = across / axial;
  if (bank < .5) { uv = vec2(uv.y,1.0-uv.x); screenAspect = 1.0/screenAspect; }
  else if (bank < 1.5) uv = vec2(uv.x,uv.y);
  else if (bank < 2.5) { uv = vec2(1.0-uv.y,uv.x); screenAspect = 1.0/screenAspect; }
  else uv = vec2(1.0-uv.x,1.0-uv.y);
  // Contain rather than crop logos, SVGs and portrait/landscape video.
  vec2 fit = max(vec2(screenAspect/aspect,aspect/screenAspect),vec2(1.0));
  uv = (uv-.5)*fit+.5;
  if (any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return vec4(0.0,0.0,0.0,1.0);
  // Canonical slot uploads are top-down (UNPACK_FLIP_Y_WEBGL = false).
  vec4 picture;
  if (channel == 0) picture = texture(uFeed0,uv);
  else if (channel == 1) picture = texture(uFeed1,uv);
  else picture = texture(uFeed2,uv);
  // The slot runtime uploads straight-alpha sRGB bytes, not an sRGB texture.
  vec3 linear = mix(picture.rgb/12.92,pow((picture.rgb+.055)/1.055,vec3(2.4)),step(vec3(.04045),picture.rgb));
  return vec4(linear,picture.a);
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

// Use the same pattern and musical accents for the diffuser and nearby reflected light.
float panelLevel(float row, float bank, float lane, float random, float distanceIn, float bayCenter) {
  float level = selection(row,bank,lane,random,uLook.z);
  float guide = step(.90,random)*smoothstep(9.0,22.0,distanceIn)*.16;
  float bassHit = uAccents.x * (bank < .5 || bank > 2.5 ? .66 : .24) * exp(-distanceIn*.20);
  float nearbyBuild = uAccents.z * (1.0-smoothstep(1.8,10.0,distanceIn))*.50;
  float ringDepth = mix(1.55,4.25,clamp(uAccents.w,0.0,1.0));
  float ring = uAccents.w * exp(-pow((bayCenter / ${CORRIDOR_BAY_LENGTH} - ringDepth) / .54,2.0));
  return max(guide,max(level + bassHit + nearbyBuild,ring*1.28));
}
vec3 panelColor(float detail, float ring) {
  float warm = mix(.16,.88,smoothstep(.57,.94,detail));
  return mix(uAmber,uHot,warm + (1.0-warm)*min(1.0,ring*.75));
}
vec3 neighborLight(float row, float bank, float lane, float edgeIndex, float bayCenter) {
  // Edges 0/2 face adjacent bays; edges 1/3 face adjacent lanes (wrapping across corners).
  if (edgeIndex < .5) { row -= 1.0; bayCenter -= ${CORRIDOR_BAY_LENGTH}; }
  else if (edgeIndex < 1.5) { lane += 1.0; }
  else if (edgeIndex < 2.5) { row += 1.0; bayCenter += ${CORRIDOR_BAY_LENGTH}; }
  else { lane -= 1.0; }
  if (lane < 0.0) { lane = ${LANES-1}.0; bank = mod(bank+3.0,4.0); }
  if (lane >= ${LANES}.0) { lane = 0.0; bank = mod(bank+1.0,4.0); }
  vec2 id = vec2(mod(row,4096.0),bank*13.5+lane);
  float level = panelLevel(id.x,bank,lane,hash(id+1.3),max(0.0,bayCenter),bayCenter);
  return panelColor(hash(id+31.5),0.0) * smoothstep(.18,.34,level) * min(1.0,level);
}

void main() {
  float bank = vCell.x, row = mod(vCell.y + uLook.x,4096.0), lane = vCell.z;
  vec2 id = vec2(row,bank*13.5+lane);
  float random = hash(id + 1.3);
  float detail = hash(id + 31.5);
  float distanceIn = max(0.0,-vPosition.z);
  // Center is independent of per-module axial scaling, keeping pattern and gate selection coherent.
  float bayCenter = (vCell.y + .5) * ${CORRIDOR_BAY_LENGTH} - uTravel;
  float level = panelLevel(row,bank,lane,random,distanceIn,bayCenter);
  float ringDepth = mix(1.55,4.25,clamp(uAccents.w,0.0,1.0));
  float ring = uAccents.w * exp(-pow((bayCenter / ${CORRIDOR_BAY_LENGTH} - ringDepth) / .54,2.0));
  float fixture = smoothstep(.18,.34,level);
  vec2 local = vUV - .5;
  vec2 size = vec2(.365,.365);
  float lamp = boxSdf(local,size,.014);
  float aa = max(fwidth(lamp),.0008);
  float diffuser = 1.0-smoothstep(-aa,aa,lamp);
  float seam = min(min(vUV.x,1.0-vUV.x),min(vUV.y,1.0-vUV.y));
  float gasket = mix(.14,1.0,smoothstep(.010,.030,seam));
  float brushed = hash(vec2(floor(vUV.x*94.0),floor(vUV.y*405.0)) + id*9.0);
  vec3 lampColor = panelColor(detail,ring);
  float stipple = mix(.90,1.0,hash(floor(vUV*vec2(92.0,146.0))+id));
  float spill = exp(-max(lamp,0.0)*14.0) * fixture;
  vec3 metal;
  vec3 emission = vec3(0.0);
  vec3 marking = vec3(0.0);
  vec4 mediaOverlay = vec4(0.0);
  if (vPart.x < .5) {
    // Continuous graphite backing stays behind the independently moving modules.
    metal = uWall * (.18 + .10*brushed) * gasket;
    metal += lampColor * fixture * uLook.w * .045 * exp(-max(lamp,0.0)*6.0);
  } else if (vPart.x < 2.5 || vPart.x > 4.5) {
    // Physical sidewalls and chamfered metal catch the neighbouring panels' colors.
    // This is bounded local spill, not an additional emissive face or global light pass.
    vec3 neighbor = neighborLight(row,bank,lane,vPart.y,bayCenter);
    float shoulder = smoothstep(.006,.09,vDepth);
    float facing = (vPart.y < .5 || (vPart.y > 1.5 && vPart.y < 2.5)) ? 1.0 : .68;
    if (vPart.x > 4.5) facing *= .55;
    float bevel = 1.0-step(.5,abs(vPart.x-2.0));
    metal = uWall * (.24 + .24*brushed + .18*shoulder + .44*bevel) * facing;
    metal += (neighbor * (.22+.17*bevel) + lampColor * fixture * (.09+.11*bevel))
      * uLook.w * (.40+.60*shoulder) * facing;
  } else if (vPart.x < 3.5) {
    // Secondary source sits below the outer lip and below the main face.
    metal = uWall * (.12 + .13*brushed);
    emission = lampColor * fixture * min(1.6,(.26+.68*level)*uLook.w);
  } else {
    float edge = exp(-abs(lamp-.016)*42.0) * fixture;
    metal = uWall * (.28 + .12*brushed + .18*spill);
    metal += lampColor * (edge*.19+spill*.045) * uLook.w;
    float warmGrain = (1.0-smoothstep(.21,.48,length(local))) * .14 + stipple;
    emission = lampColor * diffuser * fixture * min(5.5,(.50+2.95*level)*uLook.w) * warmGrain;
    if (uFeedCount > 0 && lane == mediaLane(row,bank) && fixture > .001 && diffuser > .001) {
      int channel = int(mod(row + bank*2.0 + uPoolStep,float(uFeedCount)));
      vec4 picture = mediaPicture(bank,random,detail,channel);
      // The choreography still recruits the panel; its coverage is not an
      // exposure multiplier. Keep source white at linear 1 (below the bloom
      // threshold), and never bleed the drop ring through an opaque picture.
      // Straight alpha reveals the original fixture only where the art permits.
      mediaOverlay = vec4(picture.rgb,picture.a*diffuser*fixture);
    }
    float mark = motif(local,hash(id + 67.0));
    float annotation = step(.60,detail) * (1.0-fixture) * (0.62 + .30 * uAccents.y);
    marking = mark * annotation * uMarkings * uLook.w;
  }
  float vignette = exp(-pow(distanceIn * (.034 + uHaze *.13),1.34));
  float apertureFade = 1.0-smoothstep(24.0,33.0,distanceIn);
  float depthFade = mix(.67,1.0,smoothstep(.75,4.6,distanceIn));
  vec3 surface = mix(metal+emission+marking,mediaOverlay.rgb,mediaOverlay.a);
  outColor = vec4(mix(uVoid,surface,vignette*apertureFade*depthFade),1.0);
}`

// Static mesh: wall backing, telescoping housing, beveled lip, recessed LED channel,
// and diffuser. Depth is animated in the vertex shader, with no per-frame buffer uploads.
export const CORRIDOR_VERTEX_FLOATS = 10
export function buildCorridorGeometry() {
  const data: number[] = []
  for (let bank = 0; bank < 4; bank++) {
    for (let bay = 0; bay < BAY_COUNT; bay++) {
      for (let lane = 0; lane < LANES; lane++) {
        const rim = (border: number, depth: number) => [[border,border,depth],[1-border,border,depth],[1-border,1-border,depth],[border,1-border,depth]]
        const wall = rim(0,0)
        const pistonBase = rim(.17,0)
        const pistonTop = rim(.17,1)
        const rear = rim(.17,0)
        const foot = rim(.025,0)
        const shoulder = rim(.025,.80)
        const lip = rim(.045,1)
        const channelOuter = rim(.058,.84)
        const channelInner = rim(.080,.84)
        const face = rim(.098,.94)
        const vertex = ([u,v,depth]: number[], part: number, side: number) =>
          data.push((lane+u!)*2/LANES-1,v!,depth!,u!,v!,bank,bay,lane,part,side)
        const quad = (points: number[][], part: number) => {
          for (const index of [0,1,2,0,2,3]) vertex(points[index]!,part,0)
        }
        const band = (a: number[][], b: number[][], part: number) => {
          for (let corner = 0; corner < 4; corner++) {
            const next = (corner+1)%4
            for (const point of [a[corner],a[next],b[next],a[corner],b[next],b[corner]]) vertex(point!,part,corner)
          }
        }
        quad(wall,0)
        band(pistonBase,pistonTop,5)
        band(rear,foot,1)
        band(foot,shoulder,1)
        band(shoulder,lip,2)
        band(lip,channelOuter,2)
        band(channelOuter,channelInner,3)
        band(channelInner,face,2)
        quad(face,4)
      }
    }
  }
  return Float32Array.from(data)
}

export class Cinema2CorridorRenderer {
  private readonly vao: WebGLVertexArrayObject
  private readonly buffer: WebGLBuffer
  private readonly program: ShaderProgram
  private readonly emptyFeed: WebGLTexture
  private readonly guard: Cinema2GlStateGuard
  private readonly count: number
  readonly bytes: number

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.guard = new Cinema2GlStateGuard(gl)
    const data = buildCorridorGeometry()
    this.count = data.length / CORRIDOR_VERTEX_FLOATS
    this.bytes = data.byteLength + 4
    this.guard.capture()
    const vao = gl.createVertexArray()
    const buffer = gl.createBuffer()
    const emptyFeed = gl.createTexture()
    try {
      if (!vao || !buffer || !emptyFeed) throw new Error('Corridor could not allocate its cassette mesh.')
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, emptyFeed)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))
      this.emptyFeed = emptyFeed
      const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
        vertSrc: VERTEX, fragSrc: FRAGMENT, label: 'cinema2/corridor',
        requiredUniforms: ['uView', 'uProjection', 'uPose', 'uLook', 'uAccents', 'uMechanical', 'uTravel', 'uPattern', 'uHaze', 'uVoid', 'uWall', 'uAmber', 'uHot', 'uMarkings', 'uFeed0', 'uFeed1', 'uFeed2', 'uFeedAspect', 'uFeedCount', 'uPoolStep', 'uCorridorWidth'],
      })
      if (!compiled.program) throw new Error(compiled.error.log)
      this.program = compiled.program
      this.vao = vao
      this.buffer = buffer
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      for (const [index, size, offset] of [[0,3,0],[1,2,12],[2,3,20],[3,2,32]]) {
        gl.enableVertexAttribArray(index!)
        gl.vertexAttribPointer(index!,size!,gl.FLOAT,false,CORRIDOR_VERTEX_FLOATS * 4,offset!)
      }
    } catch (error) {
      gl.deleteVertexArray(vao)
      gl.deleteBuffer(buffer)
      gl.deleteTexture(emptyFeed)
      throw error
    } finally {
      this.guard.restore()
    }
  }

  draw(execution: Cinema2ModuleRenderExecutionContext, look: Readonly<CorridorLook>,
    feeds: readonly (Readonly<Cinema2ManagedMediaResource> | null)[] = [], poolStep = 0) {
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
      program.setVec2('uMechanical',look.bass,look.extensionBuild)
      program.setFloat('uTravel',look.travel - bay * CORRIDOR_BAY_LENGTH)
      program.setInt('uPattern',CORRIDOR_PATTERNS.findIndex(pattern => pattern.value === look.pattern))
      program.setFloat('uHaze',look.haze)
      for (const [name,value] of [['uVoid',look.voidColor],['uWall',look.wall],['uAmber',look.amber],['uHot',look.hot],['uMarkings',look.markings]] as const) {
        program.setVec3(name,value[0],value[1],value[2])
      }
      const aspect = (index: number) => {
        const feed = feeds[index]
        return feed ? feed.width / Math.max(1, feed.height) : 0
      }
      program.setVec3('uFeedAspect',aspect(0),aspect(1),aspect(2))
      program.setInt('uFeedCount',Math.min(3,feeds.length))
      program.setFloat('uPoolStep',poolStep)
      program.setFloat('uCorridorWidth',look.width)
      for (let index = 0; index < 3; index++) {
        gl.activeTexture(gl.TEXTURE0 + index)
        gl.bindTexture(gl.TEXTURE_2D,feeds[index]?.texture ?? this.emptyFeed)
        program.setInt(`uFeed${index}`,index)
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
    this.gl.deleteTexture(this.emptyFeed)
  }
}
