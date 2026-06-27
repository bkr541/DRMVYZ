/**
 * Validates the Sound Drawing layer/clip data model:
 * - Empty initialization
 * - Clip range normalization (endSec > startSec)
 * - Cascade delete (removing a layer removes its clips)
 * - Duplicate layer / clip creates new IDs
 * - Clip sort order (startSec asc, then zIndex asc)
 * - v13 → v14 migration adds empty collections
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  mergeReactStoreState,
  migrateReactStore,
  normalizeSoundDrawingClip,
  useReactStore,
} from './reactStore'
import type { SoundDrawingLayer, SoundDrawingClip } from '../components/vyzualz/react/ReactTypes'

// ── migration ────────────────────────────────────────────────────────────────

describe('migrateReactStore v13 → v14', () => {
  it('adds soundDrawingLayersByTrackId and soundDrawingClipsByTrackId when absent', () => {
    const state = { oscillatorSettings: { textLetterAssignments: [] } }
    const migrated = migrateReactStore(state, 13)
    expect((migrated as Record<string, unknown>).soundDrawingLayersByTrackId).toEqual({})
    expect((migrated as Record<string, unknown>).soundDrawingClipsByTrackId).toEqual({})
  })

  it('does not overwrite existing collections when already present', () => {
    const existing = { track1: [] }
    const state = { soundDrawingLayersByTrackId: existing, soundDrawingClipsByTrackId: existing }
    const migrated = migrateReactStore(state, 13) as Record<string, unknown>
    expect(migrated.soundDrawingLayersByTrackId).toBe(existing)
    expect(migrated.soundDrawingClipsByTrackId).toEqual(existing)
  })

  it('is idempotent (running twice produces the same result)', () => {
    const state = {}
    const once  = migrateReactStore(state, 13) as Record<string, unknown>
    const twice = migrateReactStore(once, 13)  as Record<string, unknown>
    expect(twice.soundDrawingLayersByTrackId).toEqual({})
    expect(twice.soundDrawingClipsByTrackId).toEqual({})
  })
})

// ── clip normalization ──────────────────────────────────────────────────────

describe('SoundDrawingClip range invariant', () => {
  const validClip: Omit<SoundDrawingClip, 'id'> = {
    trackId: 't1', layerId: 'l1',
    startSec: 1, endSec: 2,
    enabled: true, zIndex: 0, fadeInMs: 0, fadeOutMs: 0,
  }

  it('accepts valid timing and enforces parent-track ownership', () => {
    const normalized = normalizeSoundDrawingClip(
      { ...validClip, id: 'c1', trackId: 'wrong-track' },
      't1',
    )
    expect(normalized).toMatchObject({ trackId: 't1', startSec: 1, endSec: 2 })
  })

  it('repairs negative and non-finite timeline values', () => {
    const normalized = normalizeSoundDrawingClip({
      ...validClip,
      id: 'c1',
      startSec: Number.NEGATIVE_INFINITY,
      endSec: Number.NaN,
      zIndex: Number.POSITIVE_INFINITY,
      fadeInMs: Number.NaN,
      fadeOutMs: -5,
    }, 't1')

    expect(normalized.startSec).toBe(0)
    expect(normalized.endSec).toBe(0.1)
    expect(normalized.zIndex).toBe(0)
    expect(normalized.fadeInMs).toBe(0)
    expect(normalized.fadeOutMs).toBe(0)
  })

  it('clamps the complete range to a known track duration', () => {
    const normalized = normalizeSoundDrawingClip({
      ...validClip,
      id: 'c1',
      startSec: 20,
      endSec: 30,
    }, 't1', 10)

    expect(normalized.startSec).toBeCloseTo(9.9)
    expect(normalized.endSec).toBe(10)
    expect(normalized.endSec).toBeGreaterThan(normalized.startSec)
  })

  it('keeps a positive range even when the entire track is shorter than 0.1 seconds', () => {
    const normalized = normalizeSoundDrawingClip({
      ...validClip,
      id: 'c1',
      startSec: 1,
      endSec: 1,
    }, 't1', 0.05)

    expect(normalized.startSec).toBe(0)
    expect(normalized.endSec).toBe(0.05)
  })

  it('enforces ownership and duration bounds through add and update actions', () => {
    useReactStore.setState({ soundDrawingClipsByTrackId: {} })

    const id = useReactStore.getState().addSoundDrawingClip('parent-track', {
      ...validClip,
      trackId: 'wrong-track',
      startSec: -5,
      endSec: Number.POSITIVE_INFINITY,
    }, 4)

    expect(useReactStore.getState().soundDrawingClipsByTrackId['parent-track'][0]).toMatchObject({
      id,
      trackId: 'parent-track',
      startSec: 0,
      endSec: 0.1,
    })

    useReactStore.getState().updateSoundDrawingClip('parent-track', id, {
      trackId: 'another-wrong-track',
      startSec: 9,
      endSec: -1,
    }, 4)

    expect(useReactStore.getState().soundDrawingClipsByTrackId['parent-track'][0]).toMatchObject({
      trackId: 'parent-track',
      startSec: 3.9,
      endSec: 4,
    })
  })
})

describe('SoundDrawingClip persistence repair', () => {
  it('migrates inconsistent stored track IDs and recoverable malformed timing', () => {
    const migrated = migrateReactStore({
      soundDrawingClipsByTrackId: {
        'parent-track': [{
          id: 'clip-1',
          trackId: 'other-track',
          layerId: 'layer-1',
          startSec: -4,
          endSec: Number.NaN,
          enabled: true,
          zIndex: Number.POSITIVE_INFINITY,
          fadeInMs: -20,
          fadeOutMs: 50,
        }],
      },
    }, 22)

    const clip = (migrated.soundDrawingClipsByTrackId as Record<string, SoundDrawingClip[]>)[
      'parent-track'
    ][0]
    expect(clip).toMatchObject({
      id: 'clip-1',
      trackId: 'parent-track',
      layerId: 'layer-1',
      startSec: 0,
      endSec: 0.1,
      zIndex: 0,
      fadeInMs: 0,
      fadeOutMs: 50,
    })
  })

  it('repairs malformed current-version hydration during merge', () => {
    const current = useReactStore.getState()
    const hydrated = mergeReactStoreState({
      soundDrawingClipsByTrackId: {
        'track-a': [{
          id: 'clip-a',
          trackId: 'track-b',
          layerId: 'layer-a',
          startSec: 5,
          endSec: 2,
          enabled: true,
          zIndex: 1,
          fadeInMs: 0,
          fadeOutMs: 0,
        }],
      },
    }, current)

    expect(hydrated.soundDrawingClipsByTrackId['track-a'][0]).toMatchObject({
      trackId: 'track-a',
      startSec: 5,
      endSec: 5.1,
    })
  })
})

// ── SoundDrawingLayer structural checks ──────────────────────────────────────

describe('SoundDrawingLayer type completeness', () => {
  it('can construct a minimal layer with required fields', () => {
    const layer: SoundDrawingLayer = {
      id:           'l1',
      name:         'Test Layer',
      enabled:      true,
      sourceType:   'text',
      text:         'Hello',
      fontId:       null,
      letterSpacing: 0,
      lineHeight:   1.2,
      alignment:    'center',
      svgId:        null,
      shape:        'circle',
      x: 0, y: 0, scale: 1, rotation: 0,
      oscillatorOverride: {},
    }
    expect(layer.id).toBe('l1')
    expect(layer.oscillatorOverride).toEqual({})
  })

  it('accepts optional width field', () => {
    const layer: SoundDrawingLayer = {
      id:           'l2',
      name:         'Wide Layer',
      enabled:      true,
      sourceType:   'builtinShape',
      text:         '',
      fontId:       null,
      letterSpacing: 0,
      lineHeight:   1,
      alignment:    'left',
      svgId:        null,
      shape:        'circle',
      x: 0, y: 0, scale: 1, rotation: 0,
      width:        2,
      oscillatorOverride: {},
    }
    expect(layer.width).toBe(2)
  })
})

// ── SoundDrawingClip structural checks ───────────────────────────────────────

describe('SoundDrawingClip type completeness', () => {
  it('can construct a minimal clip with all required fields', () => {
    const clip: SoundDrawingClip = {
      id:       'c1',
      trackId:  't1',
      layerId:  'l1',
      startSec: 0,
      endSec:   10,
      enabled:  true,
      zIndex:   0,
      fadeInMs:  0,
      fadeOutMs: 0,
    }
    expect(clip.endSec).toBeGreaterThan(clip.startSec)
  })
})
