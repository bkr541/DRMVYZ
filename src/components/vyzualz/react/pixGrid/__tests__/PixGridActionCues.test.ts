import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BeatMarkerMI } from '../../../../../features/musicIntelligence/types'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { MAX_PIX_GRID_ACTION_CUES_PER_TRACK, MAX_PIX_GRID_ACTION_CUE_TRACKS } from '../PixGridLimits'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { PIX_GRID_PRESETS } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import {
  PixGridCueExecutionRuntime,
  normalizePixGridActionCue,
  normalizePixGridActionCueMap,
  resolvePixGridActionCueFrame,
  snapPixGridCueTime,
  sortPixGridActionCues,
  type PixGridActionCue,
  type PixGridActionCueAction,
} from '../PixGridActionCues'
import type { PixGridAudioFrame, PixGridLayer } from '../PixGridTypes'

function cue(id: string, timeSec: number, action: PixGridActionCueAction, patch: Partial<PixGridActionCue> = {}): PixGridActionCue {
  return normalizePixGridActionCue({
    version: 1,
    id,
    timeSec,
    label: id,
    enabled: true,
    engineId: 'pixGrid',
    action,
    quantization: 'beat',
    transition: 'cut',
    transitionDurationSec: 0,
    oneShotDurationSec: 0.5,
    loopBehavior: 'retrigger',
    order: 0,
    ...patch,
  })!
}

const beatGrid: BeatMarkerMI[] = [
  { timeSec: 0, isDownbeat: true, beatIndex: 0, barIndex: 0, beatWithinBar: 0, confidence: 1 },
  { timeSec: 0.5, isDownbeat: false, beatIndex: 1, barIndex: 0, beatWithinBar: 1, confidence: 1 },
  { timeSec: 2, isDownbeat: true, beatIndex: 4, barIndex: 1, beatWithinBar: 0, confidence: 1 },
  { timeSec: 8, isDownbeat: true, beatIndex: 16, barIndex: 4, beatWithinBar: 0, confidence: 1 },
]

function frame(audioTime: number): PixGridAudioFrame {
  return {
    audioTime,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0,
    beatIndex: Math.floor(audioTime * 2),
    barIndex: Math.floor(audioTime / 2),
    isPlaying: true,
  }
}

describe('PixGrid action cue model', () => {
  it('normalizes cue creation, rejects other engines, and repairs persisted maps', () => {
    expect(normalizePixGridActionCue({ id: 'bad', engineId: 'laserDmx' })).toBeNull()
    const normalized = normalizePixGridActionCue({
      id: 'safe',
      timeSec: -4,
      engineId: 'pixGrid',
      action: { type: 'setAnimationSpeed', target: 'all', speed: -99 },
      quantization: 'bar',
      transition: 'rowWipe',
    })!
    expect(normalized.timeSec).toBe(0)
    expect(normalized.action).toMatchObject({ type: 'setAnimationSpeed', speed: -20 })
    expect(normalizePixGridActionCueMap({ track: [normalized, normalized] }).track).toHaveLength(1)
  })

  it('bounds persisted track buckets and cue lists deterministically', () => {
    const oversizedTrack = Array.from({ length: MAX_PIX_GRID_ACTION_CUES_PER_TRACK + 5 }, (_, index) => cue(`cue-${index}`, index, { type: 'clearScreen' }))
    const oversizedMap = Object.fromEntries(Array.from({ length: MAX_PIX_GRID_ACTION_CUE_TRACKS + 5 }, (_, index) => [
      `track-${index.toString().padStart(4, '0')}`,
      index === 0 ? oversizedTrack : [cue(`track-cue-${index}`, index, { type: 'restoreScene' })],
    ]))
    const normalized = normalizePixGridActionCueMap(oversizedMap)

    expect(Object.keys(normalized)).toHaveLength(MAX_PIX_GRID_ACTION_CUE_TRACKS)
    expect(normalized['track-0000']).toHaveLength(MAX_PIX_GRID_ACTION_CUES_PER_TRACK)
    expect(normalized[`track-${MAX_PIX_GRID_ACTION_CUE_TRACKS.toString().padStart(4, '0')}`]).toBeUndefined()
  })

  it('snaps to the authoritative Beat Grid without creating a second grid', () => {
    expect(snapPixGridCueTime(0.41, 'beat', beatGrid)).toBe(0.5)
    expect(snapPixGridCueTime(1.8, 'bar', beatGrid)).toBe(2)
    expect(snapPixGridCueTime(7.7, 'fourBars', beatGrid)).toBe(8)
    expect(snapPixGridCueTime(1.23, 'none', beatGrid)).toBe(1.23)
  })

  it('orders duplicate-time cues by explicit order then stable id', () => {
    const cues = sortPixGridActionCues([
      cue('z', 4, { type: 'clearScreen' }, { order: 2 }),
      cue('b', 4, { type: 'restoreScene' }, { order: 1 }),
      cue('a', 4, { type: 'freeze', active: true }, { order: 1 }),
    ])
    expect(cues.map(candidate => candidate.id)).toEqual(['a', 'b', 'z'])
  })
})

describe('PixGrid cue execution', () => {
  it('reconstructs persistent state after seeking and ignores disabled cues', () => {
    const state = createDefaultPixGridState()
    const layerId = state.layers[0]!.id
    const cues = [
      cue('hide', 2, { type: 'setLayerVisible', layerId, visible: false }),
      cue('disabled', 3, { type: 'setLayerVisible', layerId, visible: true }, { enabled: false }),
    ]
    expect(resolvePixGridActionCueFrame(state, cues, 10).state.layers[0]!.visible).toBe(false)
    expect(resolvePixGridActionCueFrame(state, cues, 1).state.layers[0]!.visible).toBe(state.layers[0]!.visible)
    expect(resolvePixGridActionCueFrame(state, cues, 10).snapshot.activeCueIds).toEqual(['hide'])
  })

  it('keeps one-shot actions bounded and supports retrigger versus once loop semantics', () => {
    const state = createDefaultPixGridState()
    const groupId = state.groups[0]!.id
    const once = cue('once', 2, { type: 'flashGroup', groupId, amount: 1 }, { loopBehavior: 'once', oneShotDurationSec: 0.5 })
    const runtime = new PixGridCueExecutionRuntime()
    expect(resolvePixGridActionCueFrame(state, [once], 2.1, { trackId: 'track', runtime }).snapshot.activeOneShotCueIds).toEqual(['once'])
    expect(resolvePixGridActionCueFrame(state, [once], 3, { trackId: 'track', runtime }).snapshot.activeOneShotCueIds).toEqual([])
    expect(resolvePixGridActionCueFrame(state, [once], 2.1, { trackId: 'track', runtime }).snapshot.activeOneShotCueIds).toEqual([])

    const retrigger = { ...once, id: 'retrigger', loopBehavior: 'retrigger' as const }
    expect(resolvePixGridActionCueFrame(state, [retrigger], 2.1, { trackId: 'track', runtime }).snapshot.activeOneShotCueIds).toEqual(['retrigger'])
  })

  it('isolates tracks and rejects non-PixGrid engine payloads', () => {
    const state = createDefaultPixGridState()
    const alien = { ...cue('alien', 0, { type: 'clearScreen' }), engineId: 'canvas' } as unknown as PixGridActionCue
    const resolved = resolvePixGridActionCueFrame(state, [alien], 10, { trackId: 'track-b' })
    expect(resolved.snapshot.active).toBe(false)
    expect(resolved.state.layers.some(layer => layer.visible)).toBe(true)
  })

  it('clears bounded manual overrides and restores authored layer values deterministically', () => {
    const state = createDefaultPixGridState()
    const layerId = state.layers[0]!.id
    const override = cue('override', 1, {
      type: 'applyManualOverride',
      route: 'opacity',
      target: { layerId },
      durationSec: 20,
      patch: { opacity: 0.1 },
    })
    const clear = cue('clear', 2, { type: 'clearManualOverride', route: 'opacity' })
    expect(resolvePixGridActionCueFrame(state, [override], 1.5).state.layers[0]!.opacity).toBe(0.1)
    const cleared = resolvePixGridActionCueFrame(state, [override, clear], 3)
    expect(cleared.state.layers[0]!.opacity).toBe(state.layers[0]!.opacity)
    expect(cleared.snapshot.manualOverrideRoutes).toEqual([])
    expect(resolvePixGridActionCueFrame(state, [override], 30).state.layers[0]!.opacity).toBe(state.layers[0]!.opacity)
  })

  it('computes deterministic transition progress, interruption, and paused-time stability', () => {
    const state = createDefaultPixGridState()
    const first = cue('first', 2, { type: 'clearScreen' }, { transition: 'crossfade', transitionDurationSec: 4, order: 0 })
    const second = cue('second', 3, { type: 'restoreScene' }, { transition: 'rowWipe', transitionDurationSec: 2, order: 0 })
    const mid = resolvePixGridActionCueFrame(state, [first], 3)
    expect(mid.transition).toMatchObject({ cueId: 'first', type: 'crossfade', progress: 0.25 })
    const interrupted = resolvePixGridActionCueFrame(state, [first, second], 3.5)
    expect(interrupted.transition).toMatchObject({ cueId: 'second', type: 'rowWipe', progress: 0.25 })
    expect(resolvePixGridActionCueFrame(state, [first, second], 3.5).snapshot.deterministicIdentity)
      .toBe(interrupted.snapshot.deterministicIdentity)
  })

  it('applies logical framebuffer transitions without persisting per-cell transition state', () => {
    const preset = PIX_GRID_PRESETS[0]!
    const sourceState = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
    const targetState = { ...sourceState, layers: sourceState.layers.map(layer => ({ ...layer, visible: false })) }
    const source = composePixGridLogicalFrame(preset, sourceState, frame(2))
    const target = composePixGridLogicalFrame(preset, targetState, frame(2))
    const atStart = composePixGridLogicalFrame(preset, targetState, frame(2), undefined, undefined, undefined, {
      cueId: 'transition', type: 'crossfade', progress: 0, startedAtSec: 2, durationSec: 1, seed: 12, fromState: sourceState,
    })
    const atHalf = composePixGridLogicalFrame(preset, targetState, frame(2), undefined, undefined, undefined, {
      cueId: 'transition', type: 'pixelDissolve', progress: 0.5, startedAtSec: 2, durationSec: 1, seed: 12, fromState: sourceState,
    })
    expect(atStart.pixels).toEqual(source.pixels)
    expect(target.pixels).not.toEqual(source.pixels)
    expect(atHalf.pixels).not.toEqual(source.pixels)
    expect(atHalf.pixels).not.toEqual(target.pixels)
  })

  it('drives cue-started animation, reversal, frame jumps, and imported still motion', () => {
    const state = createDefaultPixGridState()
    const layer = { ...state.layers[0]!, mediaId: 'still-image' }
    const layerId = layer.id
    const animatedState = { ...state, layers: [layer, ...state.layers.slice(1)] }
    const actions = [
      cue('start', 1, { type: 'startAnimation', target: { layerId }, animation: 'horizontalScroll', speed: 1, amount: 0.2, boundary: 'wrap', clock: 'time' }),
      cue('reverse', 2, { type: 'reverseAnimation', target: { layerId } }),
      cue('frame', 3, { type: 'jumpAnimationFrame', target: { layerId }, frame: 3 }),
    ]
    const resolved = resolvePixGridActionCueFrame(animatedState, actions, 3.1)
    expect(resolved.state.layers[0]!.animations[0]).toMatchObject({ speed: -1, phase: 3, clock: 'cue' })

    const asset = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(layer.assetId)!
    const movingLayer: PixGridLayer = {
      ...layer,
      animations: [{ mode: 'horizontalScroll', clock: 'time', speed: -1, amount: 0.2, phase: 0, boundary: 'wrap' }],
    }
    const atOne = resolvePixGridLayerAnimation(movingLayer, asset, frame(1), 1)
    const atTwo = resolvePixGridLayerAnimation(movingLayer, asset, frame(2), 1)
    expect(atTwo.positionX).not.toBe(atOne.positionX)
    const beatClock = resolvePixGridLayerAnimation({
      ...movingLayer,
      animations: [{ ...movingLayer.animations[0]!, clock: 'beat' }],
    }, asset, { ...frame(1), beatIndex: 4, beatPhase: 0.5 }, 1)
    const barClock = resolvePixGridLayerAnimation({
      ...movingLayer,
      animations: [{ ...movingLayer.animations[0]!, clock: 'bar' }],
    }, asset, { ...frame(1), beatIndex: 4, barIndex: 1, beatPhase: 0.5 }, 1)
    expect(beatClock.positionX).not.toBe(barClock.positionX)
  })
})

describe('PixGrid Track Map integration contract', () => {
  it('renders accessible engine-scoped markers and native cue editing affordances', () => {
    const source = readFileSync(new URL('../../ReactTrackMapStrip.tsx', import.meta.url), 'utf8')
    expect(source).toContain("kind: 'pixgrid'")
    expect(source).toContain('PixGrid action cue')
    expect(source).toContain('Right-click empty space to add a PixGrid action cue')
    expect(source).toContain('handlePixGridCuePointerDown')
    expect(source).toContain('PixGridTrackMapCueEditor')
    expect(source).not.toContain('pixGridBeatGrid')
  })
})
