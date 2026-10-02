/**
 * Diagnostic-only CONDUIT capture page. It never changes the first-party preset: each isolation mode
 * registers a temporary copy of the manifest and then runs the normal Cinema 2.0 renderer.
 */
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import { Cinema2AudioIntelligenceBridge } from '../../components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge'
import { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import { Cinema2PresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import {
  CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID,
  CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID,
  CINEMA2_CONDUIT_ENERGY_COLOR_ID,
  CINEMA2_CONDUIT_FLICKER_ID,
  CINEMA2_CONDUIT_MASTER_INTENSITY_ID,
  CINEMA2_CONDUIT_PATTERN_ID,
  CINEMA2_CONDUIT_PRESET_MANIFEST,
  CINEMA2_CONDUIT_ZOOM_ON_KICK_ID,
} from '../../components/vyzualz/cinema2/presets/Cinema2ConduitPreset'
import {
  CINEMA2_CONDUIT_CHAMBER_ASSET_ID,
  CINEMA2_CONDUIT_TUBES_ASSET_ID,
  CINEMA2_CONDUIT_WORDMARK_ASSET_ID,
} from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetManifest'

export const CONDUIT_CAPTURE_VARIANTS = [
  'baseline', 'scene-only', 'no-floor', 'no-haze', 'no-bloom', 'no-studio', 'no-led',
  'chamber-only', 'tubes-only', 'wordmark-only',
] as const
export type ConduitCaptureVariant = typeof CONDUIT_CAPTURE_VARIANTS[number]

const ASSET_FOR_VARIANT: Partial<Record<ConduitCaptureVariant, string>> = {
  'chamber-only': CINEMA2_CONDUIT_CHAMBER_ASSET_ID,
  'tubes-only': CINEMA2_CONDUIT_TUBES_ASSET_ID,
  'wordmark-only': CINEMA2_CONDUIT_WORDMARK_ASSET_ID,
}

export function createConduitCaptureManifest(variant: ConduitCaptureVariant) {
  const source = CINEMA2_CONDUIT_PRESET_MANIFEST
  const asset = ASSET_FOR_VARIANT[variant]
  const isolated = asset !== undefined
  const modules = (source.modules ?? []).map(module => {
    const parameters = { ...(module.parameters ?? {}) } as Record<string, unknown>
    const config = { ...(module.config ?? {}) } as Record<string, unknown>
    if (variant === 'no-studio') {
      parameters.environmentIntensity = 0
      for (const part of (module.config?.parts ?? []) as readonly string[]) parameters[`${part}.environmentIntensity`] = 0
      config.panels = []
    }
    if (variant === 'no-led') parameters.segmentStrength = 0
    if (asset) {
      config.instances = ((module.config?.instances ?? []) as readonly { asset: string }[]).filter(instance => instance.asset === asset)
    }
    return { ...module, parameters, config }
  })
  const effects = (source.effects ?? []).map(effect => {
    const bypass = variant === 'scene-only'
      || (variant === 'no-floor' && effect.typeId === 'reflective-floor')
      || (variant === 'no-haze' && effect.typeId === 'volumetric-atmosphere')
      || (variant === 'no-bloom' && effect.typeId === 'hdr-bloom')
      || (isolated && effect.typeId === 'reflective-floor')
    return { ...effect, parameters: { ...(effect.parameters ?? {}), ...(bypass ? { mix: 0 } : {}) } }
  })
  const energyLightIds = new Set(source.lighting?.groups?.find(group => group.label === 'Energy Lights')?.lights.map(light => light.$ref) ?? [])
  const lighting = source.lighting && variant === 'no-led'
    ? { ...source.lighting, lights: source.lighting.lights.map(light => energyLightIds.has(light.id) ? { ...light, intensity: 0 } : light) }
    : source.lighting
  return { ...source, modules, effects, lighting }
}

const query = new URLSearchParams(location.search)
const requestedVariant = query.get('variant')
const variant: ConduitCaptureVariant = CONDUIT_CAPTURE_VARIANTS.find(value => value === requestedVariant) ?? 'baseline'
const requestedQuality = query.get('quality')
const quality = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const captureState = query.get('state') === 'peak' ? 'peak' : query.get('state') === 'idle' ? 'idle' : 'steady'
const captureColor = query.get('color') === 'blue' ? 'blue' : 'default'
const canvas = document.querySelector<HTMLCanvasElement>('#conduit-capture')
if (!canvas) throw new Error('The CONDUIT capture canvas is missing.')

const registry = new Cinema2PresetRegistry()
const registration = registry.register(createConduitCaptureManifest(variant))
if (!registration.ok) throw new Error(`CONDUIT diagnostic manifest rejected: ${registration.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)

let audioFrameId = 0
let audioSection: 'verse' | 'drop' = 'verse'
const startedAtMs = performance.now()
const bridge = new Cinema2AudioIntelligenceBridge({
  getFrame: () => {
    audioFrameId += 1
    const timeSec = (performance.now() - startedAtMs) / 1000
    const energy = captureState === 'peak' ? 1 : 0
    const beats = timeSec * 2
    return {
      ...DEFAULT_MI_FRAME,
      frameId: audioFrameId,
      timeSec,
      sourceId: 'conduit-baseline-capture',
      trackId: 'conduit-baseline-capture',
      bands: { ...DEFAULT_MI_FRAME.bands, normalizedSub: energy, normalizedBass: energy, normalizedMid: energy },
      energy: { ...DEFAULT_MI_FRAME.energy, instant: energy, rms: energy * 0.7, buildProgress: energy },
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120, bpmConfidence: 1, bpmSource: 'manual_override',
        beatPhase: beats % 1, beatIndex: Math.floor(beats), beatInBar: Math.floor(beats) % 4, barIndex: Math.floor(beats / 4),
      },
      section: {
        ...DEFAULT_MI_FRAME.section,
        type: audioSection, label: audioSection, startSec: audioSection === 'drop' ? 1 : 0,
        endSec: 60, confidence: 1, intensity: energy, source: 'manual',
      },
      capabilities: {
        liveBands: true, rhythmEvents: false, beatGrid: true, sections: true,
        trackEnergyCurve: false, stemCurves: false, lyrics: false,
      },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
    }
  },
  getPublicationMeta: () => ({
    sequence: audioFrameId, publishedAtMs: performance.now(), publisherId: 'conduit-baseline-capture', kind: 'frame',
  }),
})

const created = Cinema2Runtime.create(canvas, {
  presetId: CINEMA2_CONDUIT_PRESET_MANIFEST.id,
  presetRegistry: registry,
  renderQuality: quality,
  audioIntelligenceBridge: bridge,
  transportSource: { getState: () => ({
    sourcePresent: true, playing: true, analysisActive: true, paused: false,
    trackId: 'conduit-baseline-capture', timeSec: (performance.now() - startedAtMs) / 1000,
  }) },
})
if (!created.runtime) throw new Error(created.error)
const runtime = created.runtime
const state = runtime.getParameterState()
for (const [id, value] of [
  [CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID, 0],
  [CINEMA2_CONDUIT_ZOOM_ON_KICK_ID, false],
  [CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID, false],
  [CINEMA2_CONDUIT_PATTERN_ID, captureState === 'idle' ? 'energyFlow' : 'pulse'],
  [CINEMA2_CONDUIT_FLICKER_ID, 0],
  [CINEMA2_CONDUIT_MASTER_INTENSITY_ID, captureState === 'steady' ? 0 : 1],
  ...(captureColor === 'blue' ? [[CINEMA2_CONDUIT_ENERGY_COLOR_ID, [0.08, 0.48, 1, 1]] as const] : []),
] as const) {
  const result = state.setPersistentValue(id, value)
  if (!result.ok) throw new Error(`CONDUIT capture control rejected: ${id}: ${result.diagnostics.map(diagnostic => diagnostic.message).join('; ')}`)
}
runtime.resize({ width: innerWidth, height: innerHeight, dpr: 1 })
runtime.start()

Object.assign(window, {
  __conduitCapture: {
    variant, quality, state: captureState, color: captureColor,
    triggerPeak: () => { if (captureState === 'peak') audioSection = 'drop' },
    status: () => ({
      frameCount: runtime.getSnapshot().frameCount,
      visualTimeSec: runtime.getVisualElapsedTimeSec(),
      modules: runtime.getModuleRuntimeSnapshot(),
      performance: runtime.getPerformanceSnapshot(),
      audioSection,
      controls: {
        cameraMovement: state.getValue(CINEMA2_CONDUIT_CAMERA_MOVEMENT_ID),
        zoomOnKick: state.getValue(CINEMA2_CONDUIT_ZOOM_ON_KICK_ID),
        autoPerformance: state.getValue(CINEMA2_CONDUIT_AUTO_PERFORMANCE_ID),
        pattern: state.getValue(CINEMA2_CONDUIT_PATTERN_ID),
        flicker: state.getValue(CINEMA2_CONDUIT_FLICKER_ID),
        masterIntensity: state.getValue(CINEMA2_CONDUIT_MASTER_INTENSITY_ID),
        energyColor: state.getValue(CINEMA2_CONDUIT_ENERGY_COLOR_ID),
      },
    }),
  },
})
addEventListener('beforeunload', () => runtime.dispose(), { once: true })
