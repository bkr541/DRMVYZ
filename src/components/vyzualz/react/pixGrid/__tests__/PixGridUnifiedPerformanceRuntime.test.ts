import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { ReactPalette, ReactTrackSection } from '../../ReactTypes'
import {
  normalizePixGridActionCue,
  PixGridCueExecutionRuntime,
  resolvePixGridActionCueFrame,
  type PixGridActionCue,
} from '../PixGridActionCues'
import { createPixGridAudioFrame, createSilentPixGridAudioFrame, PixGridReactionRuntime } from '../PixGridAudioRouting'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { applyPixGridGroupFrameEffects, type PixGridGroupFrameEffect } from '../PixGridFrameEffects'
import { PixGridFrameGroupCompiler } from '../PixGridGroupCompiler'
import { compilePixGridGroupMask, createDefaultPixGridReactionAssignment, createPixGridGroup, pixGridMaskHasCell } from '../PixGridGroups'
import { PixGridPerformanceExecutionRuntime, resolvePixGridPerformanceFrame } from '../PixGridPerformanceRuntime'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import { PixGridUnifiedPerformanceRuntime, selectPixGridTransition } from '../PixGridUnifiedPerformanceRuntime'
import { normalizePixGridState } from '../PixGridValidation'
import type { PixGridGroup, PixGridReactionAssignment, PixGridState } from '../PixGridTypes'

const PALETTE: ReactPalette = {
  primary: '#00ffff',
  secondary: '#00ff88',
  accent: '#ff00ff',
  background: '#000000',
  highlight: '#ffffff',
  text: '#ffffff',
}

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.3, source: 'auto', confidence: 0.95 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 24, intensity: 0.55, source: 'auto', confidence: 0.95 },
  { id: 'build', label: 'Build', type: 'build', startSec: 24, endSec: 32, intensity: 0.8, source: 'auto', confidence: 0.95 },
  { id: 'drop', label: 'Drop', type: 'drop', startSec: 32, endSec: 64, intensity: 1, source: 'auto', confidence: 0.95 },
]

function intelligence(
  timeSec: number,
  options: { kick?: boolean; snare?: boolean; hat?: boolean; trackId?: string } = {},
): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const trackId = options.trackId ?? 'track-a'
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: trackId,
    trackId,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass: 0.8,
      mid: 0.55,
      high: 0.4,
      volume: 0.75,
      normalizedBass: 0.8,
      normalizedMid: 0.55,
      normalizedHigh: 0.4,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.98,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: options.kick || options.snare || options.hat || false,
      kickHit: options.kick ?? false,
      kickStrength: options.kick ? 1 : 0,
      snareHit: options.snare ?? false,
      snareStrength: options.snare ? 1 : 0,
      hatHit: options.hat ?? false,
      hatStrength: options.hat ? 1 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.8,
      shortTerm: 0.76,
      longTerm: 0.62,
      percentile: 0.82,
      spectralFlux: 0.4,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.95,
      rhythm: 0.98,
      section: 0.95,
    },
  }
}

function contextAt(
  timeSec: number,
  options: {
    previous?: SharedPerformanceContext | null
    kick?: boolean
    snare?: boolean
    hat?: boolean
    trackId?: string
    seekIdentity?: string
    loopIdentity?: string
    trackChangeIdentity?: string
  } = {},
): SharedPerformanceContext {
  const trackId = options.trackId ?? 'track-a'
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: intelligence(timeSec, options),
    resolvedSections: SECTIONS,
    durationSec: 64,
    trackIdentity: trackId,
    seekIdentity: options.seekIdentity ?? 'seek-0',
    loopIdentity: options.loopIdentity ?? 'loop-0',
    trackChangeIdentity: options.trackChangeIdentity ?? trackId,
    previous: options.previous ?? null,
  })
}

function stateForPreset(presetId = 'pix-grid-bass-beacon'): PixGridState {
  const preset = PIX_GRID_PRESET_BY_ID.get(presetId)
  if (!preset) throw new Error(`Missing preset ${presetId}`)
  return applyPixGridPresetSettings(createDefaultPixGridState(), presetId, preset.pixGridSettings)
}

function cue(id: string, timeSec: number, action: PixGridActionCue['action'], patch: Partial<PixGridActionCue> = {}): PixGridActionCue {
  const normalized = normalizePixGridActionCue({
    version: 1,
    id,
    timeSec,
    label: id,
    enabled: true,
    engineId: 'pixGrid',
    action,
    quantization: 'none',
    transition: 'cut',
    transitionDurationSec: 0,
    oneShotDurationSec: 0.5,
    loopBehavior: 'retrigger',
    order: 0,
    ...patch,
  })
  if (!normalized) throw new Error(`Invalid cue ${id}`)
  return normalized
}

function group(id = 'group-a', runs: PixGridGroup['cellRuns'] = [[0, 0, 2]], reactions: PixGridReactionAssignment[] = []): PixGridGroup {
  return {
    ...createPixGridGroup({ name: id, source: 'manualSelection', mask: { kind: 'runs', runs }, runs }),
    id,
    cellRuns: [...runs],
    mask: { kind: 'runs', runs: [...runs] },
    reactions,
  }
}

function uniformPixels(width: number, height: number, value = 80): Uint8Array {
  const pixels = new Uint8Array(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = value
    pixels[offset + 1] = value
    pixels[offset + 2] = value
    pixels[offset + 3] = 255
  }
  return pixels
}

function applySingleEffect(effect: PixGridGroupFrameEffect, targetGroup: PixGridGroup, width = 4, height = 1): Uint8Array {
  const pixels = uniformPixels(width, height)
  applyPixGridGroupFrameEffects(
    pixels,
    width,
    height,
    [targetGroup],
    [effect],
    PALETTE,
    createSilentPixGridAudioFrame({ trackIdentity: 'track-a', beatIndex: 8, isPlaying: true }),
  )
  return pixels
}

describe('PixGrid unified masked frame effects', () => {
  it('changes only compiled-mask pixels for a Performance flash', () => {
    const state = stateForPreset()
    const runtime = new PixGridPerformanceExecutionRuntime()
    const triggerContext = contextAt(40, { kick: true })
    resolvePixGridPerformanceFrame(state, triggerContext, 'pix-grid-bass-beacon', { runtime })
    const activeContext = contextAt(40.05, { previous: triggerContext })
    const resolved = resolvePixGridPerformanceFrame(state, activeContext, 'pix-grid-bass-beacon', { runtime })
    const effect = resolved.groupEffects.find((candidate) => candidate.kind === 'flash')
    expect(effect).toBeDefined()
    const targetGroup = state.groups.find((candidate) => candidate.id === effect!.groupId)
    expect(targetGroup).toBeDefined()

    const preset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const audio = createPixGridAudioFrame(activeContext, { isPlaying: true, deltaTimeSec: 0.05 })
    const before = composePixGridLogicalFrame(preset, resolved.state, audio)
    const compiler = new PixGridFrameGroupCompiler()
    const after = composePixGridLogicalFrame(preset, resolved.state, audio, undefined, undefined, undefined, null, [effect!], compiler)
    const mask = compiler.compile(targetGroup!)
    expect(mask.cellCount).toBeGreaterThan(0)
    let changedInside = 0
    for (let index = 0; index < state.matrixWidth * state.matrixHeight; index += 1) {
      const changed = after.pixels.slice(index * 4, index * 4 + 4).some((value, channel) => value !== before.pixels[index * 4 + channel])
      if (pixGridMaskHasCell(mask.bits, index)) changedInside += Number(changed)
      else expect(changed).toBe(false)
    }
    expect(changedInside).toBeGreaterThan(0)
  })

  it('keeps setGroupBrightness mask-scoped and preserves equivalent outside cells', () => {
    const state = stateForPreset()
    const context = contextAt(40)
    const resolved = resolvePixGridPerformanceFrame(state, context, 'pix-grid-bass-beacon')
    const effect = resolved.groupEffects.find((candidate) => candidate.kind === 'brightness' && Math.abs(candidate.amount - 1) > 0.01)
    expect(effect).toBeDefined()
    const targetGroup = state.groups.find((candidate) => candidate.id === effect!.groupId)!
    const preset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const audio = createPixGridAudioFrame(context, { isPlaying: true, deltaTimeSec: 1 / 60 })
    const compiler = new PixGridFrameGroupCompiler()
    composePixGridLogicalFrame(preset, resolved.state, audio, undefined, undefined, undefined, null, [], compiler)
    const mask = compiler.compile(targetGroup)
    expect(mask.cellCount).toBeGreaterThan(0)
    const before = uniformPixels(state.matrixWidth, state.matrixHeight, 100)
    const after = new Uint8Array(before)
    applyPixGridGroupFrameEffects(after, state.matrixWidth, state.matrixHeight, state.groups, [effect!], PALETTE, audio, undefined, compiler)
    let changedInside = 0
    for (let index = 0; index < state.matrixWidth * state.matrixHeight; index += 1) {
      const changed = after.slice(index * 4, index * 4 + 4).some((value, channel) => value !== before[index * 4 + channel])
      if (pixGridMaskHasCell(mask.bits, index)) changedInside += Number(changed)
      else expect(changed).toBe(false)
    }
    expect(changedInside).toBeGreaterThan(0)
  })

  it('keeps explicit layer cues whole-layer scoped without creating group effects', () => {
    const state = createDefaultPixGridState()
    const layerId = state.layers[0]!.id
    const resolved = resolvePixGridActionCueFrame(state, [cue('hide-layer', 1, { type: 'setLayerVisible', layerId, visible: false })], 2)
    expect(resolved.state.layers.find((layer) => layer.id === layerId)?.visible).toBe(false)
    expect(resolved.groupEffects).toEqual([])
  })

  it('keeps shifted content inside the group mask', () => {
    const targetGroup = group('shifted', [[0, 0, 3]])
    const effect: PixGridGroupFrameEffect = {
      id: 'shift',
      groupId: targetGroup.id,
      kind: 'shift',
      source: 'cue',
      stage: 'persistent',
      priority: 1,
      amount: 1,
      x: 0.25,
    }
    const pixels = applySingleEffect(effect, targetGroup)
    expect([...pixels.slice(3 * 4, 3 * 4 + 4)]).toEqual([80, 80, 80, 255])
  })
})

describe('PixGrid persistent event envelopes', () => {
  function eventAssignment(source: 'kick' | 'snare' | 'hat', patch: Partial<PixGridReactionAssignment> = {}): PixGridReactionAssignment {
    return {
      ...createDefaultPixGridReactionAssignment(),
      id: `${source}-event`,
      source,
      attack: 0.02,
      hold: 0.08,
      release: 0.2,
      smoothing: 0,
      threshold: 0,
      minimumConfidence: 0,
      capabilityFallback: 'disable',
      ...patch,
    }
  }

  it.each(['kick', 'snare', 'hat'] as const)('%s remains active after the trigger frame', (source) => {
    const runtime = new PixGridReactionRuntime()
    const assignment = eventAssignment(source)
    const trigger = createSilentPixGridAudioFrame({ audioTime: 1, isPlaying: true, beatIndex: 2, [`${source}Hit`]: true })
    runtime.resolve(assignment, trigger)
    const held = runtime.resolve(assignment, { ...trigger, audioTime: 1.1, [`${source}Hit`]: false })
    const released = runtime.resolve(assignment, { ...trigger, audioTime: 1.25, [`${source}Hit`]: false })
    expect(held.value).toBeGreaterThan(0)
    expect(released.value).toBeGreaterThan(0)
  })

  it('implements restart, ignore-while-active, and bounded extend retriggering', () => {
    const first = createSilentPixGridAudioFrame({ audioTime: 1, isPlaying: true, beatIndex: 2, kickHit: true })
    const second = createSilentPixGridAudioFrame({ audioTime: 1.08, isPlaying: true, beatIndex: 3, kickHit: true })
    const sample = createSilentPixGridAudioFrame({ audioTime: 1.12, isPlaying: true, beatIndex: 3, kickHit: false })

    const restart = new PixGridReactionRuntime()
    restart.resolve(eventAssignment('kick', { retrigger: 'restart' }), first)
    restart.resolve(eventAssignment('kick', { retrigger: 'restart' }), second)
    const restarted = restart.resolve(eventAssignment('kick', { retrigger: 'restart' }), sample).value

    const ignored = new PixGridReactionRuntime()
    ignored.resolve(eventAssignment('kick', { retrigger: 'ignoreWhileActive' }), first)
    ignored.resolve(eventAssignment('kick', { retrigger: 'ignoreWhileActive' }), second)
    const ignoredValue = ignored.resolve(eventAssignment('kick', { retrigger: 'ignoreWhileActive' }), sample).value

    const extended = new PixGridReactionRuntime()
    extended.resolve(eventAssignment('kick', { retrigger: 'extend', blend: 'add', maximumStacking: 2 }), first)
    extended.resolve(eventAssignment('kick', { retrigger: 'extend', blend: 'add', maximumStacking: 2 }), second)
    const extendedValue = extended.resolve(eventAssignment('kick', { retrigger: 'extend', blend: 'add', maximumStacking: 2 }), sample).value

    expect(restarted).toBeGreaterThan(ignoredValue)
    expect(extendedValue).toBeGreaterThanOrEqual(restarted)
    expect(extendedValue).toBeLessThanOrEqual(1)
  })

  it('holds envelope progress while paused and clears track-local state on replacement', () => {
    const runtime = new PixGridReactionRuntime()
    const assignment = eventAssignment('snare')
    const fired = createSilentPixGridAudioFrame({ audioTime: 2, isPlaying: true, beatIndex: 4, snareHit: true, trackIdentity: 'track-a' })
    runtime.resolve(assignment, fired)
    const live = runtime.resolve(assignment, { ...fired, audioTime: 2.1, snareHit: false }).value
    const paused = runtime.resolve(assignment, { ...fired, audioTime: 2.1, snareHit: false, isPlaying: false }).value
    const replaced = runtime.resolve(assignment, { ...fired, audioTime: 2.1, snareHit: false, trackIdentity: 'track-b' }).value
    expect(paused).toBeCloseTo(live)
    expect(replaced).toBe(0)
  })

  it('reconstructs safely after seek and does not accumulate across loop wraps', () => {
    const runtime = new PixGridReactionRuntime()
    const assignment = eventAssignment('hat', { retrigger: 'extend', blend: 'add', maximumStacking: 2 })
    runtime.resolve(
      assignment,
      createSilentPixGridAudioFrame({ audioTime: 8, isPlaying: true, beatIndex: 16, hatHit: true, trackIdentity: 'track-a' }),
    )
    const sought = runtime.resolve(
      assignment,
      createSilentPixGridAudioFrame({ audioTime: 2, isPlaying: true, beatIndex: 4, timingDiscontinuity: true, trackIdentity: 'track-a' }),
    )
    expect(sought.value).toBe(0)
    for (let index = 0; index < 12; index += 1) {
      runtime.resolve(
        assignment,
        createSilentPixGridAudioFrame({
          audioTime: 2 + index * 0.01,
          isPlaying: true,
          beatIndex: 5 + index,
          hatHit: true,
          trackIdentity: 'track-a',
        }),
      )
    }
    const bounded = runtime.resolve(
      assignment,
      createSilentPixGridAudioFrame({ audioTime: 2.2, isPlaying: true, beatIndex: 20, trackIdentity: 'track-a' }),
    )
    expect(bounded.value).toBeLessThanOrEqual(1)
  })
})

describe('PixGrid unified composition and reconstruction', () => {
  it('combines continuous modulation and transient effects deterministically', () => {
    const continuous = {
      ...createDefaultPixGridReactionAssignment(),
      id: 'bass',
      source: 'bass' as const,
      target: 'brightness' as const,
      amount: 0.5,
      smoothing: 0,
    }
    const transient = {
      ...createDefaultPixGridReactionAssignment(),
      id: 'kick',
      source: 'kick' as const,
      target: 'outlineFlash' as const,
      amount: 1,
      attack: 0,
      hold: 0.1,
      release: 0.2,
      smoothing: 0,
    }
    const targetGroup = group('combined', [[0, 0, 4]], [continuous, transient])
    const state = { ...createDefaultPixGridState(), matrixWidth: 4, matrixHeight: 1, groups: [targetGroup] }
    const preset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const audio = createSilentPixGridAudioFrame({ bass: 0.8, kickHit: true, audioTime: 1, beatIndex: 2, isPlaying: true })
    const effect: PixGridGroupFrameEffect = {
      id: 'program-flash',
      groupId: targetGroup.id,
      kind: 'flash',
      source: 'performance',
      stage: 'event',
      priority: 420,
      amount: 0.5,
    }
    const first = composePixGridLogicalFrame(preset, state, audio, undefined, undefined, new PixGridReactionRuntime(), null, [effect])
    const second = composePixGridLogicalFrame(preset, state, audio, undefined, undefined, new PixGridReactionRuntime(), null, [effect])
    expect(second.pixels).toEqual(first.pixels)
  })

  it('forwards Performance Program transitions into the logical compositor', () => {
    const state = stateForPreset()
    const context = contextAt(0.1)
    const resolved = resolvePixGridPerformanceFrame(state, context, 'pix-grid-bass-beacon', {
      runtime: new PixGridPerformanceExecutionRuntime(),
    })
    expect(resolved.transition?.type).toBe('crossfade')
    const preset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const audio = createPixGridAudioFrame(context, { isPlaying: true, deltaTimeSec: 1 / 60 })
    const direct = composePixGridLogicalFrame(
      preset,
      resolved.state,
      audio,
      undefined,
      undefined,
      new PixGridReactionRuntime(),
      null,
      resolved.groupEffects,
    )
    const transition = {
      ...resolved.transition!,
      fromState: {
        ...resolved.transition!.fromState,
        layers: resolved.transition!.fromState.layers.map((layer) => ({ ...layer, visible: false })),
      },
    }
    const transitioning = composePixGridLogicalFrame(
      preset,
      resolved.state,
      audio,
      undefined,
      undefined,
      new PixGridReactionRuntime(),
      transition,
      resolved.groupEffects,
    )
    expect(transitioning.pixels).not.toEqual(direct.pixels)
  })

  it('preserves Track Map transitions and gives them deterministic precedence', () => {
    const state = stateForPreset()
    const cueFrame = resolvePixGridActionCueFrame(
      state,
      [cue('scene', 1, { type: 'selectScene', sceneId: state.scenes[1]!.id }, { transition: 'rowWipe', transitionDurationSec: 2 })],
      1.5,
      { runtime: new PixGridCueExecutionRuntime() },
    )
    expect(cueFrame.transition?.type).toBe('rowWipe')
    const performanceTransition = {
      cueId: 'performance',
      type: 'crossfade' as const,
      progress: 0.5,
      startedAtSec: 1,
      durationSec: 1,
      seed: 1,
      fromState: state,
    }
    expect(selectPixGridTransition(cueFrame.transition, performanceTransition)?.cueId).toBe('scene')
    expect(selectPixGridTransition(null, performanceTransition)?.cueId).toBe('performance')
  })

  it('holds cue transition progress on pause and reconstructs progress after seek', () => {
    const state = stateForPreset()
    const transitionCue = cue(
      'scene',
      4,
      { type: 'selectScene', sceneId: state.scenes[1]!.id },
      { transition: 'crossfade', transitionDurationSec: 2 },
    )
    const runtime = new PixGridCueExecutionRuntime()
    const first = resolvePixGridActionCueFrame(state, [transitionCue], 4.5, { runtime })
    const paused = resolvePixGridActionCueFrame(state, [transitionCue], 4.5, { runtime })
    const sought = resolvePixGridActionCueFrame(state, [transitionCue], 5, { runtime: new PixGridCueExecutionRuntime() })
    expect(paused.transition?.progress).toBeCloseTo(first.transition?.progress ?? -1)
    expect(sought.transition?.progress).toBeCloseTo(0.5)
  })

  it('reconstructs persistent cues and resets track-specific runtime state on replacement', () => {
    const authored = stateForPreset()
    const layerId = authored.layers[0]!.id
    const cues = [cue('hide', 2, { type: 'setLayerVisible', layerId, visible: false })]
    const unified = new PixGridUnifiedPerformanceRuntime()
    const firstContext = contextAt(10)
    const first = unified.resolve({
      authoredState: authored,
      context: firstContext,
      audioFrame: createPixGridAudioFrame(firstContext, { isPlaying: true, deltaTimeSec: 1 / 60 }),
      presetId: 'pix-grid-bass-beacon',
      cues,
      trackId: 'track-a',
    })
    expect(first.state.layers.find((layer) => layer.id === layerId)?.visible).toBe(false)
    const replacementContext = contextAt(1, { previous: firstContext, trackId: 'track-b', trackChangeIdentity: 'track-b' })
    const replacement = unified.resolve({
      authoredState: authored,
      context: replacementContext,
      audioFrame: createPixGridAudioFrame(replacementContext, { isPlaying: true, deltaTimeSec: 1 / 60 }),
      presetId: 'pix-grid-bass-beacon',
      cues: [],
      trackId: 'track-b',
    })
    expect(replacement.state.layers.find((layer) => layer.id === layerId)?.visible).toBe(
      authored.layers.find((layer) => layer.id === layerId)?.visible,
    )
    expect(replacement.cues.snapshot.activeCueIds).toEqual([])
  })

  it('reports only real continuous/discrete assignments and compiled masks', () => {
    const authored = stateForPreset()
    const emptyEnabled = group('empty-enabled', [[0, 0, 1]], [])
    const continuous = { ...createDefaultPixGridReactionAssignment(), id: 'bass-route', source: 'bass' as const }
    const discrete = { ...createDefaultPixGridReactionAssignment(), id: 'kick-route', source: 'kick' as const }
    const routed = group('routed', [[0, 1, 1]], [continuous, discrete])
    const state = { ...authored, groups: [emptyEnabled, routed], audioAssignments: [] }
    const context = contextAt(10)
    const resolved = new PixGridUnifiedPerformanceRuntime().resolve({
      authoredState: state,
      context,
      audioFrame: createPixGridAudioFrame(context, { isPlaying: true, deltaTimeSec: 1 / 60 }),
      presetId: null,
      cues: [],
    })
    expect(resolved.diagnostics.enabledGroups).toEqual(['empty-enabled', 'routed'])
    expect(resolved.diagnostics.compiledMaskGroups).toEqual(['empty-enabled', 'routed'])
    expect(resolved.diagnostics.activeContinuousAssignments).toEqual(['routed:bass-route'])
    expect(resolved.diagnostics.activeDiscreteAssignments).toEqual(['routed:kick-route'])
  })

  it('migrates legacy assignments into bounded unified envelope fields', () => {
    const base = createDefaultPixGridState()
    const legacy = group(
      'legacy',
      [[0, 0, 1]],
      [
        {
          ...createDefaultPixGridReactionAssignment(),
          id: 'legacy-reaction',
          hysteresis: 99,
          maximumStacking: 99,
          eventPriority: 99_999,
          decayCurve: 'invalid' as never,
        },
      ],
    )
    const normalized = normalizePixGridState({ ...base, version: 6, groups: [legacy] })
    expect(normalized.groups[0]!.reactions[0]).toMatchObject({
      hysteresis: 0.5,
      maximumStacking: 8,
      eventPriority: 1000,
      decayCurve: 'easeOut',
    })
  })

  it('does not mutate whole layers for group-targeted Performance events', () => {
    const state = stateForPreset()
    const withoutKick = resolvePixGridPerformanceFrame(state, contextAt(40), 'pix-grid-bass-beacon')
    const runtime = new PixGridPerformanceExecutionRuntime()
    const triggerContext = contextAt(40, { kick: true })
    const triggered = resolvePixGridPerformanceFrame(state, triggerContext, 'pix-grid-bass-beacon', { runtime })
    const active = resolvePixGridPerformanceFrame(state, contextAt(40.05, { previous: triggerContext }), 'pix-grid-bass-beacon', {
      runtime,
    })
    expect(triggered.state.layers).toEqual(withoutKick.state.layers)
    expect(active.groupEffects.some((effect) => effect.kind === 'flash')).toBe(true)
  })
})
