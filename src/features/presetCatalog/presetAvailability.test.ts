import { describe, expect, it } from 'vitest'
import { indexPresetMetadata, type PresetMetadataRow } from './presetMetadata'
import { catalogEngineFor, presetAvailabilityFor, presetUnavailableMessage, resolvePresetAvailability } from './presetAvailability'

const row = (patch: Partial<PresetMetadataRow>): PresetMetadataRow => ({
  engine_id: 'cinema2', preset_key: 'drmvyz.cinema2.depth', name: null, description: null, category: null, tags: null, display_order: null,
  publication_status: null, store_title: null, store_subtitle: null, store_cover_ref: null, store_preview_ref: null, ...patch,
})

describe('preset availability (CAT-01)', () => {
  it('applies each status to users and admins as the Admin Console describes', () => {
    const cases: [Partial<PresetMetadataRow>, boolean, boolean][] = [
      // [row, listed for a user, listed for an admin]
      [{}, true, true],
      [{ publication_status: 'published' }, true, true],
      [{ publication_status: 'designing' }, false, true],
      [{ publication_status: 'draft' }, false, true],
      [{ publication_status: 'archived' }, false, false],
      [{ publication_status: 'published', disabled: true }, false, false],
      [{ publication_status: 'draft', disabled: true }, false, false],
    ]
    for (const [patch, user, admin] of cases) {
      expect(resolvePresetAvailability(row(patch), false), JSON.stringify(patch)).toMatchObject({ listed: user, usable: user })
      expect(resolvePresetAvailability(row(patch), true), JSON.stringify(patch)).toMatchObject({ listed: admin, usable: admin })
    }
    expect(resolvePresetAvailability(row({ publication_status: 'draft' }), true).reason).toBe('unreleased')
  })

  it('leaves every preset available with no metadata (signed out, offline before the first load, or no row)', () => {
    expect(resolvePresetAvailability(undefined, false)).toMatchObject({ listed: true, usable: true, reason: null })
    expect(presetAvailabilityFor(new Map(), 'cinema2', 'drmvyz.cinema2.depth', false).usable).toBe(true)
  })

  it('maps app engine ids to the engines the Admin Console keys presets by', () => {
    expect(catalogEngineFor('oscilloscope')).toBeNull()
    expect(catalogEngineFor('cinema2')).toBe('cinema2')
    expect(catalogEngineFor('xyScope')).toBeNull()
    const index = indexPresetMetadata([row({ engine_id: 'pixGrid', preset_key: 'grid-1', publication_status: 'archived' })])
    expect(presetAvailabilityFor(index, 'pixGrid', 'grid-1', false).listed).toBe(false)
    expect(presetAvailabilityFor(index, 'xyScope', 'grid-1', false).listed).toBe(true)
  })

  it('tells the user why, with the admin\'s note for a switched-off preset', () => {
    expect(presetUnavailableMessage('Depth', resolvePresetAvailability(row({ disabled: true, disabled_reason: ' being fixed ' }), false))).toBe('Depth has been switched off for now: being fixed')
    expect(presetUnavailableMessage('Depth', resolvePresetAvailability(row({ disabled: true }), false))).toBe('Depth has been switched off for now.')
    expect(presetUnavailableMessage('Depth', resolvePresetAvailability(row({ publication_status: 'archived' }), false))).toBe('Depth has been retired and is no longer available.')
  })
})
