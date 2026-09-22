import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2Color,
  type Cinema2JsonValue,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
  Cinema2ModuleUpdateContext,
} from './Cinema2ModuleContracts'
import {
  Cinema2InterlockClockResolver,
  resolveCinema2InterlockBackgroundClockTime,
} from './interlock/Cinema2InterlockClock'

export const CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('interlock-liquid-light-render')
export const CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION = 1 as const

export const CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODES = Object.freeze(['auto', 'manual'] as const)
export type Cinema2InterlockBackgroundPaletteMode = (typeof CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODES)[number]

export const CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS = Object.freeze({
  paletteMode: 'auto' as Cinema2InterlockBackgroundPaletteMode,
  backgroundColor: Object.freeze([0.008, 0.018, 0.038, 1]) as Cinema2Color,
  backgroundAccent: Object.freeze([0.04, 0.56, 0.78, 1]) as Cinema2Color,
  atmosphere: 0.25,
  flow: 0.18,
  centerGlow: 0.38,
  edgeDarkness: 0.55,
  backgroundEnergy: 0,
  backgroundBassExpansion: 0,
  backgroundFlux: 0,
  backgroundBuild: 0,
  backgroundDropImpact: 0,
  backgroundVocalRestraint: 0,
  bpmSync: true,
})

const REQUIRED_PARAMETERS = Object.freeze([
  'paletteMode',
  'ledColor',
  'backgroundColor',
  'backgroundAccent',
  'atmosphere',
  'flow',
  'centerGlow',
  'edgeDarkness',
  'backgroundEnergy',
  'backgroundBassExpansion',
  'backgroundFlux',
  'backgroundBuild',
  'backgroundDropImpact',
  'backgroundVocalRestraint',
  'bpmSync',
] as const)

const LIQUID_LIGHT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_baseColor;
uniform vec3 u_accentColor;
uniform float u_atmosphere;
uniform float u_flow;
uniform float u_centerGlow;
uniform float u_edgeDarkness;
uniform float u_backgroundEnergy;
uniform float u_backgroundBassExpansion;
uniform float u_backgroundFlux;
uniform float u_backgroundBuild;
uniform float u_backgroundDropImpact;
uniform float u_backgroundVocalRestraint;
out vec4 outColor;

float saturate(float value) { return clamp(value, 0.0, 1.0); }

void main() {
  vec2 uv = v_uv;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / max(1.0, u_resolution.y);

  float atmosphere = saturate(u_atmosphere);
  // Atmosphere is the canonical hierarchy control: zero becomes an almost-static dark
  // field, while higher values progressively reveal the liquid motion instead of merely
  // changing brightness on an always-animated background.
  float atmosphereMotion = atmosphere * (0.25 + atmosphere * 0.75);
  float flowRate = 0.72 * saturate(u_flow) * atmosphereMotion;
  float t = u_time * flowRate;
  float energy = saturate(u_backgroundEnergy);
  float bassExpansion = saturate(u_backgroundBassExpansion);
  float flux = saturate(u_backgroundFlux);
  float build = saturate(u_backgroundBuild);
  float impact = saturate(u_backgroundDropImpact);
  float vocalRestraint = saturate(u_backgroundVocalRestraint);

  vec2 q = p;
  q.x += sin(p.y * 1.35 + t * 0.63) * atmosphereMotion * (0.10 + 0.05 * u_flow);
  q.y += sin(p.x * 1.18 - t * 0.49) * atmosphereMotion * (0.09 + 0.045 * u_flow);
  q += vec2(
    sin((p.x + p.y) * 0.78 + t * 0.31),
    cos((p.x - p.y) * 0.72 - t * 0.28)
  ) * (0.065 * atmosphereMotion);

  float ribbonA = 0.5 + 0.5 * sin(q.x * 2.15 + sin(q.y * 1.32 + t * 0.47) * 1.45 + t * 0.38);
  float ribbonB = 0.5 + 0.5 * sin(q.y * 1.88 + cos(q.x * 1.12 - t * 0.33) * 1.28 - t * 0.29);
  float ribbon = smoothstep(0.48, 0.93, ribbonA * 0.62 + ribbonB * 0.38);
  float broadGlow = 1.0 - smoothstep(0.08 + bassExpansion * 0.08, 1.24 + bassExpansion * 0.18, length(p * vec2(0.76, 0.93)));
  float center = exp(-dot(p, p) * mix(3.0, 1.65, bassExpansion)) * saturate(u_centerGlow);
  float edge = smoothstep(0.44, 1.36, length(p * vec2(0.72, 0.95)));

  float reactiveLift = (energy * 0.12 + build * 0.08 + flux * 0.07 + impact * 0.12) * (0.25 + atmosphere * 0.75);
  float restraint = 1.0 - vocalRestraint * 0.28;
  float field = saturate((ribbon * 0.52 + broadGlow * 0.34 + center * 0.58) * (0.06 + atmosphere * 0.62 + reactiveLift)) * restraint;

  vec3 secondaryAccent = mix(u_accentColor, u_accentColor.brg, 0.36);
  float secondary = smoothstep(0.56, 0.96, ribbonB) * atmosphere * 0.16;
  vec3 color = u_baseColor;
  color += u_accentColor * field * (0.08 + atmosphere * 0.24);
  color += secondaryAccent * secondary;
  color += u_accentColor * center * atmosphere * (0.025 + impact * 0.055);
  color *= 1.0 - saturate(u_edgeDarkness) * edge * 0.64;
  color = min(color, vec3(0.56));

  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

type Rgb = readonly [number, number, number]

interface FrameConfig {
  readonly paletteMode: Cinema2InterlockBackgroundPaletteMode
  readonly ledColor: Cinema2Color
  readonly backgroundColor: Cinema2Color
  readonly backgroundAccent: Cinema2Color
  readonly atmosphere: number
  readonly flow: number
  readonly centerGlow: number
  readonly edgeDarkness: number
  readonly backgroundEnergy: number
  readonly backgroundBassExpansion: number
  readonly backgroundFlux: number
  readonly backgroundBuild: number
  readonly backgroundDropImpact: number
  readonly backgroundVocalRestraint: number
  readonly bpmSync: boolean
}

export interface Cinema2InterlockLiquidLightPalette {
  readonly base: Cinema2Color
  readonly accent: Cinema2Color
}

export function deriveCinema2InterlockLiquidLightPalette(
  ledColor: Cinema2Color,
  mode: Cinema2InterlockBackgroundPaletteMode = 'auto',
  manualBase: Cinema2Color = CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundColor,
  manualAccent: Cinema2Color = CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundAccent,
): Readonly<Cinema2InterlockLiquidLightPalette> {
  if (mode === 'manual') return Object.freeze({ base: clampColor(manualBase), accent: clampColor(manualAccent) })

  const rgb: Rgb = [clamp01(ledColor[0]), clamp01(ledColor[1]), clamp01(ledColor[2])]
  const [hue, saturation, lightness] = rgbToHsl(rgb)
  const nearNeutral = saturation < 0.12 || lightness > 0.86
  if (nearNeutral) {
    return Object.freeze({
      base: Object.freeze([0.008, 0.022, 0.052, 1]) as Cinema2Color,
      accent: Object.freeze([0.035, 0.56, 0.78, 1]) as Cinema2Color,
    })
  }

  const base = hslToColor(hue + 8, Math.min(0.58, Math.max(0.28, saturation * 0.58)), 0.048)
  const accentOffset = saturation > 0.64 ? 42 : 156
  const accent = hslToColor(hue + accentOffset, Math.min(0.78, Math.max(0.46, saturation * 0.82)), 0.36)
  return Object.freeze({ base, accent })
}

function validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  const parameters = module.parameters ?? {}
  for (const property of REQUIRED_PARAMETERS) {
    if (parameters[property] === undefined) diagnostics.push({
      code: 'CINEMA2_INTERLOCK_LIQUID_LIGHT_PARAMETER_MISSING',
      path: `$.parameters.${property}`,
      message: `Interlock liquid-light renderer requires the "${property}" parameter.`,
    })
  }
  if (parameters.paletteMode !== undefined && !isPaletteMode(parameters.paletteMode)) diagnostics.push({
    code: 'CINEMA2_INTERLOCK_LIQUID_LIGHT_PALETTE_MODE_INVALID',
    path: '$.parameters.paletteMode',
    message: 'Interlock liquid-light palette mode must be "auto" or "manual".',
  })
  for (const property of ['ledColor', 'backgroundColor', 'backgroundAccent'] as const) {
    if (parameters[property] !== undefined && !isColor(parameters[property])) diagnostics.push({
      code: 'CINEMA2_INTERLOCK_LIQUID_LIGHT_COLOR_INVALID',
      path: `$.parameters.${property}`,
      message: `Interlock liquid-light "${property}" must contain four finite normalized color values.`,
    })
  }
  for (const property of [
    'atmosphere', 'flow', 'centerGlow', 'edgeDarkness', 'backgroundEnergy', 'backgroundBassExpansion',
    'backgroundFlux', 'backgroundBuild', 'backgroundDropImpact', 'backgroundVocalRestraint',
  ] as const) {
    if (parameters[property] !== undefined && !numberInRange(parameters[property], 0, 1)) diagnostics.push({
      code: 'CINEMA2_INTERLOCK_LIQUID_LIGHT_PARAMETER_INVALID',
      path: `$.parameters.${property}`,
      message: `Interlock liquid-light "${property}" must be between 0 and 1.`,
    })
  }
  if (parameters.bpmSync !== undefined && typeof parameters.bpmSync !== 'boolean') diagnostics.push({
    code: 'CINEMA2_INTERLOCK_LIQUID_LIGHT_PARAMETER_INVALID',
    path: '$.parameters.bpmSync',
    message: 'Interlock liquid-light "bpmSync" must be boolean.',
  })
  if (module.config && Object.keys(module.config).length > 0) diagnostics.push({
    code: 'CINEMA2_INTERLOCK_LIQUID_LIGHT_CONFIG_UNSUPPORTED',
    path: '$.config',
    message: 'Interlock liquid-light does not accept module-local config; authored state belongs in parameters.',
  })
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic)))
}

function createProgram(gl: WebGL2RenderingContext): ShaderProgram {
  const requiredUniforms = [
    'u_resolution', 'u_time', 'u_baseColor', 'u_accentColor', 'u_atmosphere', 'u_flow', 'u_centerGlow', 'u_edgeDarkness',
    'u_backgroundEnergy', 'u_backgroundBassExpansion', 'u_backgroundFlux', 'u_backgroundBuild', 'u_backgroundDropImpact',
    'u_backgroundVocalRestraint',
  ]
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
    label: 'Cinema2/Interlock/LiquidLight',
    vertSrc: FULLSCREEN_VERT_SRC,
    fragSrc: LIQUID_LIGHT_FRAGMENT_SOURCE,
    requiredUniforms,
  })
  if (!result.program) throw new Error(`Interlock liquid-light shader failed at ${result.error.stage}: ${result.error.log}`)
  return result.program
}

export const cinema2InterlockLiquidLightModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_TYPE_ID,
  version: CINEMA2_INTERLOCK_LIQUID_LIGHT_MODULE_VERSION,
  validate,
  create: (context: Cinema2ModuleCreateContext) => {
    let config = readFrameConfig(context)
    let flowTimeSec = 0
    const clockResolver = new Cinema2InterlockClockResolver()
    let disposed = false

    const provider = Object.freeze({
      id: `${context.module.id}:interlock-liquid-light`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute({ target, width, height }: Cinema2ModuleRenderExecutionContext) {
        if (disposed) return
        const program = context.resources.acquire(
          'interlock-liquid-light-program',
          'ShaderProgram',
          gl => createProgram(gl),
          value => value.dispose(),
        )
        const pass = context.resources.acquire(
          'interlock-liquid-light-pass',
          'FullscreenPass',
          gl => new FullscreenPass(gl),
          value => value.dispose(),
        )
        const palette = deriveCinema2InterlockLiquidLightPalette(
          config.ledColor,
          config.paletteMode,
          config.backgroundColor,
          config.backgroundAccent,
        )
        program.activate()
        program.setVec2('u_resolution', width, height)
        program.setFloat('u_time', flowTimeSec)
        program.setVec3('u_baseColor', palette.base[0], palette.base[1], palette.base[2])
        program.setVec3('u_accentColor', palette.accent[0], palette.accent[1], palette.accent[2])
        program.setFloat('u_atmosphere', config.atmosphere)
        program.setFloat('u_flow', config.flow)
        program.setFloat('u_centerGlow', config.centerGlow)
        program.setFloat('u_edgeDarkness', config.edgeDarkness)
        program.setFloat('u_backgroundEnergy', config.backgroundEnergy)
        program.setFloat('u_backgroundBassExpansion', config.backgroundBassExpansion)
        program.setFloat('u_backgroundFlux', config.backgroundFlux)
        program.setFloat('u_backgroundBuild', config.backgroundBuild)
        program.setFloat('u_backgroundDropImpact', config.backgroundDropImpact)
        program.setFloat('u_backgroundVocalRestraint', config.backgroundVocalRestraint)
        pass.run(program, target, width, height, [])
      },
    })

    return {
      lifecycle: {
        update(updateContext: Cinema2ModuleUpdateContext) {
          if (disposed) return
          config = readFrameConfig(updateContext)
          const { frame } = updateContext
          const clock = clockResolver.resolve(frame, config.bpmSync)
          flowTimeSec = resolveCinema2InterlockBackgroundClockTime(clock, config.flow)
        },
        dispose() {
          disposed = true
          flowTimeSec = 0
          clockResolver.reset()
        },
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

function readFrameConfig(
  source: Pick<Cinema2ModuleCreateContext, 'parameters'> | Pick<Cinema2ModuleUpdateContext, 'parameters'>,
): FrameConfig {
  return Object.freeze({
    paletteMode: isPaletteMode(source.parameters.get('paletteMode')) ? source.parameters.get('paletteMode') as Cinema2InterlockBackgroundPaletteMode : 'auto',
    ledColor: colorValue(source.parameters.get('ledColor'), Object.freeze([0.94, 0.98, 1, 1]) as Cinema2Color),
    backgroundColor: colorValue(source.parameters.get('backgroundColor'), CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundColor),
    backgroundAccent: colorValue(source.parameters.get('backgroundAccent'), CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.backgroundAccent),
    atmosphere: clamp01(numberValue(source.parameters.get('atmosphere'), CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.atmosphere)),
    flow: clamp01(numberValue(source.parameters.get('flow'), CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.flow)),
    centerGlow: clamp01(numberValue(source.parameters.get('centerGlow'), CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.centerGlow)),
    edgeDarkness: clamp01(numberValue(source.parameters.get('edgeDarkness'), CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.edgeDarkness)),
    backgroundEnergy: clamp01(numberValue(source.parameters.get('backgroundEnergy'), 0)),
    backgroundBassExpansion: clamp01(numberValue(source.parameters.get('backgroundBassExpansion'), 0)),
    backgroundFlux: clamp01(numberValue(source.parameters.get('backgroundFlux'), 0)),
    backgroundBuild: clamp01(numberValue(source.parameters.get('backgroundBuild'), 0)),
    backgroundDropImpact: clamp01(numberValue(source.parameters.get('backgroundDropImpact'), 0)),
    backgroundVocalRestraint: clamp01(numberValue(source.parameters.get('backgroundVocalRestraint'), 0)),
    bpmSync: booleanValue(source.parameters.get('bpmSync'), CINEMA2_INTERLOCK_LIQUID_LIGHT_DEFAULTS.bpmSync),
  })
}

function isPaletteMode(value: unknown): value is Cinema2InterlockBackgroundPaletteMode {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_BACKGROUND_PALETTE_MODES as readonly string[]).includes(value)
}


function isColor(value: unknown): value is Cinema2Color {
  return Array.isArray(value) && value.length === 4 && value.every(entry => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 1)
}

function colorValue(value: Cinema2JsonValue | undefined, fallback: Cinema2Color): Cinema2Color {
  return isColor(value) ? Object.freeze([value[0], value[1], value[2], value[3]]) as Cinema2Color : fallback
}

function clampColor(color: Cinema2Color): Cinema2Color {
  return Object.freeze([clamp01(color[0]), clamp01(color[1]), clamp01(color[2]), clamp01(color[3])]) as Cinema2Color
}

function numberValue(value: Cinema2JsonValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function numberInRange(value: unknown, minimum: number, maximum: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function booleanValue(value: Cinema2JsonValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) }

function rgbToHsl(color: Rgb): readonly [number, number, number] {
  const [r, g, b] = color
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2
  if (delta <= 1e-6) return [0, 0, lightness]
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360
  return [hue, clamp01(saturation), clamp01(lightness)]
}

function hslToColor(hueDegrees: number, saturation: number, lightness: number): Cinema2Color {
  const h = (((hueDegrees % 360) + 360) % 360) / 360
  const s = clamp01(saturation)
  const l = clamp01(lightness)
  if (s <= 1e-6) return Object.freeze([l, l, l, 1]) as Cinema2Color
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return Object.freeze([hueChannel(p, q, h + 1 / 3), hueChannel(p, q, h), hueChannel(p, q, h - 1 / 3), 1]) as Cinema2Color
}

function hueChannel(p: number, q: number, input: number): number {
  let t = input
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}
