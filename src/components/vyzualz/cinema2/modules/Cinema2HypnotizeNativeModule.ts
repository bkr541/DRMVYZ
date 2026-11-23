import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { Cinema2HypnotizeRenderer, type Cinema2HypnotizeDrawState } from './hypnotize/Cinema2HypnotizeRenderer'
import {
  CINEMA2_HYPNOTIZE_PATTERNS,
  Cinema2HypnotizePatternEngine,
  resolveCinema2HypnotizeLedPowerGatingEnabled,
  resolveCinema2HypnotizeTriggerEventId,
  type Cinema2HypnotizePattern,
} from './hypnotize/Cinema2HypnotizePatternEngine'
import {
  CINEMA2_HYPNOTIZE_QUALITY_RINGS,
  CINEMA2_HYPNOTIZE_TUNNEL,
  buildCinema2HypnotizeTunnelLayout,
  createCinema2HypnotizeTunnelFrame,
  updateCinema2HypnotizeTunnelFrame,
  type Cinema2HypnotizeTunnelLayout,
} from './hypnotize/Cinema2HypnotizeTunnel'

export { CINEMA2_HYPNOTIZE_PATTERNS, type Cinema2HypnotizePattern } from './hypnotize/Cinema2HypnotizePatternEngine'

export const CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('hypnotize-native')
export const CINEMA2_HYPNOTIZE_NATIVE_MODULE_VERSION = 1 as const

const DEFAULT_BODY: Cinema2Color = Object.freeze([0.05, 0.075, 0.11, 1]) as Cinema2Color
const DEFAULT_LIGHT_A: Cinema2Color = Object.freeze([0.1, 0.78, 1, 1]) as Cinema2Color
const DEFAULT_LIGHT_B: Cinema2Color = Object.freeze([0.55, 0.22, 1, 1]) as Cinema2Color
const DEFAULT_CORE: Cinema2Color = Object.freeze([0.9, 0.97, 1, 1]) as Cinema2Color
/** Tunnel scroll in ring spacings per second at Travel 0, and what each point of Travel adds. At the authored Travel of 0.45 the tunnel moves about 0.4 rings a second. */
const SCROLL_BASE = 0.12
const SCROLL_TRAVEL = 0.62
/** Radians per beat per unit of pattern rotation rate. */
const SPIN_PER_BEAT = 1.1
const FOG = 0.034

interface RendererRuntime {
  draw(state: Readonly<Cinema2HypnotizeDrawState>): void
  estimateGpuBytes(): number
  dispose(): void
}

export function createCinema2HypnotizeNativeModuleDefinition(
  options: { createRenderer?: (gl: WebGL2RenderingContext, layout: Readonly<Cinema2HypnotizeTunnelLayout>) => RendererRuntime } = {},
): Readonly<Cinema2ModuleTypeDefinition> {
  const createRenderer = options.createRenderer ?? ((gl, layout) => new Cinema2HypnotizeRenderer(gl, layout))
  return Object.freeze({
    typeId: CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_HYPNOTIZE_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      const layout = buildCinema2HypnotizeTunnelLayout()
      const tunnelFrame = createCinema2HypnotizeTunnelFrame(layout)
      const patternEngine = new Cinema2HypnotizePatternEngine()
      const patternControls = new Cinema2PatternControlResolver<string>()
      const diagnostics: Cinema2ModuleDiagnostic[] = []
      // Motion that must never jump when a control moves: the scroll and the rotation of the even and odd rings are accumulated here.
      let scroll = 0
      let rotationEven = 0
      let rotationOdd = 0
      let lastBeats: number | null = null

      const renderer = context.resources.acquire(
        'hypnotize:ring-tunnel:v1',
        'Cinema2HypnotizeRenderer',
        gl => createRenderer(gl, layout),
        value => value.dispose(),
      )
      context.resources.reportGpuBytes(renderer.estimateGpuBytes())

      const provider = Object.freeze({
        id: `${context.module.id}:hypnotize-ring-tunnel`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          if (!execution.depthAvailable) throw new Error(`Cinema 2.0 Hypnotize module "${context.module.id}" requires a render target with a depth attachment.`)
          if (!execution.camera) throw new Error(`Cinema 2.0 Hypnotize module "${context.module.id}" requires final Camera Runtime state.`)
          const parameters = context.parameters
          const authoredPattern = readPattern(parameters.get('look'))
          const audio = execution.frame.audio
          // With Auto Performance on and music playing, Pattern Change and the Trigger are the music's choice (the saved values are never written to).
          const autoOn = readBoolean(parameters, 'autoPerformance', true) && (execution.frame.transport?.sourcePresent ?? audio != null)
          const control = patternControls.update({
            saved: { patternChange: readBoolean(parameters, 'patternChange', false), trigger: readString(parameters, 'trigger', 'bar4') },
            mood: execution.frame.mood, autoPerformance: autoOn && execution.frame.transport?.playing === true && !execution.frame.transport.paused,
          })
          const trigger = control.trigger
          const bpm = audio?.rhythm.bpm.available ? audio.rhythm.bpm.value ?? 120 : execution.frame.transport?.bpm ?? 120
          const bpmSync = readBoolean(parameters, 'bpmSync', true)
          const overallEnergy = clamp(readNumber(parameters, 'overallEnergy', 0), 0, 1)
          const bassPressure = clamp(readNumber(parameters, 'bassPressure', 0), 0, 1)
          const beatAccent = clamp(readNumber(parameters, 'beatAccent', 0), 0, 1)
          const kickAccent = clamp(readNumber(parameters, 'kickAccent', 0), 0, 1)
          const snareAccent = clamp(readNumber(parameters, 'snareAccent', 0), 0, 1)
          const downbeatAccent = clamp(readNumber(parameters, 'downbeatAccent', 0), 0, 1)
          const phraseAccent = clamp(readNumber(parameters, 'phraseAccent', 0), 0, 1)
          const dropAccent = clamp(readNumber(parameters, 'dropAccent', 0), 0, 1)
          const buildAmount = clamp(readNumber(parameters, 'buildAmount', 0), 0, 1)
          const vocalPresence = clamp(readNumber(parameters, 'vocalPresence', 0), 0, 1)
          const directorImpact = clamp(readNumber(parameters, 'directorImpact', dropAccent), 0, 1)
          const sectionType = audio?.structure.section.available ? audio.structure.section.value?.type : null
          const ledPowerGatingEnabled = resolveCinema2HypnotizeLedPowerGatingEnabled(readBoolean(parameters, 'impactOnlyLedGating', false), sectionType, directorImpact)
          const patternFrame = patternEngine.update({
            authoredPattern,
            patternChange: control.patternChange,
            autoPerformance: autoOn,
            trigger,
            triggerEventId: resolveCinema2HypnotizeTriggerEventId(audio, trigger),
            triggerPulse: resolveTriggerPulse(trigger, { beat: beatAccent, kick: kickAccent, snare: snareAccent, downbeat: downbeatAccent, phrase: phraseAccent, drop: dropAccent }),
            deltaTimeSec: execution.frame.deltaTimeSec,
            animationActive: execution.frame.transport?.animationActive ?? true,
            bpmSync,
            bpm,
            discontinuityGeneration: audio?.discontinuity.generation ?? 0,
            overallEnergy,
            vocalPresence,
            directorIntensity: clamp(readNumber(parameters, 'directorIntensity', overallEnergy), 0, 1),
            directorMomentum: clamp(readNumber(parameters, 'directorMomentum', overallEnergy), 0, 1),
            buildAmount,
            dropAccent,
          })

          const animating = (execution.frame.transport?.animationActive ?? true) && !execution.frame.transport?.paused
          const dt = animating ? clamp(execution.frame.deltaTimeSec, 0, 0.1) : 0
          const motion = motionScale(parameters.get('motionSafety'))
          const travel = clamp(readNumber(parameters, 'travel', 0.45), 0, 1)
          const flashLevel = readFlashLevel(parameters.get('flashAccents'))
          const dropStrength = clamp(readNumber(parameters, 'dropStrength', 0.75), 0, 1)
          const profile = patternFrame.profile
          const beatsStep = lastBeats == null ? 0 : Math.max(0, patternFrame.beats - lastBeats)
          lastBeats = patternFrame.beats
          const spin = clamp(readNumber(parameters, 'spin', 0.52), -2, 2) * motion
          const counter = clamp(readNumber(parameters, 'counterRotation', 0.65), 0, 1)
          rotationEven = (rotationEven + beatsStep * profile.turbineRate * spin * SPIN_PER_BEAT) % (Math.PI * 2)
          rotationOdd = (rotationOdd + beatsStep * profile.conductorRate * (0.4 + 0.6 * counter) * spin * SPIN_PER_BEAT) % (Math.PI * 2)
          const ringsPerSecond = (SCROLL_BASE + travel * SCROLL_TRAVEL) * (bpmSync ? clamp(bpm / 120, 0.5, 1.6) : 1) * motion
            * (1 + overallEnergy * 0.5 + dropAccent * 0.9 * dropStrength + buildAmount * 0.3)
          scroll += dt * ringsPerSecond

          // Flash Accents is the hard authorization for the bright drop discharge: Off keeps only a quarter of it, Reduced about half.
          const accentGain = (0.25 + 0.75 * flashLevel) * (0.3 + 0.7 * dropStrength)
          const quality = execution.lightingEnvironment?.quality ?? 'high'
          updateCinema2HypnotizeTunnelFrame(layout, tunnelFrame, {
            patternFrame,
            signals: {
              overallEnergy, bassPressure,
              highsAmount: clamp(readNumber(parameters, 'highsAmount', 0), 0, 1),
              fluxAmount: clamp(readNumber(parameters, 'fluxAmount', 0), 0, 1),
              kickAccent, snareAccent, downbeatAccent, phraseAccent,
              dropAccent: dropAccent * accentGain,
            },
            ledPowerGatingEnabled,
            scroll,
            rotationEven,
            rotationOdd,
            twist: 0.21,
            intensity: clamp(readNumber(parameters, 'intensity', 0.9), 0, 2),
            ledGain: clamp(readNumber(parameters, 'edgeGlow', 1), 0, 2),
            pulseDepth: clamp(readNumber(parameters, 'drift', 0.55), 0, 2),
            vocalRestraint: 1 - 0.3 * vocalPresence,
            beatAccent, kickAccent, downbeatAccent,
            dropAccent: dropAccent * accentGain,
            overallEnergy,
            ringsVisible: CINEMA2_HYPNOTIZE_QUALITY_RINGS[quality === 'low' || quality === 'medium' ? quality : 'high'],
            lineGain: 1.7,
          })
          const lightA = readColor(parameters, 'secondaryColor', DEFAULT_LIGHT_A)
          const lightB = readColor(parameters, 'spectrumColor', DEFAULT_LIGHT_B)
          const core = readColor(parameters, 'highlightColor', DEFAULT_CORE)
          const body = readColor(parameters, 'primaryColor', DEFAULT_BODY)
          renderer.draw({
            viewProjection: execution.camera.viewProjectionMatrix,
            cameraPosition: execution.camera.position,
            lightA: [lightA[0], lightA[1], lightA[2]],
            lightB: [lightB[0], lightB[1], lightB[2]],
            core: [core[0], core[1], core[2]],
            body: [body[0], body[1], body[2]],
            radiusScale: clamp(readNumber(parameters, 'spread', 1), 0.7, 1.3),
            fog: FOG,
            spill: 1,
            frame: tunnelFrame,
          })
        },
      })

      return {
        lifecycle: {
          update() {},
          dispose() {
            patternEngine.reset()
            patternControls.reset()
          },
        },
        render: { providers: Object.freeze([provider]) },
        getDiagnostics: () => Object.freeze([...diagnostics]),
        inspect: () => patternControls.inspect(),
      }
    },
  })
}

export const cinema2HypnotizeNativeModuleDefinition = createCinema2HypnotizeNativeModuleDefinition()

function validateModule(_module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  return Object.freeze([])
}

type Parameters = Cinema2ModuleCreateContext['parameters']
function readNumber(parameters: Parameters, name: string, fallback: number): number {
  const value = parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function readBoolean(parameters: Parameters, name: string, fallback: boolean): boolean {
  const value = parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
}
function readString(parameters: Parameters, name: string, fallback: string): string {
  const value = parameters.get(name)
  return typeof value === 'string' ? value : fallback
}
function readColor(parameters: Parameters, name: string, fallback: Cinema2Color): Cinema2Color {
  const value = parameters.get(name)
  return Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? value as unknown as Cinema2Color
    : fallback
}
function readPattern(value: unknown): Cinema2HypnotizePattern {
  return typeof value === 'string' && CINEMA2_HYPNOTIZE_PATTERNS.includes(value as Cinema2HypnotizePattern)
    ? value as Cinema2HypnotizePattern
    : 'mesmericOrbit'
}
function readFlashLevel(value: unknown): number {
  return value === 'full' ? 1 : value === 'reduced' ? 0.45 : 0
}
function motionScale(value: unknown): number {
  return value === 'lockoff' ? 0 : value === 'reduced' ? 0.4 : 1
}
function resolveTriggerPulse(trigger: string, pulses: Readonly<Record<'beat' | 'kick' | 'snare' | 'downbeat' | 'phrase' | 'drop', number>>): number {
  if (trigger === 'kick') return pulses.kick
  if (trigger === 'snare') return pulses.snare
  if (trigger === 'downbeat' || trigger === 'bar') return pulses.downbeat
  if (trigger === 'phrase') return pulses.phrase
  if (trigger === 'drop') return pulses.drop
  return pulses.beat
}
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)) }

export { CINEMA2_HYPNOTIZE_TUNNEL }
