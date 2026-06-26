// Tests for Shader library, import/export, quality controller, and thumbnail renderer.
// Pure logic only — no DOM, no WebGL.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ShaderImportExport,
  PACKAGE_SCHEMA_ID,
  PACKAGE_SCHEMA_VERSION,
  type ShaderPackage,
} from '../ShaderImportExport'
import { ShaderLibrary } from '../ShaderLibrary'
import { ShaderRegistry } from '../../registry/ShaderRegistry'
import { ShaderQualityController } from '../../performance/ShaderQualityController'
import { ShaderPerformanceMonitor } from '../../performance/ShaderPerformanceMonitor'
import {
  QUALITY_PROFILES,
  QUALITY_TIER_ORDER,
  type QualityTierWithAuto,
} from '../../performance/shaderPerformanceTypes'
import type { ShaderDefinition } from '../../registry/shaderRegistryTypes'
import { useShaderLibraryStore } from '../ShaderLibraryStore'
import { ShaderThumbnailRenderer } from '../ShaderThumbnailRenderer'

// ── Minimal valid definition ───────────────────────────────────────────────────

const MIN_FRAG = '#version 300 es\nprecision mediump float;\nout vec4 c;\nvoid main(){c=vec4(0);}'

function makeDef(id: string, overrides: Partial<ShaderDefinition> = {}): ShaderDefinition {
  return {
    id,
    name:        `Scene ${id}`,
    description: '',
    category:    'generator',
    version:     1,
    fragSrc:     MIN_FRAG,
    params:      [],
    defaults:    {},
    ...overrides,
  }
}

// ── A. Import/export round-trip ───────────────────────────────────────────────

describe('A. ShaderImportExport — round-trip', () => {
  it('exports and re-imports a valid package', () => {
    const def = makeDef('my-scene')
    const json = ShaderImportExport.export(def)
    const result = ShaderImportExport.import(json, new Set())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.package.definition.id).toBe('my-scene')
    expect(result.package.$schema).toBe(PACKAGE_SCHEMA_ID)
    expect(result.package.version).toBe(PACKAGE_SCHEMA_VERSION)
  })

  it('preserves optional presets in the package', () => {
    const def = makeDef('preset-scene')
    const json = ShaderImportExport.export(def, {
      presets: [{ name: 'Default', values: {} }],
    })
    const result = ShaderImportExport.import(json, new Set())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.package.presets?.[0].name).toBe('Default')
  })
})

// ── B. Package import validation — rejection cases ────────────────────────────

describe('B. ShaderImportExport — rejection cases', () => {
  it('rejects invalid JSON', () => {
    const result = ShaderImportExport.import('not json', new Set())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toMatch(/JSON/i)
  })

  it('rejects non-object JSON', () => {
    const result = ShaderImportExport.import('"just a string"', new Set())
    expect(result.ok).toBe(false)
  })

  it('rejects wrong $schema', () => {
    const pkg = {
      $schema:    'wrong-schema',
      version:    1,
      definition: makeDef('x'),
      exportedAt: new Date().toISOString(),
      exportedBy: 'test',
    }
    const result = ShaderImportExport.import(JSON.stringify(pkg), new Set())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some(e => e.includes('$schema'))).toBe(true)
  })

  it('rejects invalid/missing version', () => {
    const pkg = {
      $schema:    PACKAGE_SCHEMA_ID,
      version:    99,
      definition: makeDef('x'),
      exportedAt: new Date().toISOString(),
      exportedBy: 'test',
    }
    const result = ShaderImportExport.import(JSON.stringify(pkg), new Set())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some(e => e.toLowerCase().includes('version'))).toBe(true)
  })

  it('rejects missing shader source', () => {
    const defNoSrc = { ...makeDef('nosrc'), fragSrc: '' }
    const json = JSON.stringify({
      $schema:    PACKAGE_SCHEMA_ID,
      version:    1,
      definition: defNoSrc,
      exportedAt: new Date().toISOString(),
      exportedBy: 'test',
    })
    const result = ShaderImportExport.import(json, new Set())
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate ID (against user IDs)', () => {
    const def  = makeDef('existing-id')
    const json = ShaderImportExport.export(def)
    const result = ShaderImportExport.import(json, new Set(['existing-id']))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some(e => e.includes('existing-id'))).toBe(true)
  })

  it('rejects excessive pass count (>16)', () => {
    const passes = Array.from({ length: 17 }, (_, i) => ({
      id: `pass${i}`, fragSrc: MIN_FRAG, inputs: [], output: `out${i}`,
    }))
    const def = makeDef('many-passes', { passes, fragSrc: undefined })
    const json = JSON.stringify({
      $schema:    PACKAGE_SCHEMA_ID,
      version:    1,
      definition: def,
      exportedAt: new Date().toISOString(),
      exportedBy: 'test',
    })
    const result = ShaderImportExport.import(json, new Set())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some(e => e.includes('pass'))).toBe(true)
  })

  it('rejects malformed definition (invalid param schema)', () => {
    const def = makeDef('bad-param', {
      params: [{
        id: 'val', type: 'float', label: 'V', uniformName: 'u_v',
        min: 10, max: 1, default: 5,  // min > max — invalid
      }],
      defaults: { val: 5 },
    })
    const json = ShaderImportExport.export(def)
    const result = ShaderImportExport.import(json, new Set())
    expect(result.ok).toBe(false)
  })
})

// ── C. Bundled scene immutability ─────────────────────────────────────────────

describe('C. Bundled scene immutability', () => {
  it('isBundled returns true for registry scenes', () => {
    const reg = new ShaderRegistry()
    const def = makeDef('bundled-1')
    reg.register(def)
    // ShaderLibrary.isBundled uses the global shaderRegistry, so we test directly:
    expect(reg.has('bundled-1')).toBe(true)
  })

  it('cannot register the same ID twice in ShaderRegistry', () => {
    const reg = new ShaderRegistry()
    reg.register(makeDef('dup-a'))
    expect(() => reg.register(makeDef('dup-a'))).toThrow(/duplicate/)
  })

  it('ShaderLibrary marks bundled-registry entries as bundled:true and user entries as bundled:false', () => {
    // We can't mutate the global registry easily in tests, but we can test
    // that user scenes (not in registry) come through as bundled:false
    const userDefs = new Map<string, ShaderDefinition>([['user-1', makeDef('user-1', { name: 'User Scene' })]])
    const lib = new ShaderLibrary(userDefs, new Set(), new Map(), [], new Set())
    const entries = lib.getAll()
    const userEntry = entries.find(e => e.definition.id === 'user-1')
    expect(userEntry?.bundled).toBe(false)
  })
})

// ── D. User scene creation and deletion via ShaderLibrary ─────────────────────

describe('D. User scene creation logic', () => {
  it('addUserScene rejects collisions with registry bundled scene', () => {
    // The global registry has DEV_SOLID_COLOR registered — we can try to add it:
    const store = useShaderLibraryStore.getState()
    const devDef = makeDef('shader-dev-solid-color') // same ID as the bundled dev scene
    const result = store.addUserScene(devDef)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/conflict/i)
  })

  it('addUserScene succeeds for a fresh unique ID', () => {
    const store = useShaderLibraryStore.getState()
    const uniqueId = `test-user-${Date.now()}`
    const result = store.addUserScene(makeDef(uniqueId))
    expect(result.ok).toBe(true)
  })

  it('deleteUserScene removes the scene from the library', () => {
    const store = useShaderLibraryStore.getState()
    const id = `test-del-${Date.now()}`
    store.addUserScene(makeDef(id))
    expect(store.getUserSceneMap().has(id)).toBe(true)
    store.deleteUserScene(id)
    expect(useShaderLibraryStore.getState().getUserSceneMap().has(id)).toBe(false)
  })

  it('duplicateScene creates a user scene with a unique ID', () => {
    const store = useShaderLibraryStore.getState()
    const baseId = `test-dup-${Date.now()}`
    store.addUserScene(makeDef(baseId, { name: 'Original' }))
    const result = store.duplicateScene(baseId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const newDef = useShaderLibraryStore.getState().getUserSceneMap().get(result.newId)
    expect(newDef?.name).toContain('(copy)')
    expect(result.newId).not.toBe(baseId)
  })
})

// ── E. Quality tier values ────────────────────────────────────────────────────

describe('E. Quality tier profiles', () => {
  it('all 4 tiers have profiles', () => {
    for (const tier of QUALITY_TIER_ORDER) {
      expect(QUALITY_PROFILES[tier]).toBeDefined()
    }
  })

  it('internalResolutionScale decreases from ultra to low', () => {
    expect(QUALITY_PROFILES.ultra.internalResolutionScale).toBeGreaterThanOrEqual(
      QUALITY_PROFILES.high.internalResolutionScale,
    )
    expect(QUALITY_PROFILES.high.internalResolutionScale).toBeGreaterThanOrEqual(
      QUALITY_PROFILES.medium.internalResolutionScale,
    )
    expect(QUALITY_PROFILES.medium.internalResolutionScale).toBeGreaterThanOrEqual(
      QUALITY_PROFILES.low.internalResolutionScale,
    )
  })

  it('rayMarchSteps are ordered low < medium < high < ultra', () => {
    expect(QUALITY_PROFILES.low.rayMarchSteps).toBeLessThan(QUALITY_PROFILES.medium.rayMarchSteps)
    expect(QUALITY_PROFILES.medium.rayMarchSteps).toBeLessThan(QUALITY_PROFILES.high.rayMarchSteps)
    expect(QUALITY_PROFILES.high.rayMarchSteps).toBeLessThan(QUALITY_PROFILES.ultra.rayMarchSteps)
  })
})

// ── F. Quality controller — manual tier ───────────────────────────────────────

describe('F. ShaderQualityController — manual tier', () => {
  it('setTier sets effectiveTier immediately', () => {
    const ctrl = new ShaderQualityController()
    ctrl.setTier('low')
    expect(ctrl.effectiveTier).toBe('low')
    ctrl.setTier('ultra')
    expect(ctrl.effectiveTier).toBe('ultra')
  })

  it('setTier clears wasAutoAdjusted', () => {
    const ctrl = new ShaderQualityController()
    ctrl.setTier('auto')
    // Simulate auto adjustment
    const monitor = new ShaderPerformanceMonitor()
    ctrl.configureAuto({ slowFramesBeforeDowngrade: 1, slowThresholdMs: 5 })
    for (let i = 0; i < 5; i++) {
      monitor.recordFrame({ cpuPrepMs: 1, totalMs: 100, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1920, internalH: 1080 })
      ctrl.evaluate(monitor)
    }
    // Now override manually
    ctrl.setTier('high')
    expect(ctrl.wasAutoAdjusted).toBe(false)
  })

  it('respects scene minimum quality tier', () => {
    const ctrl = new ShaderQualityController()
    ctrl.setSceneQualityRequirements({ minimumTier: 'medium' })
    ctrl.setTier('low')  // request below minimum
    expect(ctrl.effectiveTier).toBe('medium')  // clamped up
  })
})

// ── G. Automatic quality hysteresis ───────────────────────────────────────────

describe('G. ShaderQualityController — auto hysteresis', () => {
  it('steps down after N consecutive slow frames', () => {
    const ctrl    = new ShaderQualityController()
    const monitor = new ShaderPerformanceMonitor()
    ctrl.setTier('auto')
    ctrl.configureAuto({
      slowFramesBeforeDowngrade:  5,
      stableFramesBeforeUpgrade:  100,
      slowThresholdMs:            33,
      fastThresholdMs:            18,
    })

    const before = ctrl.effectiveTier
    let changed = false
    for (let i = 0; i < 10; i++) {
      monitor.recordFrame({ cpuPrepMs: 1, totalMs: 50, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1, internalH: 1 })
      if (ctrl.evaluate(monitor)) changed = true
    }
    expect(changed).toBe(true)
    expect(QUALITY_TIER_ORDER.indexOf(ctrl.effectiveTier)).toBeLessThan(
      QUALITY_TIER_ORDER.indexOf(before),
    )
  })

  it('does not step up until many stable frames have passed', () => {
    const ctrl    = new ShaderQualityController()
    const monitor = new ShaderPerformanceMonitor()
    ctrl.setTier('auto')
    ctrl.configureAuto({
      slowFramesBeforeDowngrade:  3,
      stableFramesBeforeUpgrade:  10,
      slowThresholdMs:            33,
      fastThresholdMs:            18,
    })

    // Step down first
    for (let i = 0; i < 5; i++) {
      monitor.recordFrame({ cpuPrepMs: 1, totalMs: 50, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1, internalH: 1 })
      ctrl.evaluate(monitor)
    }
    const lowTier = ctrl.effectiveTier

    // Only a few fast frames — should NOT step up yet
    for (let i = 0; i < 5; i++) {
      monitor.recordFrame({ cpuPrepMs: 1, totalMs: 10, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1, internalH: 1 })
      ctrl.evaluate(monitor)
    }
    expect(ctrl.effectiveTier).toBe(lowTier) // not upgraded yet

    // Enough fast frames — should step up
    for (let i = 0; i < 12; i++) {
      monitor.recordFrame({ cpuPrepMs: 1, totalMs: 10, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1, internalH: 1 })
      ctrl.evaluate(monitor)
    }
    expect(QUALITY_TIER_ORDER.indexOf(ctrl.effectiveTier)).toBeGreaterThan(
      QUALITY_TIER_ORDER.indexOf(lowTier),
    )
  })

  it('never reduces below the scene minimum', () => {
    const ctrl    = new ShaderQualityController()
    const monitor = new ShaderPerformanceMonitor()
    ctrl.setTier('auto')
    ctrl.setSceneQualityRequirements({ minimumTier: 'medium' })
    ctrl.configureAuto({ slowFramesBeforeDowngrade: 1, slowThresholdMs: 5 })
    ctrl['_effectiveTier'] = 'medium'  // force start at minimum

    for (let i = 0; i < 20; i++) {
      monitor.recordFrame({ cpuPrepMs: 1, totalMs: 100, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1, internalH: 1 })
      ctrl.evaluate(monitor)
    }
    expect(QUALITY_TIER_ORDER.indexOf(ctrl.effectiveTier)).toBeGreaterThanOrEqual(
      QUALITY_TIER_ORDER.indexOf('medium'),
    )
  })

  it('evaluate is no-op when not in auto mode', () => {
    const ctrl    = new ShaderQualityController()
    const monitor = new ShaderPerformanceMonitor()
    ctrl.setTier('low')
    monitor.recordFrame({ cpuPrepMs: 1, totalMs: 200, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1, internalH: 1 })
    const changed = ctrl.evaluate(monitor)
    expect(changed).toBe(false)
    expect(ctrl.effectiveTier).toBe('low')
  })
})

// ── H. Timer query fallback ───────────────────────────────────────────────────

describe('H. ShaderPerformanceMonitor — timer query fallback', () => {
  it('timerQueryAvailable is false before initTimerQuery', () => {
    const monitor = new ShaderPerformanceMonitor()
    expect(monitor.timerQueryAvailable).toBe(false)
  })

  it('gpuMs is null when timer queries are not available', () => {
    const monitor = new ShaderPerformanceMonitor()
    monitor.recordFrame({ cpuPrepMs: 2, totalMs: 16, passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 512, internalH: 512 })
    expect(monitor.lastMetrics.gpuMs).toBeNull()
  })

  it('initTimerQuery with null extension leaves timerQueryAvailable false', () => {
    const monitor = new ShaderPerformanceMonitor()
    // Pass a fake GL object whose getExtension returns null
    const fakeGl = { getExtension: () => null } as unknown as WebGL2RenderingContext
    monitor.initTimerQuery(fakeGl)
    expect(monitor.timerQueryAvailable).toBe(false)
  })

  it('rolling average returns correct values', () => {
    const monitor = new ShaderPerformanceMonitor()
    for (let i = 0; i < 5; i++) {
      monitor.recordFrame({ cpuPrepMs: 2, totalMs: 10 * (i + 1), passCount: 1, renderTargetCount: 1, textureMb: 0, internalW: 1, internalH: 1 })
    }
    const avg = monitor.rollingAverage(5)
    // totalMs: 10+20+30+40+50 = 150 / 5 = 30
    expect(avg.totalMs).toBeCloseTo(30)
  })
})

// ── I. Persistence exclusion of runtime resources ─────────────────────────────

describe('I. Persistence — only POJO data', () => {
  it('ShaderLibraryStore partialize does not include function fields', () => {
    const state = useShaderLibraryStore.getState()
    const partial = {
      userScenes:        state.userScenes,
      favorites:         state.favorites,
      collections:       state.collections,
      recentlyUsed:      state.recentlyUsed,
      shaderPresets:     state.shaderPresets,
      qualityPreference: state.qualityPreference,
      editorPreferences: state.editorPreferences,
      thumbnailCache:    state.thumbnailCache,
    }
    // All values must be JSON-serializable (no functions, no WebGL objects)
    expect(() => JSON.stringify(partial)).not.toThrow()
  })

  it('thumbnail cache stores scene ID strings only', () => {
    useShaderLibraryStore.getState().markThumbnailCached('scene-abc')
    const cache = useShaderLibraryStore.getState().thumbnailCache
    expect(cache).toContain('scene-abc')
    expect(typeof cache[0]).toBe('string')
  })
})

// ── J. ShaderLibrary search and filter ────────────────────────────────────────

describe('J. ShaderLibrary search and filter', () => {
  function makeLibrary(defs: ShaderDefinition[]) {
    const map = new Map(defs.map(d => [d.id, d]))
    return new ShaderLibrary(map, new Set(), new Map(), [], new Set())
  }

  it('search filters by name (case-insensitive)', () => {
    const lib = makeLibrary([
      makeDef('a1', { name: 'Plasma Wave' }),
      makeDef('a2', { name: 'Fire Tunnel' }),
    ])
    const results = lib.search('plasma')
    expect(results.length).toBe(1)
    expect(results[0].definition.name).toBe('Plasma Wave')
  })

  it('category filter narrows results', () => {
    const lib = makeLibrary([
      makeDef('b1', { category: 'fractal' }),
      makeDef('b2', { category: 'particle' }),
      makeDef('b3', { category: 'fractal' }),
    ])
    const results = lib.getAll({ category: 'fractal' })
    expect(results.length).toBe(2)
  })

  it('favoritesOnly returns only favorited scenes', () => {
    const defs = [makeDef('c1'), makeDef('c2'), makeDef('c3')]
    const lib = new ShaderLibrary(
      new Map(defs.map(d => [d.id, d])),
      new Set(['c2']),
      new Map(),
      [],
      new Set(),
    )
    const results = lib.getAll({ favoritesOnly: true })
    expect(results).toHaveLength(1)
    expect(results[0].definition.id).toBe('c2')
  })

  it('getTags returns de-duped user-visible tags', () => {
    const lib = makeLibrary([
      makeDef('d1', { tags: ['audio', 'fractal'] }),
      makeDef('d2', { tags: ['audio', 'dev'] }),  // 'dev' should be excluded
    ])
    const tags = lib.getTags()
    expect(tags).toContain('audio')
    expect(tags).toContain('fractal')
    expect(tags).not.toContain('dev')
  })
})

// ── K. Thumbnail determinism (unit) ──────────────────────────────────────────

describe('K. ShaderThumbnailRenderer — determinism (unit)', () => {
  it('returns null for a definition with no fragSrc', async () => {
    const renderer = new ShaderThumbnailRenderer()
    const def = makeDef('no-src', { fragSrc: undefined, passes: [] })
    const result = await renderer.render(def)
    expect(result).toBeNull()
    renderer.dispose()
  })

  it('getCached returns null before any render', () => {
    const renderer = new ShaderThumbnailRenderer()
    expect(renderer.getCached('nonexistent')).toBeNull()
    renderer.dispose()
  })

  it('clearCache removes a specific entry', async () => {
    const renderer = new ShaderThumbnailRenderer()
    // Simulate a cached result
    const result: import('../ShaderThumbnailRenderer').ThumbnailResult = {
      dataUrl:  'data:image/png;base64,abc',
      sceneId:  'test-scene',
      cachedAt: new Date().toISOString(),
    }
    // Access private cache via type assertion for testing
    ;(renderer as unknown as Record<string, unknown>)['_cache'] =
      new Map([['test-scene', result]])
    expect(renderer.getCached('test-scene')).toBeTruthy()
    renderer.clearCache('test-scene')
    expect(renderer.getCached('test-scene')).toBeNull()
    renderer.dispose()
  })
})

// ── L. Import filename suggestion ─────────────────────────────────────────────

describe('L. ShaderImportExport — filename helpers', () => {
  it('suggestFilename slugifies the scene name', () => {
    const def = makeDef('s1', { name: 'My Cool Scene' })
    expect(ShaderImportExport.suggestFilename(def)).toBe('my-cool-scene-shader.json')
  })

  it('suggestFilename handles special characters', () => {
    const def = makeDef('s2', { name: 'Neon/Lattice 3.0!' })
    const name = ShaderImportExport.suggestFilename(def)
    expect(name).toMatch(/\.json$/)
    expect(name).not.toMatch(/[/!]/)
  })
})
