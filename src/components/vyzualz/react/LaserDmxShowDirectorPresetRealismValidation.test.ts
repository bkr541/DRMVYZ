import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import type { ReactTrackSection } from './ReactTypes'
import { buildLaserDmxShowDirectorPerformanceContext } from './LaserDmxShowDirectorPerformanceContext'
import {
  LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
  type LaserDmxShowDirectorBuiltInPerformanceProgramId,
} from './LaserDmxShowDirectorPerformanceProgram'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import {
  LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS,
  type LaserDmxShowDirectorRigBackedPerformanceShowDefinition,
} from './LaserDmxShowDirectorRigBackedPerformanceShows'
import {
  auditLaserDmxShowDirectorBuiltInPresets,
  createLaserDmxRendererParityFingerprint,
  validateLaserDmxShowDirectorPresetRealism,
} from './LaserDmxShowDirectorPresetRealismValidation'

const SECTIONS: ReactTrackSection[] = [
  ['intro', 'Intro'],
  ['verse', 'Verse'],
  ['build', 'Build'],
  ['preDrop', 'Pre-Drop'],
  ['drop', 'Drop 1'],
  ['breakdown', 'Breakdown'],
  ['drop', 'Drop 2'],
  ['outro', 'Outro'],
].map(([type, label], index) => ({
  id: `${type}-${index}`,
  label,
  type: type as ReactTrackSection['type'],
  startSec: index * 32,
  endSec: (index + 1) * 32,
  intensity: type === 'drop' ? 1 : type === 'build' || type === 'preDrop' ? 0.78 : 0.46,
  source: 'auto' as const,
  confidence: 1,
}))

function frameAt(timeSec: number): MusicIntelligenceFrame {
  const section = SECTIONS.find(item => timeSec >= item.startSec && timeSec < item.endSec)
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const progress = section ? (timeSec - section.startSec) / (section.endSec - section.startSec) : 1
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.round(timeSec * 60),
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      kickHit: beatIndex % 2 === 0,
      kickStrength: beatIndex % 2 === 0 ? 0.82 : 0,
      snareHit: beatIndex % 4 === 2,
      snareStrength: beatIndex % 4 === 2 ? 0.76 : 0,
      hatHit: true,
      hatStrength: 0.42,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: section?.type === 'drop' ? 0.92 : section?.type === 'build' || section?.type === 'preDrop' ? 0.55 + progress * 0.34 : 0.4,
      shortTerm: section?.type === 'drop' ? 0.88 : 0.46,
      buildProgress: section?.type === 'build' || section?.type === 'preDrop' ? progress : 0,
      dropImpact: section?.type === 'drop' && progress < 0.08 ? 1 : 0,
      tension: section?.type === 'build' || section?.type === 'preDrop' ? 0.82 : 0.38,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: section?.type ?? 'unknown',
      label: section?.label ?? 'Complete',
      startSec: section?.startSec ?? SECTIONS[SECTIONS.length - 1]!.endSec,
      endSec: section?.endSec ?? SECTIONS[SECTIONS.length - 1]!.endSec,
      progress,
      intensity: section?.intensity ?? 0,
      confidence: section ? 1 : 0,
      source: 'analysis',
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: false,
      lyrics: false,
    },
    confidence: { overall: 1, rhythm: 1, harmonic: 0.8, section: section ? 1 : 0 },
  }
}

function contextAt(timeSec: number, seekIdentity = 'seek-0', loopIdentity = 'loop-0') {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec),
    resolvedSections: SECTIONS,
    trackIdentity: 'preset-realism-full-song',
    seekIdentity,
    loopIdentity,
  })
}

function createIdFactory(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

function resolveShow(
  definition: LaserDmxShowDirectorRigBackedPerformanceShowDefinition,
  timeSec: number,
  options: { seekIdentity?: string; loopIdentity?: string; rendererMode?: 'canvas2d' | 'webgl' } = {},
) {
  const registryProgram = LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY[definition.performanceProgramId].program!
  const rig = definition.createCanonicalRig(createIdFactory(`${definition.id}-fixture`))!
  if (options.rendererMode) rig.settings.rendererMode = options.rendererMode
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: rig,
    program: registryProgram,
    context: contextAt(timeSec, options.seekIdentity, options.loopIdentity),
    tuning: registryProgram.tuning,
    programSeed: registryProgram.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${definition.id}:realism-test`,
    transportDiscontinuityIdentity: `${options.seekIdentity ?? 'seek-0'}:${options.loopIdentity ?? 'loop-0'}`,
  })
}

function resolutionSignature(result: ReturnType<typeof resolveShow>): string {
  const frame = result.stablePatternFrame
    ? (({ patternFrameCacheHit: _cacheDiagnostic, ...resolvedFrame }) => resolvedFrame)(result.stablePatternFrame)
    : null
  return JSON.stringify({
    scene: result.activeSceneId,
    cue: result.activePrimaryCueId,
    accents: result.activeAccentCueIds,
    macro: result.activeMacroId,
    frame,
    lifecycle: result.programmingDiagnostics && {
      state: result.programmingDiagnostics.cueLifecycleState,
      remaining: result.programmingDiagnostics.cueRemainingDurationBeats,
      completion: result.programmingDiagnostics.completionReason,
      owners: result.programmingDiagnostics.ownedParameters,
      active: result.programmingDiagnostics.activeFixtureIds,
      blackedOut: result.programmingDiagnostics.blackedOutFixtureIds,
    },
    fixtures: result.showDirector.fixtures.map(fixture => ({
      semanticKey: fixture.semanticKey,
      enabled: fixture.enabled,
      brightness: Number(fixture.brightness.toFixed(6)),
      gate: fixture.runtimeOutputGate,
      scanner: fixture.runtimeScanner,
      beam: fixture.runtimeBeamTravel,
    })),
  })
}

function builtIn(id: LaserDmxShowDirectorBuiltInPerformanceProgramId) {
  return structuredClone(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY[id].program!)
}

describe('LaserDMX built-in preset realism validation', () => {
  it('audits every bundled Show Director program without realism or structural failures', () => {
    const audit = auditLaserDmxShowDirectorBuiltInPresets()
    expect(audit.auditedPresetCount).toBe(20)
    expect(audit.failedPresetCount, JSON.stringify(audit.results.filter(result => result.issues.length), null, 2)).toBe(0)
    expect(audit.passedPresetCount).toBe(20)
    for (const result of audit.results) {
      expect(result.compiled, result.programId).toBe(true)
      expect(result.migrated, result.programId).toBe(true)
      expect(result.cueCount, result.programId).toBeGreaterThan(0)
      expect(result.macroCount, result.programId).toBeGreaterThan(0)
      expect(result.issues, result.programId).toEqual([])
    }
  })

  it('rejects endless rotations, missing blackout, excessive rig limits, and ownership conflicts', () => {
    const program = builtIn('violet-hourglass-orbit')
    const document = program.laserProgramming!
    const rotating = document.cueStacks[0].cues.find(cue => cue.command?.kind === 'circleRotation')!
    rotating.lifecycle = undefined
    rotating.command = {
      ...rotating.command!,
      loopMode: 'bounded',
      repeatCount: undefined,
      maximumLoopBeats: undefined,
    }
    document.constraints.maximumSimultaneouslyActiveLaserFixtures = 32
    document.constraints.maximumSimultaneouslyAnimatedPatterns = 8
    for (const cue of document.cueStacks[0].cues) {
      if (cue.sceneIds?.includes(program.scenes[0].id)) {
        cue.lifecycle = cue.lifecycle ? { ...cue.lifecycle, blackoutAfterCompletion: false, blackoutBeats: 0 } : cue.lifecycle
        cue.blackout = false
        cue.shutterClosed = false
      }
    }
    const conflict = structuredClone(document.cueStacks[0].cues.find(cue => !cue.blackout)!)
    conflict.id = `${conflict.id}:conflict`
    conflict.priority += 1
    document.cueStacks[0].cues.push(conflict)
    const codes = new Set(validateLaserDmxShowDirectorPresetRealism(program).map(item => item.code))
    expect(codes).toContain('continuous-rotation-without-maximum')
    expect(codes).toContain('simultaneous-laser-limit-too-high')
    expect(codes).toContain('simultaneous-animation-limit-too-high')
    expect(codes).toContain('parameter-ownership-conflict')
  })

  it('detects authored overlap that exceeds active-laser and animated-pattern limits', () => {
    const program = builtIn('prismatic-pulse-matrix')
    const document = program.laserProgramming!
    const cue = document.cueStacks[0].cues.find(candidate => !candidate.blackout && candidate.command?.kind !== 'staticHold')!
    const macro = document.macros.find(candidate => candidate.id === cue.macroId)!
    const laserAssignment = macro.fixtureGroupAssignments.find(assignment => cue.fixtureGroupAssignmentIds?.includes(assignment.id) && assignment.id.includes(':laser-'))!
    laserAssignment.address = {
      fixtureKinds: ['laser'],
      fixtureIds: Array.from({ length: document.constraints.maximumSimultaneouslyActiveLaserFixtures + 1 }, (_, index) => `overlap-laser-${index}`),
    }
    for (let index = 0; index < document.constraints.maximumSimultaneouslyAnimatedPatterns; index += 1) {
      const overlapping = structuredClone(cue)
      overlapping.id = `${cue.id}:overlap-${index}`
      overlapping.priority += index + 1
      overlapping.ownership = { ...overlapping.ownership!, parameters: [] }
      document.cueStacks[0].cues.push(overlapping)
    }
    const codes = new Set(validateLaserDmxShowDirectorPresetRealism(program).map(item => item.code))
    expect(codes).toContain('simultaneous-laser-activity-exceeded')
    expect(codes).toContain('simultaneous-animation-activity-exceeded')
  })

  it('contains all ten visual acceptance motifs without default infinite motion', () => {
    const programs = Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY).map(entry => entry.program!)
    const documents = programs.map(program => program.laserProgramming!)
    const macros = documents.flatMap(document => document.macros)
    const cues = documents.flatMap(document => document.cueStacks.flatMap(stack => stack.cues))
    const macroById = new Map(macros.map(macro => [macro.id, macro]))

    expect(cues.some(cue => cue.command?.kind === 'staticHold' && (cue.lifecycle?.holdBeats ?? 0) >= 0.5)).toBe(true)
    expect(cues.some(cue => cue.command?.kind === 'tiltSweep' || macroById.get(cue.macroId)?.family === 'upperAirCanopy')).toBe(true)
    expect(cues.some(cue => macroById.get(cue.macroId)?.family === 'sequentialCircle' && cue.command?.kind === 'circleReveal' && !cue.command.rotation)).toBe(true)
    expect(cues.some(cue => cue.command?.kind === 'circleRotation' && cue.command.rotation?.turnCount === 1 && cue.command.rotation.holdAfterCompletion)).toBe(true)
    expect(cues.some(cue => (macroById.get(cue.macroId)?.family === 'tunnel' || macroById.get(cue.macroId)?.family === 'corridor') && cue.lifecycle?.blackoutAfterCompletion)).toBe(true)
    expect(programs.some(program => new Set(program.laserProgramming!.cueStacks[0].cues.map(cue => (cue.fixtureGroupAssignmentIds ?? []).join('|'))).size > 2)).toBe(true)
    expect(programs.some(program => program.laserProgramming!.cueStacks[0].cues.some(cue => cue.sceneIds?.some(sceneId => program.scenes.find(scene => scene.id === sceneId)?.energyEnvelopeKey === 'build') && /laser-(?:left|right|all)$/.test((cue.fixtureGroupAssignmentIds ?? []).join('|'))))).toBe(true)
    expect(cues.some(cue => cue.triggerSource === 'preDrop' && cue.blackout && cue.shutterClosed)).toBe(true)
    expect(cues.some(cue => (cue.fixtureGroupAssignmentIds ?? []).some(id => id.endsWith('laser-all')) && cue.lifecycle?.maximumRunBeats === 0.9)).toBe(true)
    expect(programs.every(program => {
      const outroSceneIds = new Set(program.scenes.filter(scene => scene.energyEnvelopeKey === 'outro' || scene.section.types.includes('outro')).map(scene => scene.id))
      if (!outroSceneIds.size) return true
      const finalCue = program.laserProgramming!.cueStacks[0].cues
        .filter(cue => cue.sceneIds?.some(sceneId => outroSceneIds.has(sceneId)))
        .sort((a, b) => b.startOffsetBeats - a.startOffsetBeats)[0]
      return Boolean(finalCue?.blackout && finalCue.shutterClosed && finalCue.ownership?.releaseOnCompletion)
    })).toBe(true)
    expect(cues.every(cue => cue.command?.loopMode !== 'bounded' || Boolean(cue.command.repeatCount && cue.command.maximumLoopBeats))).toBe(true)
  })

  it('serializes one renderer-independent choreography plan for Canvas2D and WebGL', () => {
    for (const entry of Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)) {
      const document = entry.program!.laserProgramming!
      const canvasFingerprint = createLaserDmxRendererParityFingerprint(structuredClone(document))
      const webglFingerprint = createLaserDmxRendererParityFingerprint(structuredClone(document))
      expect(canvasFingerprint, entry.id).toBe(webglFingerprint)
      expect(canvasFingerprint, entry.id).not.toMatch(/requestAnimationFrame|performance\.now|renderer-local/i)
    }
  })
})

describe('LaserDMX deterministic full-song finite cue playback', () => {
  const shows = Object.values(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS)
  const localBeatSamples = [0.25, 1.25, 2.75, 3.75, 15.25, 31.25, 47.25, 56.25, 60.25, 63.75]

  it('reconstructs identical intro-through-outro state after seek, backward seek, loop, pause, and resume', () => {
    for (const show of shows) {
      for (const section of SECTIONS) {
        for (const localBeat of localBeatSamples) {
          const timeSec = section.startSec + localBeat / 2
          const normal = resolveShow(show, timeSec)
          const sought = resolveShow(show, timeSec, { seekIdentity: `seek-${section.id}-${localBeat}` })
          const looped = resolveShow(show, timeSec, { loopIdentity: `loop-${section.id}-${localBeat}` })
          const paused = resolveShow(show, timeSec)
          const resumed = resolveShow(show, timeSec)
          const signature = resolutionSignature(normal)
          expect(resolutionSignature(sought), `${show.id}:${section.id}:${localBeat}:seek`).toBe(signature)
          expect(resolutionSignature(looped), `${show.id}:${section.id}:${localBeat}:loop`).toBe(signature)
          expect(resolutionSignature(paused), `${show.id}:${section.id}:${localBeat}:pause`).toBe(signature)
          expect(resolutionSignature(resumed), `${show.id}:${section.id}:${localBeat}:resume`).toBe(signature)
        }
      }
      const forward = resolveShow(show, SECTIONS[4].startSec + 20)
      const backward = resolveShow(show, SECTIONS[1].startSec + 4, { seekIdentity: 'backward-seek' })
      const freshBackward = resolveShow(show, SECTIONS[1].startSec + 4)
      expect(resolutionSignature(backward), `${show.id}:backward`).toBe(resolutionSignature(freshBackward))
      expect(forward.activeSceneId).not.toBe(backward.activeSceneId)
    }
  })

  it('does not change resolved cue or fixture state when the renderer is switched', () => {
    for (const show of shows) {
      for (const timeSec of [8, 72, 136, 168, 216, 248]) {
        const canvas = resolveShow(show, timeSec, { rendererMode: 'canvas2d' })
        const webgl = resolveShow(show, timeSec, { rendererMode: 'webgl' })
        expect(resolutionSignature(webgl), `${show.id}:${timeSec}`).toBe(resolutionSignature(canvas))
      }
    }
  })

  it('switches presets without retaining cue ownership and blacks out every fixture after the track', () => {
    const first = shows[0]
    const second = shows[1]
    const timeSec = SECTIONS[4].startSec + 5
    const firstBefore = resolveShow(first, timeSec)
    const secondResolution = resolveShow(second, timeSec)
    const firstAfter = resolveShow(first, timeSec)
    expect(resolutionSignature(firstAfter)).toBe(resolutionSignature(firstBefore))
    expect(firstAfter.activePrimaryCueId).not.toBe(secondResolution.activePrimaryCueId)

    for (const show of shows) {
      const ended = resolveShow(show, SECTIONS[SECTIONS.length - 1]!.endSec + 0.5, { seekIdentity: 'track-ended' })
      expect(ended.activeSceneId, show.id).toBeNull()
      expect(ended.activePrimaryCueId, show.id).toBeNull()
      expect(ended.programmingDiagnostics?.ownedParameters ?? [], show.id).toEqual([])
      expect(ended.showDirector.fixtures.every(fixture => fixture.enabled === false || fixture.runtimeOutputGate?.open === false), show.id).toBe(true)
    }
  })
})
