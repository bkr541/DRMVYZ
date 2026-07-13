import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorState,
  type ReactSectionType,
  type ReactTrackSection,
} from './ReactTypes'
import { LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY } from './LaserDmxShowDirectorBeatActions'
import { buildLaserDmxShowDirectorPerformanceContext } from './LaserDmxShowDirectorPerformanceContext'
import type {
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceProgramTuning,
} from './LaserDmxShowDirectorPerformanceProgram'
import { normalizeLaserDmxShowDirectorPerformanceProgram } from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import {
  CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET,
  CYAN_MIRROR_CAGE_PERFORMANCE_PRESET,
  LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS,
  PRISM_CATHEDRAL_PERFORMANCE_PRESET,
} from './LaserDmxShowDirectorPerformanceShowcasePresets'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'

const DROP_SECTIONS: ReactTrackSection[] = [
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 0, endSec: 64, intensity: 1, source: 'auto', confidence: 1 },
]

type EventOptions = {
  kick?: boolean
  snare?: boolean
  hat?: boolean
  transient?: number
  beatPhaseOffset?: number
}

function frameAt(timeSec: number, options: EventOptions = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2 + (options.beatPhaseOffset ?? 0)
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.round(timeSec * 60),
    sourceId: 'beat-bank-test-source',
    trackId: 'beat-bank-test-track',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.72,
      bass: 0.8,
      mid: 0.52,
      high: 0.64,
      volume: 0.92,
      normalizedSub: 0.72,
      normalizedBass: 0.8,
      normalizedMid: 0.52,
      normalizedHigh: 0.64,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatHit: true,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit: beatIndex % 4 === 0,
      kickHit: options.kick ?? false,
      kickStrength: options.kick ? 1 : 0,
      snareHit: options.snare ?? false,
      snareStrength: options.snare ? 1 : 0,
      hatHit: options.hat ?? false,
      hatStrength: options.hat ? 0.9 : 0,
      transient: options.transient ?? 0,
      transientConfidence: 1,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.94,
      shortTerm: 0.92,
      longTerm: 0.72,
      peak: 0.98,
      delta: 0.04,
      dropImpact: options.transient ?? 0,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: 'drop',
      label: 'Drop 1',
      startSec: 0,
      endSec: 64,
      progress: timeSec / 64,
      intensity: 1,
      confidence: 1,
      source: 'analysis',
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
  }
}

function contextAt(timeSec: number, options: EventOptions & { seek?: string; loop?: string } = {}) {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options),
    resolvedSections: DROP_SECTIONS,
    trackIdentity: 'beat-bank-test-track',
    seekIdentity: options.seek ?? 'seek-0',
    loopIdentity: options.loop ?? 'loop-0',
    previous: null,
  })
}

function contextForSection(type: ReactSectionType, timeSec: number, options: EventOptions = {}) {
  const section: ReactTrackSection = {
    id: `${type}-1`,
    label: type,
    type,
    startSec: 0,
    endSec: 64,
    intensity: type === 'drop' ? 1 : type === 'build' || type === 'preDrop' ? 0.78 : 0.55,
    source: 'auto',
    confidence: 1,
  }
  const base = frameAt(timeSec, options)
  const frame: MusicIntelligenceFrame = {
    ...base,
    section: {
      ...base.section,
      type,
      label: type,
      startSec: 0,
      endSec: 64,
      progress: timeSec / 64,
      intensity: section.intensity,
    },
  }
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame,
    resolvedSections: [section],
    trackIdentity: `beat-bank-${type}-track`,
    seekIdentity: 'seek-0',
    loopIdentity: 'loop-0',
    previous: null,
  })
}

function ids(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

function resolvePreset(
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
  timeSec: number,
  options: EventOptions & { seek?: string; loop?: string } = {},
  tuningPatch: Partial<LaserDmxShowDirectorPerformanceProgramTuning> = {},
) {
  const program = preset.createProgram()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: preset.createRig(ids(preset.id)),
    program,
    context: contextAt(timeSec, options),
    tuning: { ...program.tuning, ...tuningPatch },
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:beat-bank`,
  })
}

function resolvePresetInSection(
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
  type: ReactSectionType,
  timeSec: number,
) {
  const program = preset.createProgram()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: preset.createRig(ids(`${preset.id}-${type}`)),
    program,
    context: contextForSection(type, timeSec),
    tuning: program.tuning,
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:${type}:beat-bank`,
  })
}

function compileResult(result: ReturnType<typeof resolvePreset>) {
  return compileLaserDmxShowDirectorToBeamMatrix({
    showDirector: result.showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    sections: DROP_SECTIONS,
    fixturePriorityById: result.fixturePriorityById,
  })
}

function fixtureByKey(result: ReturnType<typeof resolvePreset>, key: string): LaserDmxShowDirectorFixture {
  const fixture = result.showDirector.fixtures.find(item => item.semanticKey === key)
  if (!fixture) throw new Error(`Missing fixture ${key}`)
  return fixture
}

function meanBrightness(result: ReturnType<typeof resolvePreset>, keys: string[]): number {
  const values = keys.map(key => fixtureByKey(result, key)).filter(fixture => fixture.enabled).map(fixture => fixture.brightness)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function compiledSignature(result: ReturnType<typeof resolvePreset>): string {
  const compiled = compileResult(result)
  return JSON.stringify(compiled.beams.map(beam => ({
    id: beam.id,
    enabled: beam.enabled,
    target: beam.target,
    color: beam.color,
    appearance: beam.appearance,
    motion: beam.motion,
  })))
}

function motifGeometrySignature(result: ReturnType<typeof resolvePreset>): string {
  return JSON.stringify(result.showDirector.fixtures.map(fixture => ({
    key: fixture.semanticKey,
    enabled: fixture.enabled,
    targets: fixture.beam.targets?.map(target => [target.x, target.y]),
  })))
}

function normalizedColorDistance(left: string, right: string): number {
  const parse = (value: string) => /^#[0-9a-f]{6}$/i.test(value)
    ? [Number.parseInt(value.slice(1, 3), 16), Number.parseInt(value.slice(3, 5), 16), Number.parseInt(value.slice(5, 7), 16)]
    : [0, 0, 0]
  const a = parse(left)
  const b = parse(right)
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / Math.hypot(255, 255, 255)
}

function fixtureOutputDistance(
  left: ReturnType<typeof resolvePreset>,
  right: ReturnType<typeof resolvePreset>,
): number {
  const rightByKey = new Map(right.showDirector.fixtures.map(fixture => [fixture.semanticKey, fixture]))
  return left.showDirector.fixtures.reduce((sum, fixture) => {
    const peer = rightByKey.get(fixture.semanticKey)
    if (!peer) return sum
    return sum
      + Math.abs(fixture.brightness - peer.brightness)
      + Math.abs(fixture.beam.beamSpread - peer.beam.beamSpread) / 180
      + Math.abs((fixture.runtimeBeamAppearance?.width ?? 1) - (peer.runtimeBeamAppearance?.width ?? 1)) / 8
      + Math.abs((fixture.runtimeBeamAppearance?.glow ?? 0.72) - (peer.runtimeBeamAppearance?.glow ?? 0.72))
  }, 0)
}

function customAddressRig(): LaserDmxShowDirectorState {
  const a = createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-a', 0)
  const b = createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-b', 1)
  const c = createDefaultLaserDmxShowDirectorFixture('ledBar', 'fixture-c', 2)
  const d = createDefaultLaserDmxShowDirectorFixture('laser', 'fixture-d', 3)
  return normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    groups: [
      { id: 'group-a-id', semanticKey: 'group-a', label: 'Group A' },
      { id: 'group-b-id', semanticKey: 'group-b', label: 'Group B' },
      { id: 'group-c-id', semanticKey: 'group-c', label: 'Group C' },
    ],
    fixtures: [
      { ...a, semanticKey: 'semantic-a', groupId: 'group-a-id', linkedPairId: 'mirror-pair-ab', mirrorAxis: 'horizontal', brightness: 0.5, beam: { ...a.beam, beamSpread: 40 } },
      { ...b, semanticKey: 'semantic-b', groupId: 'group-b-id', linkedPairId: 'mirror-pair-ab', mirrorAxis: 'horizontal', brightness: 0.5, beam: { ...b.beam, beamSpread: 40 } },
      { ...c, semanticKey: 'semantic-c', groupId: 'group-c-id', brightness: 0.5, beam: { ...c.beam, beamSpread: 40 } },
      { ...d, semanticKey: 'semantic-d', groupId: 'group-c-id', linkedPairId: 'mirror-pair-d', mirrorAxis: 'horizontal', brightness: 0.5, beam: { ...d.beam, beamSpread: 40 } },
    ],
  })
}

function resolveAddress(address: LaserDmxShowDirectorPerformanceAddress, bankRoles?: Record<string, LaserDmxShowDirectorPerformanceAddress>) {
  const program: LaserDmxShowDirectorPerformanceProgram = {
    schemaVersion: 2,
    id: 'address-scope-test',
    name: 'Address Scope Test',
    deterministicSeed: 9,
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    bankRoles,
    scenes: [{
      id: 'drop',
      label: 'Drop',
      enabled: true,
      section: { types: ['drop'] },
      sectionBodyMutations: [{
        id: 'addressed-modulation',
        address,
        modulations: [{ source: 'nBass', target: 'fixture.fanSpread', amount: 10, min: 0, max: 10, mode: 'add', requiredCapability: 'Live Bands' }],
      }],
    }],
  }
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: customAddressRig(),
    program,
    context: contextAt(2.6),
    tuning: program.tuning,
    programSeed: 9,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: 'address-scope-test',
  })
}

function changedSpreadKeys(result: ReturnType<typeof resolveAddress>): string[] {
  return result.showDirector.fixtures.filter(fixture => fixture.beam.beamSpread > 40.001).map(fixture => fixture.semanticKey!).sort()
}

describe('Show Director beat-bank choreography remediation', () => {
  it('normalizes and persists bank-role addresses and hat mutations', () => {
    const raw = PRISM_CATHEDRAL_PERFORMANCE_PRESET.createProgram()
    const normalized = normalizeLaserDmxShowDirectorPerformanceProgram(JSON.parse(JSON.stringify(raw)))
    expect(normalized?.bankRoles?.['prism-kick-outer-wings']).toEqual(raw.bankRoles?.['prism-kick-outer-wings'])
    expect(normalized?.scenes.every(scene => (scene.hatMutations?.length ?? 0) >= 2)).toBe(true)
    expect(normalized?.scenes.every(scene => scene.beatMutations?.some(mutation => mutation.responseEnvelope))).toBe(true)
  })

  it.each([
    ['semantic fixture key', { fixtureSemanticKeys: ['semantic-a'] }, ['semantic-a']],
    ['semantic group key', { groupSemanticKeys: ['group-c'] }, ['semantic-c', 'semantic-d']],
    ['fixture kind', { fixtureKinds: ['ledBar'] }, ['semantic-c']],
    ['explicit fixture id', { fixtureIds: ['fixture-b'] }, ['semantic-b']],
    ['mirrored group', { mirroredGroupKeys: ['mirror-pair-ab'] }, ['semantic-a', 'semantic-b']],
  ] as const)('keeps %s modulation scoped to matched fixtures', (_label, address, expected) => {
    expect(changedSpreadKeys(resolveAddress(address as unknown as LaserDmxShowDirectorPerformanceAddress))).toEqual(expected)
  })

  it('resolves program-defined bank roles and leaves unrelated fixtures unchanged', () => {
    const result = resolveAddress({ bankRoles: ['hero-bank'] }, { 'hero-bank': { fixtureSemanticKeys: ['semantic-d'] } })
    expect(changedSpreadKeys(result)).toEqual(['semantic-d'])
  })

  it('allows an explicitly global modulation to remain global even inside an addressed payload', () => {
    const program: LaserDmxShowDirectorPerformanceProgram = {
      schemaVersion: 2,
      id: 'global-modulation-test',
      name: 'Global Modulation Test',
      deterministicSeed: 1,
      tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
      scenes: [{
        id: 'drop', label: 'Drop', enabled: true, section: { types: ['drop'] },
        address: { fixtureSemanticKeys: ['semantic-a'] },
        modulations: [{ source: 'nBass', target: 'global.globalGlow', amount: 0.2, min: 0, max: 0.2, mode: 'add' }],
      }],
    }
    const result = resolveLaserDmxShowDirectorPerformance({
      authoredShowDirector: customAddressRig(), program, context: contextAt(2.6), tuning: program.tuning,
      programSeed: 1, enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming', runtimeInvalidationId: 'global-modulation-test',
    })
    expect(result.requestedGlobalOutputOverrides.globalGlow).toBeGreaterThan(0)
    expect(result.showDirector.fixtures.every(fixture => fixture.beam.beamSpread === 40)).toBe(true)
  })

  for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
    describe(preset.name, () => {
      it('changes compiled output on all four beats in every authored section role', () => {
        const roles: ReactSectionType[] = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro']
        for (const role of roles) {
          for (const timeSec of [20.1, 20.6, 21.1, 21.6]) {
            const hit = resolvePresetInSection(preset, role, timeSec)
            const release = resolvePresetInSection(preset, role, timeSec + 0.25)
            expect(hit.activeSceneId, `${role} scene`).not.toBeNull()
            expect(compiledSignature(hit), `${role} beat at ${timeSec}`).not.toBe(compiledSignature(release))
          }
        }
      })

      it('changes final compiled visible output on every active beat', () => {
        for (const timeSec of [12.1, 12.6, 13.1, 13.6]) {
          const hit = resolvePreset(preset, timeSec)
          const release = resolvePreset(preset, timeSec + 0.25)
          expect(compiledSignature(hit), `compiled beat at ${timeSec}`).not.toBe(compiledSignature(release))
        }
      })

      it('exceeds the configured beat perceptibility floor without changing motif or recruitment identity', () => {
        const hit = resolvePreset(preset, 12.6)
        const release = resolvePreset(preset, 12.95)
        const releaseByKey = new Map(release.showDirector.fixtures.map(fixture => [fixture.semanticKey, fixture]))
        const active = hit.showDirector.fixtures.filter(fixture => fixture.enabled)
        const brightnessDelta = Math.max(...active.map(fixture => Math.abs(fixture.brightness - (releaseByKey.get(fixture.semanticKey)?.brightness ?? fixture.brightness))))
        const spreadDelta = Math.max(...active.map(fixture => Math.abs(fixture.beam.beamSpread - (releaseByKey.get(fixture.semanticKey)?.beam.beamSpread ?? fixture.beam.beamSpread))))
        expect(brightnessDelta).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumLeadingBrightnessDelta)
        expect(spreadDelta).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumFanSpreadDeltaDeg)

        const baseImpact = resolvePreset(preset, 36.6)
        const strongImpact = resolvePreset(preset, 36.6, { transient: 1 })
        const baseByKey = new Map(baseImpact.showDirector.fixtures.map(fixture => [fixture.semanticKey, fixture]))
        const colorDelta = Math.max(...strongImpact.showDirector.fixtures
          .filter(fixture => fixture.enabled)
          .map(fixture => normalizedColorDistance(fixture.color, baseByKey.get(fixture.semanticKey)?.color ?? fixture.color)))
        expect(colorDelta).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumColorEmphasisDistance)
        expect(hit.activeMotifFamily).toBe(release.activeMotifFamily)
        expect(hit.eightBarRecruitmentStage).toBe(release.eightBarRecruitmentStage)
        expect(motifGeometrySignature(hit)).toBe(motifGeometrySignature(release))
      })

      it('recovers beat ducking smoothly from a transport-derived envelope', () => {
        const hit = resolvePreset(preset, 20.55)
        const recovering = resolvePreset(preset, 20.75)
        const released = resolvePreset(preset, 20.94)
        const hitDistance = fixtureOutputDistance(hit, released)
        const recoveringDistance = fixtureOutputDistance(recovering, released)
        expect(hitDistance).toBeGreaterThan(recoveringDistance)
        expect(recoveringDistance).toBeGreaterThan(0)
      })

      it('keeps core beat choreography active when Variation Amount is zero', () => {
        const hit = resolvePreset(preset, 12.6, {}, { variation: 0 })
        const release = resolvePreset(preset, 12.85, {}, { variation: 0 })
        expect(compiledSignature(hit)).not.toBe(compiledSignature(release))
      })

      it('reconstructs the same compiled beat state after seek and loop identity changes', () => {
        const direct = resolvePreset(preset, 20.6)
        const seeked = resolvePreset(preset, 20.6, { seek: 'seek-9' })
        const looped = resolvePreset(preset, 20.6, { loop: 'loop-4' })
        expect(compiledSignature(seeked)).toBe(compiledSignature(direct))
        expect(compiledSignature(looped)).toBe(compiledSignature(direct))
      })

      it('keeps all compiled outputs below the 300-beam hard limit', () => {
        for (const timeSec of [4.1, 20.6, 36.1, 52.6]) expect(compileResult(resolvePreset(preset, timeSec)).beams.length).toBeLessThan(300)
      })

      it('keeps authored target geometry stable across Program Intensity changes', () => {
        const low = resolvePreset(preset, 20.6, {}, { intensity: 0.5 })
        const normal = resolvePreset(preset, 20.6, {}, { intensity: 1 })
        const high = resolvePreset(preset, 20.6, {}, { intensity: 1.5 })
        const targets = (result: typeof low) => JSON.stringify(result.showDirector.fixtures.map(fixture => fixture.beam.targets?.map(target => [target.x, target.y])))
        expect(targets(low)).toBe(targets(normal))
        expect(targets(high)).toBe(targets(normal))
        for (let index = 0; index < normal.showDirector.fixtures.length; index += 1) {
          const authoredRotation = preset.createRig(ids(`${preset.id}-authored-${index}`)).fixtures[index].rotation
          const normalDelta = Math.abs(normal.showDirector.fixtures[index].rotation - authoredRotation)
          const highDelta = Math.abs(high.showDirector.fixtures[index].rotation - authoredRotation)
          expect(highDelta).toBeLessThanOrEqual(normalDelta * 1.35 + 8)
        }
      })
    })
  }

  it('assigns Prism kick, snare, hat, and strong-transient hero roles to distinct readable banks', () => {
    const kick = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, 36.6, { kick: true })
    const snare = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, 36.6, { snare: true })
    const hat = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, 36.6, { hat: true })
    const transient = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, 36.6, { transient: 1 })
    const downbeat = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, 36.1)
    const outer = ['prism-upper-outer-left', 'prism-upper-outer-right', 'prism-lower-outer-left', 'prism-lower-outer-right']
    const inner = ['prism-upper-inner-left', 'prism-upper-inner-right', 'prism-lower-inner-left', 'prism-lower-inner-right']
    const center = ['prism-center-accent-left', 'prism-center-accent-right']
    expect(meanBrightness(kick, outer) - meanBrightness(kick, inner)).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumLeadingBrightnessDelta)
    expect(meanBrightness(snare, inner) - meanBrightness(snare, outer)).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumLeadingBrightnessDelta)
    expect(meanBrightness(hat, ['prism-upper-outer-left', 'prism-upper-outer-right'])).toBeGreaterThan(meanBrightness(hat, ['prism-lower-outer-left', 'prism-lower-outer-right']))
    expect(meanBrightness(transient, center)).toBeGreaterThan(meanBrightness(transient, outer))
    expect(meanBrightness(downbeat, center)).toBeGreaterThan(meanBrightness(downbeat, outer))
    expect(center.every(key => fixtureByKey(downbeat, key).color === '#ffffff')).toBe(true)
  })

  it('makes Cardinal horizontal kick and vertical snare banks independently measurable and ducks non-reacting banks', () => {
    const kick = resolvePreset(CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET, 20.6, { kick: true })
    const snare = resolvePreset(CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET, 20.6, { snare: true })
    const downbeat = resolvePreset(CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET, 20.1)
    const horizontal = ['cardinal-left-primary', 'cardinal-left-paired', 'cardinal-right-primary', 'cardinal-right-paired']
    const vertical = ['cardinal-top-primary', 'cardinal-top-paired', 'cardinal-bottom-primary', 'cardinal-bottom-paired']
    expect(meanBrightness(kick, horizontal) - meanBrightness(kick, vertical)).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumLeadingBrightnessDelta)
    expect(meanBrightness(snare, vertical) - meanBrightness(snare, horizontal)).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumLeadingBrightnessDelta)
    const compiledKick = compileResult(kick)
    const compiledSnare = compileResult(snare)
    const meanCompiled = (compiled: typeof compiledKick, result: typeof kick, keys: string[]) => {
      const fixtureIds = keys.map(key => fixtureByKey(result, key).id)
      const beams = compiled.beams.filter(beam => fixtureIds.some(id => beam.id.startsWith(`sd-${id}-`)))
      return beams.reduce((sum, beam) => sum + beam.appearance.dimmer, 0) / Math.max(1, beams.length)
    }
    expect(meanCompiled(compiledKick, kick, horizontal)).toBeGreaterThan(meanCompiled(compiledKick, kick, vertical))
    expect(meanCompiled(compiledSnare, snare, vertical)).toBeGreaterThan(meanCompiled(compiledSnare, snare, horizontal))
    const diagonals = ['cardinal-upper-left-primary', 'cardinal-upper-left-paired', 'cardinal-upper-right-primary', 'cardinal-upper-right-paired', 'cardinal-lower-left-primary', 'cardinal-lower-left-paired', 'cardinal-lower-right-primary', 'cardinal-lower-right-paired']
    expect(meanBrightness(downbeat, [...horizontal, ...vertical])).toBeGreaterThan(meanBrightness(downbeat, diagonals))
    expect([...horizontal, ...vertical].every(key => fixtureByKey(downbeat, key).color === '#ffffff')).toBe(true)
  })

  it('withholds Cardinal full-bank impact on the deterministic fakeout beat', () => {
    const fullImpact = resolvePreset(CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET, 4.1)
    const withheld = resolvePreset(CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET, 6.1)
    const allFour = ['cardinal-left-primary', 'cardinal-left-paired', 'cardinal-right-primary', 'cardinal-right-paired', 'cardinal-top-primary', 'cardinal-top-paired', 'cardinal-bottom-primary', 'cardinal-bottom-paired']
    expect(meanBrightness(withheld, allFour)).toBeLessThan(meanBrightness(fullImpact, allFour) - 0.3)
  })

  it('keeps Cyan Mirror Cage kick walls, snare arrowheads, hats, and mirrored impact crossing distinct without filling the corridor', () => {
    const kick = resolvePreset(CYAN_MIRROR_CAGE_PERFORMANCE_PRESET, 36.6, { kick: true })
    const snare = resolvePreset(CYAN_MIRROR_CAGE_PERFORMANCE_PRESET, 36.6, { snare: true })
    const hat = resolvePreset(CYAN_MIRROR_CAGE_PERFORMANCE_PRESET, 36.6, { hat: true })
    const transient = resolvePreset(CYAN_MIRROR_CAGE_PERFORMANCE_PRESET, 36.6, { transient: 1 })
    const downbeat = resolvePreset(CYAN_MIRROR_CAGE_PERFORMANCE_PRESET, 36.1)
    const outer = kick.showDirector.fixtures.filter(fixture => fixture.semanticKey?.endsWith('-outer')).map(fixture => fixture.semanticKey!)
    const inner = kick.showDirector.fixtures.filter(fixture => fixture.semanticKey?.endsWith('-inner')).map(fixture => fixture.semanticKey!)
    expect(meanBrightness(kick, outer) - meanBrightness(kick, inner)).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumLeadingBrightnessDelta)
    expect(meanBrightness(snare, inner) - meanBrightness(snare, outer)).toBeGreaterThanOrEqual(LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.minimumLeadingBrightnessDelta)
    expect(meanBrightness(hat, ['cage-upper-left-outer', 'cage-upper-right-outer', 'cage-lower-left-outer', 'cage-lower-right-outer'])).toBeGreaterThan(meanBrightness(hat, ['cage-middle-left-inner', 'cage-middle-right-inner']))
    const crossing = ['cage-corner-upper-left', 'cage-corner-upper-right', 'cage-corner-lower-left', 'cage-corner-lower-right', 'cage-middle-left-outer', 'cage-middle-right-outer']
    expect(meanBrightness(transient, crossing)).toBeGreaterThan(meanBrightness(transient, inner))
    expect(meanBrightness(downbeat, crossing)).toBeGreaterThan(meanBrightness(downbeat, inner))
    expect(crossing.every(key => fixtureByKey(downbeat, key).color === '#ffffff')).toBe(true)
    const corridorTargets = transient.showDirector.fixtures
      .filter(fixture => fixture.enabled && !fixture.semanticKey?.includes('corner'))
      .flatMap(fixture => fixture.beam.targets ?? [])
      .filter(target => target.x > 8 && target.x < 10 && target.y > 3 && target.y < 9)
    expect(corridorTargets).toHaveLength(0)
  })
})
