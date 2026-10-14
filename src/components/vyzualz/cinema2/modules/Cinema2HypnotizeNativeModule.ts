import { cinema2StableId, type Cinema2Color, type Cinema2ModuleManifest, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleCreateContext, Cinema2ModuleDiagnostic, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition } from './Cinema2ModuleContracts'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { Cinema2HypnotizeRenderer, type Cinema2HypnotizeDrawState } from './hypnotize/Cinema2HypnotizeRenderer'
import {
  CINEMA2_HYPNOTIZE_PATTERNS,
  Cinema2HypnotizePatternEngine,
  resolveCinema2HypnotizeLedPowerGatingEnabled,
  resolveCinema2HypnotizeTriggerEventId,
  type Cinema2HypnotizePattern,
} from './hypnotize/Cinema2HypnotizePatternEngine'

export { CINEMA2_HYPNOTIZE_PATTERNS, type Cinema2HypnotizePattern } from './hypnotize/Cinema2HypnotizePatternEngine'

export const CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('hypnotize-native')
export const CINEMA2_HYPNOTIZE_NATIVE_MODULE_VERSION = 1 as const
export function createCinema2HypnotizeNativeModuleDefinition(
  options: { loadLibrary?: () => Promise<Cinema2ThreeLibrary> } = {},
): Readonly<Cinema2ModuleTypeDefinition> {
  const loadLibrary = options.loadLibrary ?? loadCinema2ThreeLibrary
  return Object.freeze({
    typeId: CINEMA2_HYPNOTIZE_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_HYPNOTIZE_NATIVE_MODULE_VERSION,
    validate: validateModule,
    create(context: Cinema2ModuleCreateContext) {
      let renderer: Cinema2HypnotizeRenderer | null = null
      let loading: Promise<void> | null = null
      let failed = false
      let disposed = false
      const patternEngine = new Cinema2HypnotizePatternEngine()
      const diagnostics: Cinema2ModuleDiagnostic[] = []

      const ensureRenderer = () => {
        if (renderer || failed || loading) return
        loading = loadLibrary().then(library => {
          if (disposed) return
          renderer = context.resources.acquire(
            'hypnotize:reactive-optical-engine:phase-d-impact-only-led-gating',
            'Cinema2HypnotizeRenderer',
            gl => new Cinema2HypnotizeRenderer(gl, library),
            value => value.dispose(),
          )
          context.resources.reportGpuBytes(renderer.estimateGpuBytes())
        }).catch(error => {
          failed = true
          diagnostics.push(Object.freeze({
            code: 'CINEMA2_HYPNOTIZE_RENDERER_LOAD_FAILED',
            path: `module.${context.module.id}`,
            message: error instanceof Error ? error.message : 'Hypnotize could not initialize its Three.js optical engine.',
          }))
        })
      }

      const provider = Object.freeze({
        id: `${context.module.id}:hypnotize-three-world`,
        moduleId: context.module.id,
        intent: 'world' as const,
        execute(execution: Cinema2ModuleRenderExecutionContext) {
          ensureRenderer()
          if (!renderer) return
          const authoredPattern = readPattern(context.parameters.get('look'))
          const trigger = readString(context.parameters, 'trigger', 'bar4')
          const audio = execution.frame.audio
          const bpm = audio?.rhythm.bpm.available
            ? audio.rhythm.bpm.value ?? 120
            : execution.frame.transport?.bpm ?? 120
          const overallEnergy = clamp(readNumber(context.parameters, 'overallEnergy', readNumber(context.parameters, 'exteriorEnergy', 0)), 0, 1)
          const bassPressure = clamp(readNumber(context.parameters, 'bassPressure', readNumber(context.parameters, 'exteriorBass', 0)), 0, 1)
          const beatAccent = clamp(readNumber(context.parameters, 'beatAccent', 0), 0, 1)
          const kickAccent = clamp(readNumber(context.parameters, 'kickAccent', 0), 0, 1)
          const snareAccent = clamp(readNumber(context.parameters, 'snareAccent', 0), 0, 1)
          const downbeatAccent = clamp(readNumber(context.parameters, 'downbeatAccent', 0), 0, 1)
          const phraseAccent = clamp(readNumber(context.parameters, 'phraseAccent', 0), 0, 1)
          const dropAccent = clamp(readNumber(context.parameters, 'dropAccent', 0), 0, 1)
          const directorImpact = clamp(readNumber(context.parameters, 'directorImpact', dropAccent), 0, 1)
          const sectionType = audio?.structure.section.available ? audio.structure.section.value?.type : null
          const ledPowerGatingEnabled = resolveCinema2HypnotizeLedPowerGatingEnabled(
            readBoolean(context.parameters, 'impactOnlyLedGating', false),
            sectionType,
            directorImpact,
          )
          const triggerPulse = resolveTriggerPulse(trigger, {
            beat: beatAccent,
            kick: kickAccent,
            snare: snareAccent,
            downbeat: downbeatAccent,
            phrase: phraseAccent,
            drop: dropAccent,
          })
          const patternFrame = patternEngine.update({
            authoredPattern,
            patternChange: readBoolean(context.parameters, 'patternChange', false),
            autoPerformance: readBoolean(context.parameters, 'autoPerformance', true) && (execution.frame.transport?.sourcePresent ?? audio != null),
            trigger,
            triggerEventId: resolveCinema2HypnotizeTriggerEventId(audio, trigger),
            triggerPulse,
            deltaTimeSec: execution.frame.deltaTimeSec,
            animationActive: execution.frame.transport?.animationActive ?? true,
            bpmSync: readBoolean(context.parameters, 'bpmSync', true),
            bpm,
            discontinuityGeneration: audio?.discontinuity.generation ?? 0,
            overallEnergy,
            vocalPresence: clamp(readNumber(context.parameters, 'vocalPresence', 0), 0, 1),
            directorIntensity: clamp(readNumber(context.parameters, 'directorIntensity', overallEnergy), 0, 1),
            directorMomentum: clamp(readNumber(context.parameters, 'directorMomentum', overallEnergy), 0, 1),
            buildAmount: clamp(readNumber(context.parameters, 'buildAmount', 0), 0, 1),
            dropAccent,
          })
          const state: Cinema2HypnotizeDrawState = {
            timeSeconds: execution.frame.transport?.timeSec ?? execution.frame.elapsedTimeSec,
            patternFrame,
            ledPowerGatingEnabled,
            intensity: clamp(readNumber(context.parameters, 'intensity', 0.9), 0, 2),
            ringDensity: clamp(readNumber(context.parameters, 'nodeDensity', 1), 0, 1),
            chamberRadius: clamp(readNumber(context.parameters, 'spread', 1.58) / 1.58, 0.55, 1.45),
            tunnelDepth: clamp(readNumber(context.parameters, 'depthSpread', 1.45), 0.55, 2.4),
            coreSize: clamp(readNumber(context.parameters, 'nodeScale', 0.92), 0.45, 1.5),
            vaneLength: clamp(readNumber(context.parameters, 'collapse', 1.08), 0.55, 1.45),
            perspectiveReveal: clamp(readNumber(context.parameters, 'scaleVariation', 0.5), 0, 1),
            membraneTension: clamp(readNumber(context.parameters, 'burst', 0.48), 0, 1),
            pulseDepth: clamp(readNumber(context.parameters, 'drift', 0.1), 0, 2),
            rotationSpeed: clamp(readNumber(context.parameters, 'spin', 0.42), -2, 2),
            counterRotation: clamp(readNumber(context.parameters, 'counterRotation', 0.65), 0, 1),
            travel: clamp(readNumber(context.parameters, 'travel', 0.45), 0, 1),
            coolGlow: clamp(readNumber(context.parameters, 'edgeGlow', 1.25), 0, 3),
            coreGlow: clamp(readNumber(context.parameters, 'internalGlow', 1.4), 0, 3),
            spectralDetail: clamp(readNumber(context.parameters, 'starDensity', 0.72), 0, 1),
            overallEnergy,
            bassPressure,
            lowMidAmount: clamp(readNumber(context.parameters, 'lowMidAmount', 0), 0, 1),
            midAmount: clamp(readNumber(context.parameters, 'midAmount', 0), 0, 1),
            highsAmount: clamp(readNumber(context.parameters, 'highsAmount', 0), 0, 1),
            fluxAmount: clamp(readNumber(context.parameters, 'fluxAmount', 0), 0, 1),
            vocalPresence: clamp(readNumber(context.parameters, 'vocalPresence', 0), 0, 1),
            beatAccent,
            kickAccent,
            snareAccent,
            downbeatAccent,
            phraseAccent,
            buildAmount: clamp(readNumber(context.parameters, 'buildAmount', 0), 0, 1),
            dropAccent,
            directorIntensity: clamp(readNumber(context.parameters, 'directorIntensity', overallEnergy), 0, 1),
            directorMomentum: clamp(readNumber(context.parameters, 'directorMomentum', overallEnergy), 0, 1),
            directorImpact,
            dropStrength: clamp(readNumber(context.parameters, 'dropStrength', 0.75), 0, 1),
            flashLevel: readFlashLevel(context.parameters.get('flashAccents')),
            colors: [
              rgb(readColor(context.parameters, 'primaryColor', [0.09, 0.13, 0.2, 1])),
              rgb(readColor(context.parameters, 'secondaryColor', [0.08, 0.76, 1, 1])),
              rgb(readColor(context.parameters, 'accentColor', [1, 0.32, 0.08, 1])),
              rgb(readColor(context.parameters, 'highlightColor', [0.78, 0.96, 1, 1])),
              rgb(readColor(context.parameters, 'spectrumColor', [0.53, 0.2, 1, 1])),
            ],
          }
          renderer.draw(execution, state)
        },
      })

      return {
        lifecycle: {
          update() {},
          dispose() {
            disposed = true
            patternEngine.reset()
            renderer = null
          },
        },
        render: { providers: Object.freeze([provider]) },
        getDiagnostics: () => Object.freeze([...diagnostics]),
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
function rgb(value: Cinema2Color): readonly [number, number, number] { return [value[0], value[1], value[2]] }
function readPattern(value: unknown): Cinema2HypnotizePattern {
  return typeof value === 'string' && CINEMA2_HYPNOTIZE_PATTERNS.includes(value as Cinema2HypnotizePattern)
    ? value as Cinema2HypnotizePattern
    : 'mesmericOrbit'
}
function readFlashLevel(value: unknown): number {
  return value === 'full' ? 1 : value === 'reduced' ? 0.45 : 0
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
