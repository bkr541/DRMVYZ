import { describe, it, expect, vi } from 'vitest'

// Mock supabase before any module under test is loaded.
// rowToSession / sessionToInsert are pure transformation functions that never
// call Supabase directly, but the module imports supabase at the top level.
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from:  vi.fn(),
  },
  supabaseConfigured: false,
}))

import { rowToSession, sessionToInsert } from './sessionDb'
import type { SessionDbRow } from './sessionDb'
import type { VzSession } from '../stores/visualStore'
import { DEFAULT_EFFECT_PARAMS } from '../types/effectParams'

// ── Fixture helpers ────────────────────────────────────────────────────────────

const DB_ID    = 'db-uuid-001'
const NOW_ISO  = '2025-06-01T12:00:00.000Z'
const NOW_MS   = new Date(NOW_ISO).getTime()

/** A fully-populated VzSession covering every field that must survive a cloud round-trip. */
function makeFullSession(): VzSession {
  return {
    id:            'local-abc123',
    name:          'Test Show',
    createdAt:     NOW_MS,
    source:        'local',
    activeMediaId: 'media-001',
    mediaOrder:    ['media-001', 'media-002'],
    activePresetId:'dream-theft',
    effects: {
      masterIntensity: 0.9,
      bassReactivity:  0.8,
      glitchAmount:    0.5,
      rgbSplit:        0.3,
      tunnelSpeed:     0.6,
      displacement:    0.2,
      bloom:           0.7,
      strobe:          0.1,
      feedbackTrails:  0.4,
      logoScale:       1.2,
      colorShift:      0.0,
      spectrumBars:    0.65,
      circularSpectrum: 0.55,
      oscilloscope:    0.60,
      beatRing:        0.70,
      particleBurst:   0.55,
      reactiveGrid:    0.45,
      cameraShake:     0.25,
      kaleidoscope:    0.50,
      mirrorSplit:     0.50,
      radialBlur:      0.40,
      vhsStatic:       0.35,
      datamoshSmear:   0.35,
      edgeGlow:        0.50,
      colorCycle:      0.45,
      beatFlash:       0.50,
      edgeFlicker:     0.50,
      noiseFog:          0.40,
      scanlines:         0.50,
      pixelDistortion:   0.00,
      frameQuantization: 0.00,
    },
    enabledFx:  ['RGB Split', 'Bloom'],
    effectParams: {
      glitch: { sliceCount: 12, probability: 0.5, maxShift: 60, holdTime: 2 },
      strobe: { beatDivision: 2, duration: 0.1, threshold: 0.7, safetyCap: 5 },
    },
    bpm:    128,
    bpmSync: true,
    quality: 'High',
    audioSource: 'file',
    timelineEnabled: true,
    timelineClips: [
      {
        id: 'bg-clip-001', mediaId: 'media-001',
        startSec: 0, durationSec: 30,
        mediaInSec: 0, fitMode: 'cover', playbackMode: 'loop',
      },
    ],
    timelineLoop: false,
    timelineOverlayClips: [
      {
        id: 'ov-clip-001', mediaId: 'media-002',
        startSec: 5, durationSec: 10,
        mediaInSec: 0, fitMode: 'contain', playbackMode: 'trim',
        lane: 'overlays',
        compositingConfig: {
          posX: 0.7, posY: 0.2, scale: 0.3,
          opacity: 0.85, rotation: 0, blendMode: 'source-over', fitMode: 'contain',
        },
      },
    ],
    timelineEffectRegions: [
      {
        id: 'fx-001', effectId: 'RGB Split',
        startSec: 8, durationSec: 4, enabled: true,
        intensity: 0.75,
        targetType: 'clip', targetIds: ['ov-clip-001'],
      },
    ],
    layerItems: [
      {
        id: 'li-001', mediaId: 'media-002', layerId: 'logo',
        enabled: true, locked: false, solo: false,
        opacity: 1, blendMode: 'source-over',
        x: 0.5, y: 0.5, scale: 1, rotation: 0,
        anchor: 'center', fitMode: 'contain',
        zIndex: 0, audioReactive: false,
      },
    ],
    beatGridEnabled: true,
    cueMarkers: [
      { id: 'cue-001', label: 'Intro',  time: 0,  type: 'intro' },
      { id: 'cue-002', label: 'Drop 1', time: 32, type: 'drop'  },
    ],
  }
}

/** Simulate the DB row produced by sessionToInsert + Supabase round-trip. */
function makeDbRow(session: VzSession): SessionDbRow {
  const insert = sessionToInsert('user-xyz', session)
  return {
    id:           DB_ID,
    name:         insert.name,
    bpm:          insert.bpm,
    bpm_sync:     insert.bpm_sync,
    effects:      insert.effects,
    enabled_fx:   insert.enabled_fx,
    media_order:  insert.media_order as string[],
    quality:      insert.quality,
    audio_source: insert.audio_source,
    state:        insert.state,
    created_at:   NOW_ISO,
    updated_at:   NOW_ISO,
  }
}

// ── sessionToInsert — serialization tests ─────────────────────────────────────

describe('sessionToInsert', () => {
  it('saves effectParams into state', () => {
    const session = makeFullSession()
    const { state } = sessionToInsert('u', session)
    expect(state.effectParams).toEqual(session.effectParams)
  })

  it('saves timelineOverlayClips into state', () => {
    const session = makeFullSession()
    const { state } = sessionToInsert('u', session)
    expect(state.timelineOverlayClips).toEqual(session.timelineOverlayClips)
  })

  it('saves timelineEffectRegions into state', () => {
    const session = makeFullSession()
    const { state } = sessionToInsert('u', session)
    expect(state.timelineEffectRegions).toEqual(session.timelineEffectRegions)
  })

  it('saves beatGridEnabled into state', () => {
    const session = makeFullSession()
    const { state } = sessionToInsert('u', session)
    expect(state.beatGridEnabled).toBe(true)
  })

  it('saves cueMarkers into state', () => {
    const session = makeFullSession()
    const { state } = sessionToInsert('u', session)
    expect(state.cueMarkers).toEqual(session.cueMarkers)
  })

  it('saves layerItems into state', () => {
    const session = makeFullSession()
    const { state } = sessionToInsert('u', session)
    expect(state.layerItems).toEqual(session.layerItems)
  })

  it('does NOT include ephemeral fields (id, source, dbId) in state', () => {
    const session = makeFullSession()
    const { state } = sessionToInsert('u', session)
    expect(state).not.toHaveProperty('id')
    expect(state).not.toHaveProperty('source')
    expect(state).not.toHaveProperty('dbId')
  })
})

// ── rowToSession — deserialization tests ──────────────────────────────────────

describe('rowToSession', () => {
  it('reconstructs effectParams from state', () => {
    const row = makeDbRow(makeFullSession())
    const out = rowToSession(row)
    expect(out.effectParams).toEqual({
      glitch: { sliceCount: 12, probability: 0.5, maxShift: 60, holdTime: 2 },
      strobe: { beatDivision: 2, duration: 0.1, threshold: 0.7, safetyCap: 5 },
    })
  })

  it('reconstructs timelineOverlayClips from state', () => {
    const session = makeFullSession()
    const row = makeDbRow(session)
    const out = rowToSession(row)
    expect(out.timelineOverlayClips).toEqual(session.timelineOverlayClips)
  })

  it('reconstructs timelineEffectRegions from state', () => {
    const session = makeFullSession()
    const row = makeDbRow(session)
    const out = rowToSession(row)
    expect(out.timelineEffectRegions).toEqual(session.timelineEffectRegions)
  })

  it('reconstructs beatGridEnabled from state', () => {
    const row = makeDbRow(makeFullSession())
    const out = rowToSession(row)
    expect(out.beatGridEnabled).toBe(true)
  })

  it('reconstructs cueMarkers from state', () => {
    const session = makeFullSession()
    const row = makeDbRow(session)
    const out = rowToSession(row)
    expect(out.cueMarkers).toEqual(session.cueMarkers)
  })

  it('reconstructs layerItems from state', () => {
    const session = makeFullSession()
    const row = makeDbRow(session)
    const out = rowToSession(row)
    expect(out.layerItems).toEqual(session.layerItems)
  })

  it('sets source to "cloud" and dbId to the DB row id', () => {
    const row = makeDbRow(makeFullSession())
    const out = rowToSession(row)
    expect(out.source).toBe('cloud')
    expect(out.dbId).toBe(DB_ID)
    expect(out.id).toBe(DB_ID)
  })

  it('uses DB column bpm / bpm_sync over state fallback', () => {
    const row = makeDbRow(makeFullSession())
    row.bpm      = 140
    row.bpm_sync = false
    const out = rowToSession(row)
    expect(out.bpm).toBe(140)
    expect(out.bpmSync).toBe(false)
  })

  it('prefers non-empty media_order column over state.mediaOrder', () => {
    const session = makeFullSession()
    const row = makeDbRow(session)
    row.media_order = ['media-002', 'media-001'] // different order in DB column
    const out = rowToSession(row)
    expect(out.mediaOrder).toEqual(['media-002', 'media-001'])
  })
})

// ── Full round-trip ───────────────────────────────────────────────────────────

describe('full round-trip (saveSession → DB → rowToSession)', () => {
  it('preserves all critical fields across a complete cloud round-trip', () => {
    const original = makeFullSession()
    const row = makeDbRow(original)
    const restored = rowToSession(row)

    // Timeline
    expect(restored.timelineEnabled).toBe(original.timelineEnabled)
    expect(restored.timelineLoop).toBe(original.timelineLoop)
    expect(restored.timelineClips).toEqual(original.timelineClips)
    expect(restored.timelineOverlayClips).toEqual(original.timelineOverlayClips)
    expect(restored.timelineEffectRegions).toEqual(original.timelineEffectRegions)

    // Effect params
    expect(restored.effectParams).toEqual(original.effectParams)

    // Layers
    expect(restored.layerItems).toEqual(original.layerItems)

    // Transport
    expect(restored.beatGridEnabled).toBe(original.beatGridEnabled)
    expect(restored.cueMarkers).toEqual(original.cueMarkers)

    // Core visual
    expect(restored.effects).toEqual(original.effects)
    expect(restored.enabledFx).toEqual(original.enabledFx)
    expect(restored.bpm).toBe(original.bpm)
    expect(restored.quality).toBe(original.quality)
    expect(restored.audioSource).toBe(original.audioSource)
    expect(restored.activeMediaId).toBe(original.activeMediaId)
    expect(restored.mediaOrder).toEqual(original.mediaOrder)
    expect(restored.activePresetId).toBe(original.activePresetId)
  })

  it('preserves effect region target type and targetIds', () => {
    const original = makeFullSession()
    const row = makeDbRow(original)
    const restored = rowToSession(row)

    const region = restored.timelineEffectRegions?.[0]
    expect(region?.targetType).toBe('clip')
    expect(region?.targetIds).toEqual(['ov-clip-001'])
    expect(region?.intensity).toBe(0.75)
  })

  it('preserves overlay compositingConfig', () => {
    const original = makeFullSession()
    const row = makeDbRow(original)
    const restored = rowToSession(row)

    const overlay = restored.timelineOverlayClips?.[0]
    expect(overlay?.compositingConfig).toEqual({
      posX: 0.7, posY: 0.2, scale: 0.3,
      opacity: 0.85, rotation: 0, blendMode: 'source-over', fitMode: 'contain',
    })
  })
})

// ── Legacy / partial sessions — safe defaults ─────────────────────────────────

describe('legacy sessions with missing optional fields', () => {
  function makeLegacyRow(): SessionDbRow {
    // Simulate an old session saved before Phase 1A — state only has the
    // pre-Phase-1A fields; newer fields are entirely absent.
    return {
      id:           'old-db-id',
      name:         'Old Show',
      bpm:          120,
      bpm_sync:     false,
      effects:      {},
      enabled_fx:   [],
      media_order:  [],
      quality:      'High',
      audio_source: 'file',
      state: {
        activeMediaId:  null,
        mediaOrder:     [],
        activePresetId: 'dream-theft',
        effects:        {},
        enabledFx:      [],
        bpm:            120,
        bpmSync:        false,
        quality:        'High',
        audioSource:    'file',
        timelineEnabled: false,
        timelineClips:   [],
        timelineLoop:    true,
        layerItems:      [],
        // ← effectParams, timelineOverlayClips, timelineEffectRegions,
        //   beatGridEnabled, cueMarkers intentionally absent
      },
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
    }
  }

  it('defaults timelineOverlayClips to []', () => {
    expect(rowToSession(makeLegacyRow()).timelineOverlayClips).toEqual([])
  })

  it('defaults timelineEffectRegions to []', () => {
    expect(rowToSession(makeLegacyRow()).timelineEffectRegions).toEqual([])
  })

  it('defaults beatGridEnabled to false', () => {
    expect(rowToSession(makeLegacyRow()).beatGridEnabled).toBe(false)
  })

  it('defaults cueMarkers to []', () => {
    expect(rowToSession(makeLegacyRow()).cueMarkers).toEqual([])
  })

  it('leaves effectParams undefined so loadSession() applies DEFAULT_EFFECT_PARAMS', () => {
    // effectParams is optional on VzSession — undefined tells loadSession() to
    // fall back to DEFAULT_EFFECT_PARAMS, preserving the existing behavior.
    const out = rowToSession(makeLegacyRow())
    expect(out.effectParams).toBeUndefined()
    // Verify DEFAULT_EFFECT_PARAMS is the right fallback value
    expect(DEFAULT_EFFECT_PARAMS).toEqual({})
  })

  it('does not throw when loading a legacy row', () => {
    expect(() => rowToSession(makeLegacyRow())).not.toThrow()
  })

  it('returns correct source and id for legacy rows', () => {
    const out = rowToSession(makeLegacyRow())
    expect(out.source).toBe('cloud')
    expect(out.id).toBe('old-db-id')
  })
})
