/**
 * Regression tests for the v10 → v11 migration that strips legacy Base64 font
 * data from persisted state.
 *
 * Covers:
 *  - Legacy rawFontDataBase64 entries are discarded on upgrade to v11
 *  - Cloud metadata entries (no rawFontDataBase64) are preserved
 *  - Absent oscillatorFontAssets field is a no-op
 *  - oscillatorSettings.textFontId survives (cloud list validates it at runtime)
 *  - Unrelated state keys are untouched
 *  - Full migration chain from v0 reaches the same result
 *  - partialize output excludes runtime/binary data and non-persisted assets
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { migrateReactStore, reactStorePartialize, useReactStore } from './reactStore'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLegacyFont(id = 'font-abc123', name = 'Permanent Marker') {
  return {
    id,
    name,
    fileName:          `${name.replace(/ /g, '')}-Regular.ttf`,
    rawFontDataBase64: btoa('fake-ttf-binary-data'),
    createdAt:         '2024-01-01T00:00:00.000Z',
    parseError:        null,
  }
}

function makeCloudFont(id = 'uuid-1234-5678', name = 'Rock Salt') {
  return {
    id,
    name,
    fileName:    'RockSalt-Regular.ttf',
    storagePath: `user-abc/${id}/RockSalt-Regular.ttf`,
    mimeType:    'font/ttf',
    fileSize:    42000,
    createdAt:   '2025-06-01T00:00:00.000Z',
  }
}

// ── v10 → v11: legacy Base64 entries are discarded ───────────────────────────

describe('fontAssetMigration — v10 → v11', () => {
  it('discards a legacy font entry that contains rawFontDataBase64', () => {
    const state = { oscillatorFontAssets: [makeLegacyFont()] }
    const result = migrateReactStore(state, 10)
    expect(result.oscillatorFontAssets).toEqual([])
  })

  it('discards multiple legacy entries', () => {
    const state = {
      oscillatorFontAssets: [
        makeLegacyFont('font-aaa', 'Font A'),
        makeLegacyFont('font-bbb', 'Font B'),
      ],
    }
    const result = migrateReactStore(state, 10)
    expect(result.oscillatorFontAssets).toEqual([])
  })

  it('preserves a cloud metadata entry that has no rawFontDataBase64', () => {
    const cloud = makeCloudFont()
    const state = { oscillatorFontAssets: [cloud] }
    const result = migrateReactStore(state, 10)
    const fonts = result.oscillatorFontAssets as unknown[]
    expect(fonts).toHaveLength(1)
    expect((fonts[0] as Record<string, unknown>).id).toBe(cloud.id)
  })

  it('discards legacy entries while preserving cloud metadata entries in a mixed array', () => {
    const cloud = makeCloudFont('uuid-good')
    const state = {
      oscillatorFontAssets: [makeLegacyFont('font-bad'), cloud],
    }
    const result = migrateReactStore(state, 10)
    const fonts = result.oscillatorFontAssets as unknown[]
    expect(fonts).toHaveLength(1)
    expect((fonts[0] as Record<string, unknown>).id).toBe('uuid-good')
  })

  it('is a no-op when oscillatorFontAssets is absent', () => {
    const state = { activeReactEngineId: 'oscilloscope' }
    const result = migrateReactStore(state, 10)
    expect(result.oscillatorFontAssets).toBeUndefined()
  })

  it('is a no-op when oscillatorFontAssets is already empty', () => {
    const state = { oscillatorFontAssets: [] }
    const result = migrateReactStore(state, 10)
    expect(result.oscillatorFontAssets).toEqual([])
  })

  it('preserves oscillatorSettings.textFontId through the migration', () => {
    const state = {
      oscillatorFontAssets: [makeLegacyFont('font-abc')],
      oscillatorSettings:   { textFontId: 'font-abc', text: 'DRMVYZ' },
    }
    const result = migrateReactStore(state, 10)
    const settings = result.oscillatorSettings as Record<string, unknown>
    // textFontId is kept — loadOscillatorFonts() validates it against the cloud list at runtime
    expect(settings.textFontId).toBe('font-abc')
    expect(settings.text).toBe('DRMVYZ')
  })

  it('does not strip unrelated state keys', () => {
    const state = {
      oscillatorFontAssets: [makeLegacyFont()],
      activeReactEngineId:  'cinematicPortal',
      reactIntensity:       0.8,
    }
    const result = migrateReactStore(state, 10)
    expect(result.activeReactEngineId).toBe('cinematicPortal')
    expect(result.reactIntensity).toBe(0.8)
  })
})

// ── Full migration chain from v0 ──────────────────────────────────────────────

describe('fontAssetMigration — full chain from v0', () => {
  it('discards legacy Base64 font assets when migrating from v0', () => {
    const state = { oscillatorFontAssets: [makeLegacyFont('font-old')] }
    const result = migrateReactStore(state, 0)
    expect(result.oscillatorFontAssets).toEqual([])
  })

  it('runs all migrations without throwing when starting from empty state', () => {
    expect(() => migrateReactStore({}, 0)).not.toThrow()
  })
})

// ── Persistence partialization — binary and runtime data excluded ──────────────

describe('reactStorePartialize — runtime and binary data excluded from persistence', () => {
  beforeEach(() => {
    useReactStore.setState({
      oscillatorFontAssets: [makeCloudFont()],
      oscillatorSettings:   { textFontId: 'uuid-1234-5678', text: 'DRMVYZ' } as ReturnType<typeof useReactStore.getState>['oscillatorSettings'],
    })
  })

  it('persists oscillatorSettings.textFontId', () => {
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted.oscillatorSettings.textFontId).toBe('uuid-1234-5678')
  })

  it('does not include oscillatorFontAssets in persisted output', () => {
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted).not.toHaveProperty('oscillatorFontAssets')
  })

  it('does not include rawFontDataBase64 in persisted output', () => {
    const persisted = reactStorePartialize(useReactStore.getState())
    const json = JSON.stringify(persisted)
    expect(json).not.toContain('rawFontDataBase64')
  })

  it('does not include oscillatorTextPointCache in persisted output', () => {
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted).not.toHaveProperty('oscillatorTextPointCache')
  })

  it('does not include fontSelectPending or fontRemovePending in persisted output', () => {
    const persisted = reactStorePartialize(useReactStore.getState())
    expect(persisted).not.toHaveProperty('fontSelectPending')
    expect(persisted).not.toHaveProperty('fontRemovePending')
    expect(persisted).not.toHaveProperty('fontUploadPending')
  })

  it('round-trips through JSON without losing textFontId', () => {
    const persisted = reactStorePartialize(useReactStore.getState())
    const roundTripped = JSON.parse(JSON.stringify(persisted))
    expect(roundTripped.oscillatorSettings.textFontId).toBe('uuid-1234-5678')
  })
})
