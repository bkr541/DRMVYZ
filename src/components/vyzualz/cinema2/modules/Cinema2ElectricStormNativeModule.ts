import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleUpdateContext,
  Cinema2ModuleTypeDefinition,
} from './Cinema2ModuleContracts'
import {
  CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES,
  Cinema2ElectricStormStrikeGenerator,
  type Cinema2ElectricStormStrikeDescriptor,
} from './Cinema2ElectricStormStrikeGenerator'
import { Cinema2ElectricStormThunderController } from './Cinema2ElectricStormThunder'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'

export const CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('electric-storm-native-render')
export const CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_VERSION = 1 as const

const ELECTRIC_STORM_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_background;
uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform float u_exposure;
uniform vec3 u_lightningBody;
uniform vec3 u_lightningCore;
uniform vec3 u_lightningGlowColor;
uniform vec3 u_lightningBranchColor;
uniform float u_masterIntensity;
uniform float u_branching;
uniform float u_thickness;
uniform float u_glowAmount;
uniform float u_impactShake;
uniform float u_zoomPunch;
uniform float u_impactStrength;
uniform float u_thunderFlash;
uniform vec4 u_strikeLine0;
uniform vec4 u_strikeMeta0;
uniform vec4 u_strikeStyle0;
uniform vec4 u_strikeLine1;
uniform vec4 u_strikeMeta1;
uniform vec4 u_strikeStyle1;
uniform vec4 u_strikeLine2;
uniform vec4 u_strikeMeta2;
uniform vec4 u_strikeStyle2;
out vec4 outColor;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise21(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i); float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)); float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm21(vec2 p) {
  float total = 0.0; float amplitude = 0.5; mat2 basis = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) { total += noise21(p) * amplitude; p = basis * p * 2.03 + vec2(7.1, 3.7); amplitude *= 0.5; }
  return total;
}
mat2 rotate2d(float angle) { float c = cos(angle); float s = sin(angle); return mat2(c, -s, s, c); }
float stormHash(float value) { return fract(sin(value * 91.3458 + 17.173) * 47453.5453); }
vec2 aspectPoint(vec2 point) { point.x *= u_resolution.x / max(1.0, u_resolution.y); return point; }
float segmentDistance(vec2 p, vec2 a, vec2 b, float seed, float jaggedness) {
  vec2 delta = b - a; float lengthSquared = max(dot(delta, delta), 0.00001);
  float t = clamp(dot(p - a, delta) / lengthSquared, 0.0, 1.0);
  vec2 tangent = normalize(delta + vec2(0.00001, 0.0)); vec2 normal = vec2(-tangent.y, tangent.x);
  float envelope = sin(t * 3.14159265);
  float coarse = sin(t * 21.0 + seed * 13.1) * 0.62;
  float fine = sin(t * 53.0 + seed * 37.7) * 0.26;
  float micro = sin(t * 113.0 + seed * 71.3) * 0.12;
  vec2 nearest = mix(a, b, t) + normal * (coarse + fine + micro) * envelope * jaggedness;
  return length(p - nearest);
}
float strikeEnvelope(float age, float duration) {
  if (age < 0.0 || age > duration || duration <= 0.0) return 0.0;
  float normalizedAge = age / duration;
  float attack = smoothstep(0.0, 0.055, normalizedAge);
  float decay = exp(-normalizedAge * 2.8);
  float flicker = 0.91 + 0.09 * sin(age * 430.0);
  return attack * decay * flicker;
}
vec3 renderStrike(vec2 p, vec4 line, vec4 meta, vec4 style, float slot) {
  float age = meta.x; float duration = meta.y; float strength = meta.z; float seed = meta.w + slot * 17.0;
  float branchSeed = style.x + slot * 29.0; float branchDetail = clamp(style.y, 0.0, 1.0);
  float thicknessMultiplier = max(0.35, style.z); float glowMultiplier = max(0.35, style.w);
  float envelope = strikeEnvelope(age, duration) * strength * u_masterIntensity;
  if (envelope <= 0.0001) return vec3(0.0);
  vec2 a = aspectPoint(line.xy); vec2 b = aspectPoint(line.zw);
  float jaggedness = mix(0.014, 0.068, clamp(u_branching * mix(0.72, 1.18, branchDetail), 0.0, 1.0));
  float distanceToBolt = segmentDistance(p, a, b, seed, jaggedness);
  float masterGeometry = mix(0.72, 1.18, u_masterIntensity);
  float coreWidth = mix(0.0018, 0.0085, u_thickness) * masterGeometry * thicknessMultiplier;
  float bodyWidth = coreWidth * mix(2.4, 3.6, u_thickness);
  float haloWidth = bodyWidth * mix(4.5, 12.0, u_glowAmount) * glowMultiplier;
  float core = exp(-distanceToBolt * distanceToBolt / max(coreWidth * coreWidth, 0.000001));
  float body = exp(-distanceToBolt * distanceToBolt / max(bodyWidth * bodyWidth, 0.000001));
  float halo = exp(-distanceToBolt * distanceToBolt / max(haloWidth * haloWidth, 0.000001));
  vec3 color = u_lightningCore * core * 1.55 + u_lightningBody * body * 1.02 + u_lightningGlowColor * halo * (0.2 + u_glowAmount * 0.9);
  vec2 mainDelta = b - a; vec2 mainTangent = normalize(mainDelta + vec2(0.00001, 0.0)); float mainLength = length(mainDelta);
  for (int branchIndex = 0; branchIndex < 4; branchIndex++) {
    float fi = float(branchIndex);
    float effectiveBranching = clamp(u_branching * mix(0.62, 1.0, u_masterIntensity) * mix(0.72, 1.22, branchDetail), 0.0, 1.0);
    float branchGate = step((fi + 0.45) / 4.0, effectiveBranching);
    float branchChance = stormHash(branchSeed + fi * 19.7);
    branchGate *= step(0.22, branchChance + u_branching * 0.42);
    float originT = mix(0.18, 0.82, stormHash(branchSeed + fi * 31.9 + 4.0));
    vec2 origin = mix(a, b, originT);
    float side = stormHash(branchSeed + fi * 43.1 + 9.0) > 0.5 ? 1.0 : -1.0;
    float angle = side * mix(0.42, 1.02, stormHash(branchSeed + fi * 11.3 + 12.0));
    vec2 branchDirection = rotate2d(angle) * mainTangent;
    float branchLength = mainLength * mix(0.13, 0.34, stormHash(branchSeed + fi * 7.1 + 21.0)) * mix(0.78, 1.12, branchDetail);
    vec2 branchEnd = origin + branchDirection * branchLength;
    float branchDistance = segmentDistance(p, origin, branchEnd, seed + fi * 2.7, jaggedness * 0.68);
    float branchWidth = bodyWidth * mix(0.36, 0.62, u_branching);
    float branchBody = exp(-branchDistance * branchDistance / max(branchWidth * branchWidth, 0.000001));
    float branchHaloWidth = branchWidth * (3.0 + u_glowAmount * 5.0);
    float branchHalo = exp(-branchDistance * branchDistance / max(branchHaloWidth * branchHaloWidth, 0.000001));
    color += u_lightningBranchColor * branchBody * branchGate * 0.72;
    color += u_lightningGlowColor * branchHalo * branchGate * u_glowAmount * 0.18;
  }
  return color * envelope;
}
float impactCurve(float value) { float t = clamp(value, 0.0, 1.0); return t * t; }
void main() {
  vec2 uv = v_uv;
  float impact = clamp(u_impactStrength, 0.0, 1.0);
  vec2 shake = vec2(sin(u_time * 91.0 + 0.7) + sin(u_time * 137.0 + 2.1) * 0.45, cos(u_time * 103.0 + 1.3) + cos(u_time * 149.0 + 0.4) * 0.45)
    * impactCurve(u_impactShake) * impact * 0.05;
  float zoomScale = 1.0 - impactCurve(u_zoomPunch) * impact * 0.16;
  uv = vec2(0.5) + (uv - vec2(0.5)) * zoomScale + shake;
  vec2 p = uv * 2.0 - 1.0; p.x *= u_resolution.x / max(1.0, u_resolution.y);
  vec2 hazeUv = uv * vec2(3.1, 2.2) + vec2(u_time * 0.012, -u_time * 0.008);
  float hazeA = fbm21(hazeUv); float hazeB = fbm21(hazeUv * 1.7 - vec2(4.1, 1.8));
  float haze = smoothstep(0.34, 0.78, hazeA * 0.72 + hazeB * 0.38);
  float hazePresence = haze * clamp(u_fogDensity * 2.4, 0.0, 0.32) * (0.45 + u_masterIntensity * 0.55);
  vec3 color = u_background + mix(u_background, u_fogColor, 0.56) * hazePresence;
  float thunderFlash = clamp(u_thunderFlash, 0.0, 1.0);
  color += mix(max(u_background, vec3(0.008)), mix(vec3(1.0), u_lightningGlowColor, 0.42), 0.78) * (0.28 + haze * 0.82 + hazeB * 0.22) * thunderFlash;
  vec3 strikes = renderStrike(p, u_strikeLine0, u_strikeMeta0, u_strikeStyle0, 0.0)
    + renderStrike(p, u_strikeLine1, u_strikeMeta1, u_strikeStyle1, 1.0)
    + renderStrike(p, u_strikeLine2, u_strikeMeta2, u_strikeStyle2, 2.0);
  float strikeIllumination = clamp(max(max(strikes.r, strikes.g), strikes.b), 0.0, 2.5);
  color += strikes + u_lightningGlowColor * haze * strikeIllumination * (0.035 + u_glowAmount * 0.11) * u_masterIntensity;
  float vignette = 1.0 - smoothstep(0.18, 1.48, length(p * vec2(0.73, 0.92)));
  color *= mix(0.82, 1.0, vignette) * max(0.0, u_exposure);
  color = color / (vec3(1.0) + color * 0.32);
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

const REQUIRED_PARAMETERS = [
  'lightningColor', 'masterIntensity', 'strikeRate', 'branching', 'thickness', 'glow', 'impactShake', 'zoomPunch',
  'musicReactivity', 'kickReaction', 'transientReaction', 'dropReaction', 'structureReaction',
] as const

const MAX_PENDING_MUSICAL_STRIKES = 32
const MUSICAL_STRIKE_KINDS = new Set(['kick', 'drop', 'transient', 'downbeat', 'phrase', 'section'])
const MUSICAL_STRIKE_TIERS = new Set(['micro', 'medium', 'strong', 'hero'])

type Cinema2ElectricStormMusicalStrikeKind = 'kick' | 'drop' | 'transient' | 'downbeat' | 'phrase' | 'section'

interface Cinema2ElectricStormMusicalStrikePayload {
  readonly kind: Cinema2ElectricStormMusicalStrikeKind
  readonly tier: Cinema2ElectricStormStrikeDescriptor['tier']
  readonly count?: number
  readonly durationScale?: number
}

interface PendingMusicalStrike {
  readonly eventId: string
  readonly payload: Readonly<Cinema2ElectricStormMusicalStrikePayload>
}

type Rgb = readonly [number, number, number]

function validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  for (const property of REQUIRED_PARAMETERS) {
    if (module.parameters?.[property] === undefined) diagnostics.push({
      code: 'CINEMA2_ELECTRIC_STORM_PARAMETER_MISSING',
      path: `$.parameters.${property}`,
      message: `Electric Storm native module requires the "${property}" parameter.`,
    })
  }
  return Object.freeze(diagnostics.map(entry => Object.freeze(entry)))
}

function numberValue(context: Cinema2ModuleCreateContext, name: string, fallback: number): number {
  const value = context.parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function colorValue(context: Cinema2ModuleCreateContext, name: string, fallback: Cinema2Color): Cinema2Color {
  const value = context.parameters.get(name)
  if (Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    return value as unknown as Cinema2Color
  }
  return fallback
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)) }

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function numericSignalValue(signal: Readonly<{ available: boolean; value: number | null }> | null | undefined): number | null {
  return signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value) ? signal.value : null
}

function parseMusicalStrikePayload(payload: Cinema2DispatchedTargetAction['payload']): Readonly<Cinema2ElectricStormMusicalStrikePayload> | null {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as Readonly<Record<string, unknown>>
  if (typeof record.kind !== 'string' || !MUSICAL_STRIKE_KINDS.has(record.kind)) return null
  if (typeof record.tier !== 'string' || !MUSICAL_STRIKE_TIERS.has(record.tier)) return null
  const count = finiteNumber(record.count)
  const durationScale = finiteNumber(record.durationScale)
  return Object.freeze({
    kind: record.kind as Cinema2ElectricStormMusicalStrikeKind,
    tier: record.tier as Cinema2ElectricStormStrikeDescriptor['tier'],
    ...(count == null ? {} : { count: Math.max(1, Math.min(CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES, Math.round(count))) }),
    ...(durationScale == null ? {} : { durationScale: Math.max(0.4, Math.min(1.35, durationScale)) }),
  })
}

function reactionForKind(parameters: Cinema2ModuleUpdateContext['parameters'], kind: Cinema2ElectricStormMusicalStrikeKind): number {
  const property = kind === 'kick'
    ? 'kickReaction'
    : kind === 'transient'
      ? 'transientReaction'
      : kind === 'drop'
        ? 'dropReaction'
        : 'structureReaction'
  const value = parameters.get(property)
  return clamp01(typeof value === 'number' && Number.isFinite(value) ? value : 0)
}

function musicalStrikeIntent(
  pending: Readonly<PendingMusicalStrike>,
  frame: Readonly<Cinema2ModuleUpdateContext['frame']>,
  parameters: Cinema2ModuleUpdateContext['parameters'],
) {
  const musicReactivity = clamp01(typeof parameters.get('musicReactivity') === 'number' ? parameters.get('musicReactivity') as number : 0)
  const reaction = reactionForKind(parameters, pending.payload.kind)
  if (musicReactivity <= 0 || reaction <= 0) return null

  const intensity = numericSignalValue(frame.director?.continuous.intensity)
  const build = numericSignalValue(frame.director?.context.build)
  const impact = frame.director?.authority.impact.available ? clamp01(frame.director.authority.impact.authority) : null
  const bass = numericSignalValue(frame.audio?.bands.bass)
  const high = numericSignalValue(frame.audio?.bands.high)
  const trackEnergy = numericSignalValue(frame.audio?.features.trackEnergy)

  let significance = 0.5
  if (intensity != null) significance = significance * 0.35 + clamp01(intensity) * 0.65
  if (impact != null) significance = Math.max(significance, impact)
  if (pending.payload.kind === 'drop' && build != null) significance = Math.max(significance, 0.55 + clamp01(build) * 0.35)

  let styleEnergy = significance
  if (bass != null) styleEnergy = styleEnergy * 0.72 + clamp01(bass) * 0.28
  if (trackEnergy != null) styleEnergy = styleEnergy * 0.78 + clamp01(trackEnergy) * 0.22
  const detailAccent = high == null ? 0 : clamp01(high) * 0.18
  const reactionStrength = clamp01(musicReactivity * reaction)
  const power = clamp01((0.42 + significance * 0.58) * (0.58 + reactionStrength * 0.42))
  const detail = clamp01(styleEnergy * 0.82 + detailAccent)

  return Object.freeze({
    tier: pending.payload.tier,
    power,
    detail,
    count: pending.payload.count,
    durationScale: pending.payload.durationScale,
    eventId: pending.eventId,
  })
}

function rgbToHsl(color: Rgb): readonly [number, number, number] {
  const [r, g, b] = color
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2; const delta = max - min
  if (delta <= 0.000001) return [0, 0, l]
  const s = delta / (1 - Math.abs(2 * l - 1))
  let h = max === r ? 60 * (((g - b) / delta) % 6) : max === g ? 60 * (((b - r) / delta) + 2) : 60 * (((r - g) / delta) + 4)
  h = (h + 360) % 360
  return [h, clamp01(s), clamp01(l)]
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t; if (value < 0) value += 1; if (value > 1) value -= 1
  if (value < 1 / 6) return p + (q - p) * 6 * value
  if (value < 1 / 2) return q
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue = ((h % 360) + 360) % 360 / 360; const saturation = clamp01(s); const lightness = clamp01(l)
  if (saturation <= 0.000001) return [lightness, lightness, lightness]
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  return [hueToRgb(p, q, hue + 1 / 3), hueToRgb(p, q, hue), hueToRgb(p, q, hue - 1 / 3)]
}

function mixRgb(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp01(amount)
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function deriveLightningColors(color: Cinema2Color): { body: Rgb; core: Rgb; glow: Rgb; branch: Rgb } {
  const body: Rgb = [color[0], color[1], color[2]]
  const [h, s, l] = rgbToHsl(body); const saturated = Math.max(0.42, s)
  return {
    body,
    core: mixRgb(body, [1, 1, 1], 0.72),
    glow: hslToRgb(h + 24, Math.max(0.48, saturated * 0.86), Math.min(0.78, Math.max(0.48, l + 0.18))),
    branch: hslToRgb(h + 150, Math.max(0.5, saturated * 0.92), Math.min(0.72, Math.max(0.42, l + 0.08))),
  }
}

function strikeImpactStrength(strike: Readonly<Cinema2ElectricStormStrikeDescriptor>, timeSec: number): number {
  const age = timeSec - strike.startedAtSec
  if (age < 0 || age > strike.durationSec || strike.durationSec <= 0) return 0
  const normalizedAge = age / strike.durationSec
  const attack = Math.min(1, normalizedAge / 0.055); const decay = Math.exp(-normalizedAge * 3.4)
  const tier = strike.tier === 'hero' ? 1 : strike.tier === 'strong' ? 0.78 : strike.tier === 'medium' ? 0.34 : 0.16
  return Math.max(0, Math.min(1, attack * decay * tier * (0.55 + strike.power * 0.45)))
}

function setStrikeUniforms(program: ShaderProgram, index: number, strike: Readonly<Cinema2ElectricStormStrikeDescriptor> | undefined, timeSec: number): void {
  if (!strike) {
    program.setVec4(`u_strikeLine${index}`, 0, 0, 0, 0)
    program.setVec4(`u_strikeMeta${index}`, 99, 0, 0, 0)
    program.setVec4(`u_strikeStyle${index}`, 0, 0, 1, 1)
    return
  }
  program.setVec4(`u_strikeLine${index}`, strike.start.x, strike.start.y, strike.end.x, strike.end.y)
  program.setVec4(`u_strikeMeta${index}`, timeSec - strike.startedAtSec, strike.durationSec, strike.intensity, (strike.seed >>> 0) / 4294967296 * 997)
  program.setVec4(`u_strikeStyle${index}`, (strike.branchSeed >>> 0) / 4294967296 * 997, strike.branchDetail, strike.thicknessMultiplier, strike.glowMultiplier)
}

function createProgram(gl: WebGL2RenderingContext): ShaderProgram {
  const requiredUniforms = [
    'u_resolution', 'u_time', 'u_background', 'u_fogColor', 'u_fogDensity', 'u_exposure',
    'u_lightningBody', 'u_lightningCore', 'u_lightningGlowColor', 'u_lightningBranchColor',
    'u_masterIntensity', 'u_branching', 'u_thickness', 'u_glowAmount', 'u_impactShake', 'u_zoomPunch', 'u_impactStrength', 'u_thunderFlash',
    'u_strikeLine0', 'u_strikeMeta0', 'u_strikeStyle0', 'u_strikeLine1', 'u_strikeMeta1', 'u_strikeStyle1', 'u_strikeLine2', 'u_strikeMeta2', 'u_strikeStyle2',
  ]
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: 'Cinema2/ElectricStorm/native', vertSrc: FULLSCREEN_VERT_SRC, fragSrc: ELECTRIC_STORM_FRAGMENT_SOURCE, requiredUniforms })
  if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
  return result.program
}

export const cinema2ElectricStormNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_VERSION,
  validate,
  create: (context: Cinema2ModuleCreateContext) => {
    const strikeGenerator = new Cinema2ElectricStormStrikeGenerator(context.randomness)
    const thunder = new Cinema2ElectricStormThunderController()
    let strikes: readonly Cinema2ElectricStormStrikeDescriptor[] = Object.freeze([])
    let thunderFlash = 0
    let lastDiscontinuitySequence: number | null = null
    const thunderedStrikeKeys = new Set<string>()
    const pendingMusicalStrikes: PendingMusicalStrike[] = []

    const provider = Object.freeze({
      id: `${context.module.id}:electric-storm`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute: ({ frame, target, width, height, lightingEnvironment }: Cinema2ModuleRenderExecutionContext) => {
        const program = context.resources.acquire('electric-storm-program', 'WebGLProgram', gl => createProgram(gl), value => value.dispose())
        const pass = context.resources.acquire('electric-storm-pass', 'FullscreenPass', gl => new FullscreenPass(gl), value => value.dispose())
        const lightning = deriveLightningColors(colorValue(context, 'lightningColor', [0.29, 0.65, 1, 1]))
        const environment = lightingEnvironment?.environment
        const background = environment?.backgroundColor ?? [0, 0, 0, 1]
        const fog = environment?.fog
        const fogColor = fog?.color ?? background
        program.activate()
        program.setVec2('u_resolution', width, height)
        program.setFloat('u_time', frame.elapsedTimeSec)
        program.setVec3('u_background', background[0], background[1], background[2])
        program.setVec3('u_fogColor', fogColor[0], fogColor[1], fogColor[2])
        program.setFloat('u_fogDensity', fog?.density ?? 0)
        program.setFloat('u_exposure', environment?.exposure ?? 1)
        program.setVec3('u_lightningBody', ...lightning.body)
        program.setVec3('u_lightningCore', ...lightning.core)
        program.setVec3('u_lightningGlowColor', ...lightning.glow)
        program.setVec3('u_lightningBranchColor', ...lightning.branch)
        program.setFloat('u_masterIntensity', numberValue(context, 'masterIntensity', 0.82))
        program.setFloat('u_branching', numberValue(context, 'branching', 0.68))
        program.setFloat('u_thickness', numberValue(context, 'thickness', 0.52))
        program.setFloat('u_glowAmount', numberValue(context, 'glow', 0.72))
        program.setFloat('u_impactShake', numberValue(context, 'impactShake', 0.42))
        program.setFloat('u_zoomPunch', numberValue(context, 'zoomPunch', 0.28))
        program.setFloat('u_impactStrength', strikes.reduce((maximum, strike) => Math.max(maximum, strikeImpactStrength(strike, frame.elapsedTimeSec)), 0))
        program.setFloat('u_thunderFlash', thunderFlash)
        for (let index = 0; index < CINEMA2_ELECTRIC_STORM_MAX_ACTIVE_STRIKES; index += 1) setStrikeUniforms(program, index, strikes[index], frame.elapsedTimeSec)
        pass.run(program, target, width, height, [])
      },
    })

    return {
      lifecycle: {
        update: ({ frame, parameters }: Cinema2ModuleUpdateContext) => {
          const sequence = frame.audio?.discontinuity.generation ?? null
          if (frame.audio?.discontinuity.occurred && frame.audio.discontinuity.reason !== 'activation' && sequence !== lastDiscontinuitySequence) {
            strikeGenerator.reset()
            thunder.reset()
            strikes = Object.freeze([])
            pendingMusicalStrikes.splice(0)
            thunderedStrikeKeys.clear()
            lastDiscontinuitySequence = sequence
          }
          while (pendingMusicalStrikes.length > 0) {
            const pending = pendingMusicalStrikes.shift()
            if (!pending) break
            const intent = musicalStrikeIntent(pending, frame, parameters)
            if (intent) strikeGenerator.request(intent)
          }
          const strikeFrame = strikeGenerator.update(frame.elapsedTimeSec, typeof parameters.get('strikeRate') === 'number' ? parameters.get('strikeRate') as number : 0.58)
          strikes = strikeFrame.active
          const activeKeys = new Set<string>()
          for (const strike of strikes) {
            const key = `${strike.startedAtSec}:${strike.seed}`
            activeKeys.add(key)
            if (strike.startedAtSec <= frame.elapsedTimeSec && !thunderedStrikeKeys.has(key)) {
              thunderedStrikeKeys.add(key)
              thunder.trigger(strike)
            }
          }
          for (const key of thunderedStrikeKeys) if (!activeKeys.has(key)) thunderedStrikeKeys.delete(key)
          thunderFlash = thunder.update(frame.deltaTimeSec).illumination
        },
        dispose: () => {
          strikeGenerator.reset()
          thunder.reset()
          strikes = Object.freeze([])
          pendingMusicalStrikes.splice(0)
          thunderedStrikeKeys.clear()
          thunderFlash = 0
        },
      },
      handleAction: (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
        if (action !== 'spawnStrike') return
        const payload = parseMusicalStrikePayload(event.payload)
        if (!payload) return
        if (pendingMusicalStrikes.length >= MAX_PENDING_MUSICAL_STRIKES) pendingMusicalStrikes.shift()
        pendingMusicalStrikes.push(Object.freeze({ eventId: event.eventId, payload }))
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})
