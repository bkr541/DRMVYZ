import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_ATL_HOE_PARAMETER_IDS as IDS } from '../presets/Cinema2AtlHoeDesign'
import { CINEMA2_ATL_HOE_MODULE_ID, CINEMA2_ATL_HOE_PRESET_MANIFEST } from '../presets/Cinema2AtlHoePreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'

// Runs the real ATL HOE manifest through the choreography runtime with synthetic audio, and reads back the sign's and windows' final brightness.
const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting', 'audio.features', 'audio.bands', 'music.beat', 'music.downbeat', 'music.bar',
  'music.phrase', 'music.rhythm-events', 'music.drop', 'visual-director.significance',
] as const

function harness() {
  const compiled = compileCinema2NativePreset(CINEMA2_ATL_HOE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
  const plan = compiled.plan
  const parameterState = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : parameterState.getValue(target.parameterId),
    dispatchAction: () => undefined,
  })
  const runtime = new Cinema2ChoreographyRuntime(plan, parameterState, resolver)
  const director = new Cinema2VisualDirector()
  let source = {
    ...DEFAULT_MI_FRAME,
    frameId: 1,
    sourceId: 'atl-hoe-behavior',
    timeSec: 1,
    energy: { ...DEFAULT_MI_FRAME.energy, instant: 0, buildProgress: 0, dropImpact: 0 },
    rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, bpmConfidence: 0.95, beatIndex: 2, beatPhase: 0, beatInBar: 2, barIndex: 0, transientConfidence: 0.95 },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.95 },
  }
  let sequence = 1
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => source,
    getPublicationMeta: () => ({ sequence, publishedAtMs: source.timeSec * 1000, publisherId: 'atl-hoe-behavior', kind: 'frame' as const }),
  })
  let frameId = 0
  let priorMs = source.timeSec * 1000
  const step = (patch: Partial<typeof source> = {}) => {
    sequence += 1
    source = { ...source, ...patch, frameId: source.frameId + 1 }
    const timestampMs = source.timeSec * 1000
    const audio = bridge.capture(++frameId)
    const frame = Object.freeze({
      frameId, timestampMs, deltaTimeSec: Math.max(0, (timestampMs - priorMs) / 1000), elapsedTimeSec: timestampMs / 1000,
      viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }), contextGeneration: 1, audio, director: director.capture(audio),
    }) as Readonly<Cinema2ModuleFrameReadContext>
    priorMs = timestampMs
    runtime.update(frame)
  }
  const value = (property: string) => {
    const target = plan.targets.targets.find(candidate => candidate.kind === 'module' && candidate.ownerId === CINEMA2_ATL_HOE_MODULE_ID && candidate.property === property)
    if (!target) throw new Error(`Missing module target ${property}`)
    return resolver.resolve(target.id).value as number
  }
  const set = (id: Cinema2ParameterId, next: unknown) => expect(parameterState.setPersistentValue(id, next)).toMatchObject({ ok: true })
  const exposure = () => {
    const target = plan.targets.targets.find(candidate => candidate.kind === 'environment' && candidate.property === 'exposure')
    if (!target) throw new Error('Missing environment exposure target')
    return resolver.resolve(target.id).value as number
  }
  // Plays the track forward on a consistent beat grid: `bpm` beats per minute, beat 2 at t = 1 s, one frame every `dt` seconds.
  const play = (toSec: number, { bpm = 120, dt = 0.0625, each }: { bpm?: number; dt?: number; each?: (timeSec: number) => void } = {}) => {
    for (let t = source.timeSec + dt; t <= toSec + 1e-9; t += dt) {
      const beats = 2 + ((t - 1) * bpm) / 60
      step({ timeSec: t, rhythm: { ...source.rhythm, bpm, beatIndex: Math.floor(beats), beatPhase: beats - Math.floor(beats), beatHit: false } })
      each?.(t)
    }
  }
  return { step, value, set, exposure, play, rhythm: () => source.rhythm }
}

const FACE = 'signFace00.emissiveIntensity'
const WINDOW = 'winA.emissiveIntensity'

describe('ATL HOE Design tab behaviour', () => {
  it('leaves every lit part at its authored brightness by default, with no audio events', () => {
    const h = harness()
    h.step()
    expect(h.value(FACE)).toBeCloseTo(1.25)
    expect(h.value(WINDOW)).toBeCloseTo(1.45)
    expect(h.value('spireBoa.emissiveIntensity')).toBeCloseTo(2.2)
    expect(h.value('lampOrbA.emissiveIntensity')).toBeCloseTo(1.3)
  })

  it('scales brightness with Master Intensity: nearly dark at 0, brighter than authored at 1.5', () => {
    const h = harness()
    h.set(IDS.masterIntensity, 0)
    h.step()
    expect(h.value(FACE)).toBeCloseTo(1.25 * 0.08, 3)
    h.set(IDS.masterIntensity, 1.5)
    h.step()
    expect(h.value(FACE)).toBeCloseTo(1.25 * 1.46, 3)
  })

  it('keeps program timing out of material choreography when the selected full-scene program changes', () => {
    const h = harness()
    h.set(IDS.signPattern, 'interstate-flow')
    h.step()
    expect(h.value(FACE)).toBeCloseTo(1.25, 3)
    expect(h.value('spireBoa.emissiveIntensity')).toBeCloseTo(2.2, 3)
  })

  it('dips sign cells with Flicker on every beat of the clock, and not at all at the default of 0', () => {
    const lowestOver = (h: ReturnType<typeof harness>) => {
      let lowest = Infinity
      h.step()
      h.play(5, { each: () => { lowest = Math.min(lowest, h.value(FACE)) } })
      return lowest
    }
    expect(lowestOver(harness())).toBeCloseTo(1.25)
    const flicker = harness()
    flicker.set(IDS.flicker, 1)
    expect(lowestOver(flicker)).toBeLessThan(1.25 * 0.4)
  })

  it('leaves sky material bases authored because full-scene sky choreography is applied in the semantic shader', () => {
    const h = harness()
    h.step()
    expect(h.value('skyBand10.emissiveIntensity')).toBeCloseTo(1)
    expect(h.value('stars' + 'A.emissiveIntensity')).toBeCloseTo(3)
    expect(h.value('bolt00.emissiveIntensity')).toBeCloseTo(1)
  })
})
