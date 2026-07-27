import { describe, expect, it } from 'vitest'
import { PixGridReactionRuntime, createSilentPixGridAudioFrame } from '../PixGridAudioRouting'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridRuntimeControls } from '../PixGridRuntimeControls'
import { applyPixGridPresetSettings } from '../PixGridState'
import { migratePixGridState } from '../PixGridStateMigration'
import type { PixGridAudioFrame, PixGridReactionSource, PixGridState } from '../PixGridTypes'

const PRESET = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!

function stateForPreset(): PixGridState {
  return applyPixGridPresetSettings(createDefaultPixGridState(), PRESET.id, PRESET.pixGridSettings)
}

function frameAt(
  audioTime: number,
  sources: Partial<Record<PixGridReactionSource, number>>,
  patch: Partial<PixGridAudioFrame> = {},
  controls = { bassReactivity: 1, motion: 1 },
): PixGridAudioFrame {
  const hit = (source: PixGridReactionSource) => (sources[source] ?? 0) > 0
  return applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
    audioTime,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    transportState: 'playing',
    trackIdentity: 'patch-3-full-song',
    beatIndex: Math.floor(audioTime * 2),
    barIndex: Math.floor(audioTime / 2),
    phraseIndex: Math.floor(audioTime / 8),
    sectionType: 'verse',
    sectionPhase: 'body',
    phraseSegment: 'middle',
    kickHit: hit('kick'),
    snareHit: hit('snare'),
    hatHit: hit('hat'),
    beatHit: hit('beat') || hit('kick') || hit('snare'),
    transientHit: hit('transient'),
    dropImpactHit: hit('dropImpact'),
    phraseEntry: hit('phraseEntry'),
    sourceValues: sources,
    eventIdentities: Object.fromEntries(
      Object.entries(sources)
        .filter(([, value]) => (value ?? 0) > 0)
        .map(([source]) => [source, `${audioTime.toFixed(3)}:${source}`]),
    ),
    ...patch,
  }), controls)
}

function hash(pixels: Uint8Array): string {
  let value = 2166136261
  for (const byte of pixels) {
    value ^= byte
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0).toString(16)
}

function render(state: PixGridState, runtime: PixGridReactionRuntime, frame: PixGridAudioFrame): string {
  return hash(composePixGridLogicalFrame(PRESET, state, frame, undefined, null, runtime).pixels)
}

function renderSecondDrop(state: PixGridState, runtime: PixGridReactionRuntime, timingDiscontinuity = false): string {
  const trigger = frameAt(80.1, {
    kick: 1,
    snare: 0.8,
    beat: 1,
    transient: 1,
    dropImpact: 1,
    bass: 1,
    sub: 0.9,
    energy: 1,
  }, {
    sectionType: 'drop',
    sectionPhase: 'entry',
    sectionOccurrence: 2,
    dropOccurrence: 2,
    timingDiscontinuity,
  })
  render(state, runtime, trigger)
  return render(state, runtime, {
    ...trigger,
    audioTime: 80.16,
    deltaTimeSec: 0.06,
    timingDiscontinuity: false,
    kickHit: false,
    snareHit: false,
    beatHit: false,
    transientHit: false,
    dropImpactHit: false,
    sourceValues: {
      ...trigger.sourceValues,
      kick: 0,
      snare: 0,
      beat: 0,
      transient: 0,
      dropImpact: 0,
    },
  })
}

describe('PixGrid full-song deterministic reconstruction', () => {
  it('resolves the same second-drop state after forward seek, backward seek, and loop re-entry', () => {
    const state = stateForPreset()
    const fresh = renderSecondDrop(state, new PixGridReactionRuntime(), true)

    const backwardRuntime = new PixGridReactionRuntime()
    render(state, backwardRuntime, frameAt(112, { energy: 0.2 }, { sectionType: 'outro' }))
    const backwardSeek = renderSecondDrop(state, backwardRuntime, true)

    const loopRuntime = new PixGridReactionRuntime()
    renderSecondDrop(state, loopRuntime, false)
    render(state, loopRuntime, frameAt(84, { energy: 0.8, bass: 0.8 }, { sectionType: 'drop', dropOccurrence: 2 }))
    const loopReentry = renderSecondDrop(state, loopRuntime, true)

    expect(backwardSeek).toBe(fresh)
    expect(loopReentry).toBe(fresh)
  })

  it('holds the resolved frame while paused and resumes deterministically', () => {
    const state = stateForPreset()
    const runtime = new PixGridReactionRuntime()
    const playing = frameAt(40, { bass: 0.8, energy: 0.7 }, { sectionType: 'drop', dropOccurrence: 1 })
    const playingHash = render(state, runtime, playing)
    const pausedHash = render(state, runtime, { ...playing, isPlaying: false, transportState: 'paused', deltaTimeSec: 0 })
    const resumedHash = render(state, runtime, { ...playing, isPlaying: true, transportState: 'playing', deltaTimeSec: 0 })
    expect(pausedHash).toBe(playingHash)
    expect(resumedHash).toBe(playingHash)
  })

  it('makes Motion and Bass Reactivity deterministic at 0, 0.5, and 1', () => {
    const state = stateForPreset()
    const hashes = [0, 0.5, 1].map(bassReactivity => render(
      state,
      new PixGridReactionRuntime(),
      frameAt(18, { bass: 1, sub: 1, bassStemActivity: 1, energy: 0.6 }, {}, { bassReactivity, motion: 1 }),
    ))
    expect(new Set(hashes).size).toBe(3)

    const motionHashes = [0, 0.5, 1].map(motion => render(
      state,
      new PixGridReactionRuntime(),
      frameAt(22.25, {}, {}, { bassReactivity: 1, motion }),
    ))
    expect(new Set(motionHashes).size).toBe(3)
  })

  it('keeps migrated and freshly selected built-in states visually equivalent', () => {
    const fresh = stateForPreset()
    const legacy = {
      ...fresh,
      version: fresh.version - 1,
      configuration: undefined,
      groups: [],
      audioAssignments: [],
      performance: { ...fresh.performance, sharedPerformanceProgramId: null },
    }
    const migrated = migratePixGridState(legacy, PRESET)
    const freshHash = renderSecondDrop(fresh, new PixGridReactionRuntime(), true)
    const migratedHash = renderSecondDrop(migrated, new PixGridReactionRuntime(), true)
    expect(migratedHash).toBe(freshHash)
    expect(migrated.configuration.lastMigration).toMatchObject({
      applied: true,
      originalBuiltInPresetId: PRESET.id,
      customizationsPreserved: false,
    })
  })

  it('clears transient route state at track end and after a preset/runtime reset', () => {
    const state = stateForPreset()
    const runtime = new PixGridReactionRuntime()
    renderSecondDrop(state, runtime)
    expect(runtime.getDiagnostics().activeCompiledAssignments.length).toBeGreaterThan(0)

    runtime.reset()
    const stopped = frameAt(128, {}, {
      isPlaying: false,
      transportState: 'stopped',
      timingDiscontinuity: true,
      sectionType: 'outro',
    })
    render(state, runtime, stopped)
    const diagnostics = runtime.getDiagnostics()
    expect(diagnostics.activeCompiledAssignments).toEqual([])
    expect(diagnostics.activeEnvelopes).toEqual([])
    expect(diagnostics.routeActivity.every(route => route.state === 'idle' || route.state === 'disabled' || route.state === 'blocked')).toBe(true)
  })
})
