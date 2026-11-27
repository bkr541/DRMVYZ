import { describe, expect, it } from 'vitest'
import { createPresetScopeFilter, EMPTY_PRESET_CATALOG, resolvePresetScope, type PresetCatalogSnapshot } from './presetScope'

const snapshot: PresetCatalogSnapshot = {
  entries: [
    { id: 'p-goto', engine_id: 'cinema2', preset_key: 'drmvyz.cinema2.go-to', scope: 'user' },
    { id: 'p-reliquary', engine_id: 'cinema2', preset_key: 'drmvyz.cinema2.reliquary', scope: 'user' },
    { id: 'p-afterhours', engine_id: 'cinema2', preset_key: 'drmvyz.cinema2.afterhours', scope: 'system' },
  ],
  heldPresetIds: ['p-goto'],
}

describe('preset scope', () => {
  it('treats a preset with no catalog row, or a system row, as system', () => {
    expect(resolvePresetScope(EMPTY_PRESET_CATALOG, 'cinema2', 'drmvyz.cinema2.go-to')).toBe('system')
    expect(resolvePresetScope(snapshot, 'cinema2', 'drmvyz.cinema2.afterhours')).toBe('system')
    expect(resolvePresetScope(snapshot, 'cinema2', 'drmvyz.cinema2.brand-new')).toBe('system')
  })

  it('puts a private preset under USER for its holder and hides it from everyone else', () => {
    expect(resolvePresetScope(snapshot, 'cinema2', 'drmvyz.cinema2.go-to')).toBe('user')
    expect(resolvePresetScope(snapshot, 'cinema2', 'drmvyz.cinema2.reliquary')).toBe('hidden')
  })

  it('keys a preset by engine as well as id', () => {
    expect(resolvePresetScope(snapshot, 'canvas', 'drmvyz.cinema2.go-to')).toBe('system')
  })

  it('builds the per-tab filter', () => {
    const system = createPresetScopeFilter(snapshot, 'cinema2', 'system')
    const user = createPresetScopeFilter(snapshot, 'cinema2', 'user')
    expect(['drmvyz.cinema2.go-to', 'drmvyz.cinema2.reliquary', 'drmvyz.cinema2.afterhours'].map(system)).toEqual([false, false, true])
    expect(['drmvyz.cinema2.go-to', 'drmvyz.cinema2.reliquary', 'drmvyz.cinema2.afterhours'].map(user)).toEqual([true, false, false])
  })
})


describe('GOONZ CORRIDOR ownership', () => {
  const key = 'drmvyz.cinema2.goonz-corridor'
  const entry = { id: 'goonz', engine_id: 'cinema2', preset_key: key, scope: 'user' as const }
  it('never falls through to SYSTEM when the migration or catalog is missing', () => {
    expect(resolvePresetScope(EMPTY_PRESET_CATALOG, 'cinema2', key)).toBe('hidden')
    expect(resolvePresetScope({ entries: [{ ...entry, scope: 'system' }], heldPresetIds: ['goonz'] }, 'cinema2', key)).toBe('hidden')
  })
  it('appears only under USER for the holder', () => {
    const held = { entries: [entry], heldPresetIds: ['goonz'] }
    expect(createPresetScopeFilter(held, 'cinema2', 'user')(key)).toBe(true)
    expect(createPresetScopeFilter(held, 'cinema2', 'system')(key)).toBe(false)
    expect(resolvePresetScope({ ...held, heldPresetIds: [] }, 'cinema2', key)).toBe('hidden')
    expect(resolvePresetScope(held, 'cinema2', 'drmvyz.cinema2.corridor')).toBe('system')
  })
})
