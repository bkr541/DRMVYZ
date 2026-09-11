import { describe, expect, it } from 'vitest'
import {
  CINEMA2_CAPABILITY_IDS,
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  isCinema2NamespacedId,
  isCinema2StableId,
  validateCinema2NativePresetManifestIdentity,
  type Cinema2CapabilityRequirement,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
} from '..'

describe('Cinema 2.0 native preset manifest contract', () => {
  it('accepts the minimal v1 authored manifest with every optional subsystem omitted', () => {
    const manifest: Cinema2NativePresetManifest = {
      schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
      schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
      id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.test-minimal'),
      revision: 1,
      metadata: { name: 'Minimal Test Preset' },
    }

    expect(validateCinema2NativePresetManifestIdentity(manifest)).toEqual({
      ok: true,
      manifest,
      diagnostics: [],
    })
    expect(Object.keys(manifest).sort()).toEqual([
      'id',
      'metadata',
      'revision',
      'schemaId',
      'schemaVersion',
    ])
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest)
  })

  it('keeps the production foundation manifest neutral, scene-reachable and free of legacy preset-family discrimination', () => {
    expect(validateCinema2NativePresetManifestIdentity(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST).ok).toBe(true)
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST).not.toHaveProperty('sourceKind')
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST).not.toHaveProperty('shaderScene')
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST).not.toHaveProperty('cinematicWorld')
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST).not.toHaveProperty('render')
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST.modules).toHaveLength(1)
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST.scene?.nodes).toHaveLength(2)
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST.layers).toHaveLength(1)
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST.scene?.nodes[0]).toMatchObject({
      kind: 'group',
      coordinateSpace: 'normalized-screen',
    })
    expect(CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST.scene?.nodes[1]).toMatchObject({
      kind: 'module',
      module: { id: 'foundation-fullscreen' },
    })
  })

  it('rejects unsupported schema identity and malformed minimum envelope fields with actionable paths', () => {
    const result = validateCinema2NativePresetManifestIdentity({
      schemaId: 'drmvyz.cinema2.other',
      schemaVersion: 99,
      id: 'Not A Stable ID',
      revision: 0,
      metadata: { name: '   ' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected invalid manifest')
    expect(result.diagnostics.map(diagnostic => diagnostic.path)).toEqual([
      '$.schemaId',
      '$.schemaVersion',
      '$.id',
      '$.revision',
      '$.metadata',
    ])
  })

  it('provides stable local IDs, namespaced IDs, and serializable typed references', () => {
    const moduleId = cinema2StableId<Cinema2ModuleId>('hero-module')
    const presetId = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.hero')
    const moduleRef = cinema2Ref(moduleId)

    expect(isCinema2StableId(moduleId)).toBe(true)
    expect(isCinema2NamespacedId(presetId)).toBe(true)
    expect(moduleRef).toEqual({ $ref: 'hero-module' })
    expect(Object.isFrozen(moduleRef)).toBe(true)
    expect(JSON.stringify(moduleRef)).toBe('{"$ref":"hero-module"}')
    expect(() => cinema2StableId('Hero Module')).toThrow(/stable ID/)
    expect(() => cinema2NamespacedId('hero-module')).toThrow(/namespaced ID/)
  })

  it('expresses required versus optional capabilities without authored availability defaults', () => {
    const capabilities: readonly Cinema2CapabilityRequirement[] = [
      { id: 'render.webgl2', requirement: 'required' },
      { id: 'music.drop', requirement: 'optional', purpose: 'Increase visual significance on detected drops.' },
    ]

    expect(new Set(CINEMA2_CAPABILITY_IDS).size).toBe(CINEMA2_CAPABILITY_IDS.length)
    expect(capabilities[0]).toEqual({ id: 'render.webgl2', requirement: 'required' })
    expect(capabilities[1]).not.toHaveProperty('available')
    expect(capabilities[1]).not.toHaveProperty('fallbackValue')
  })
})
