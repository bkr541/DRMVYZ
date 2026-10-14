import { describe, expect, it } from 'vitest'
import {
  CINEMA2_BOSS_BATTLE_IMAGE_URL,
  CINEMA2_BOSS_BATTLE_NATIVE_MODULE_TYPE_ID,
} from '../modules/Cinema2BossBattleNativeModule'
import {
  CINEMA2_BOSS_BATTLE_PRESET_ID,
  CINEMA2_BOSS_BATTLE_PRESET_MANIFEST,
} from '../presets/Cinema2BossBattlePreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

describe('Boss Battle preset', () => {
  it('ships as a visible first-party keeper and passes the native preset gates', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(
      candidate => candidate.manifest.id === CINEMA2_BOSS_BATTLE_PRESET_ID,
    )).toMatchObject({ role: 'keeper' })
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.metadata).toMatchObject({ name: 'Boss Battle' })
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.metadata.tags).not.toContain('internal')
    expect(validateCinema2PresetAuthoringConventions({
      role: 'keeper',
      manifest: CINEMA2_BOSS_BATTLE_PRESET_MANIFEST,
    })).toEqual({ ok: true, diagnostics: [] })

    const compiled = compileCinema2NativePreset(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST, {
      availableCapabilities: ['render.webgl2'],
    })
    if (!compiled.ok) {
      throw new Error(compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
    }
    expect(cinema2NativePresetRegistry.get(CINEMA2_BOSS_BATTLE_PRESET_ID)).not.toBeNull()
  })

  it('is a stationary environment with no Audio Intelligence routing', () => {
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.modules).toEqual([
      expect.objectContaining({ typeId: CINEMA2_BOSS_BATTLE_NATIVE_MODULE_TYPE_ID }),
    ])
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.choreography).toBeUndefined()
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.capabilities?.map(capability => capability.id)).not.toEqual(
      expect.arrayContaining(['audio.features', 'music.beat', 'music.rhythm-events']),
    )
    expect(JSON.stringify(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST)).not.toMatch(/audio|music|choreograph/i)
  })

  it('uses the supplied source artwork without post-processing or cropping controls', () => {
    expect(CINEMA2_BOSS_BATTLE_IMAGE_URL).toMatch(/boss-battle-reference\.png/)
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.layers?.[0]).toMatchObject({ depthPolicy: 'disabled' })
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.cameras).toBeUndefined()
    expect(CINEMA2_BOSS_BATTLE_PRESET_MANIFEST.effects).toBeUndefined()
  })
})
