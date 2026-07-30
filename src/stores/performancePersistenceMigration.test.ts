import { describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS_ORCHESTRATION_SETTINGS } from '../components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from '../components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes'
import {
  mergeReactStoreState,
  migrateReactStore,
  normalizeCanvasOrchestrationSettings,
  normalizeSoundDrawingPerformanceSettings,
  reactStorePartialize,
  useReactStore,
} from './reactStore'

describe('performance settings persistence migration', () => {
  it('repairs obsolete and corrupt Sound Drawing settings without persisting volatile runtime state', () => {
    const normalized = normalizeSoundDrawingPerformanceSettings({
      selectedShowId: 'retired-show',
      autoPerformance: true,
      complexity: 4,
      motionIntensity: -2,
      reactionIntensity: Number.NaN,
      trailIntensity: 0.42,
      generatorPreference: 'retired-generator',
      quality: 'retired-quality',
      performanceSource: 'retired-source',
      sourceTreatment: 'retired-treatment',
      useSourceAs: 'retired-policy',
      preserveIdentity: false,
      contourReactivity: 3,
      wholeObjectMotion: -1,
      echoStrength: Number.POSITIVE_INFINITY,
      sourceTrailStrength: 0.31,
      supportingVisualReactivity: Number.NaN,
      locks: { generator: true, transform: true, sourceSelection: true, contourReactivity: true, unknown: true },
      runtimeFrame: { stale: true },
      activeEnvelopes: ['stale'],
    })

    expect(normalized.selectedShowId).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.selectedShowId)
    expect(normalized.generatorPreference).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.generatorPreference)
    expect(normalized.quality).toBe('auto')
    expect(normalized.complexity).toBe(1)
    expect(normalized.motionIntensity).toBe(0)
    expect(normalized.reactionIntensity).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.reactionIntensity)
    expect(normalized.trailIntensity).toBe(0.42)
    expect(normalized.performanceSource).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.performanceSource)
    expect(normalized.sourceTreatment).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTreatment)
    expect(normalized.useSourceAs).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.useSourceAs)
    expect(normalized.preserveIdentity).toBe(false)
    expect(normalized.contourReactivity).toBe(1)
    expect(normalized.wholeObjectMotion).toBe(0)
    expect(normalized.echoStrength).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.echoStrength)
    expect(normalized.sourceTrailStrength).toBe(0.31)
    expect(normalized.supportingVisualReactivity).toBe(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.supportingVisualReactivity)
    expect(Object.values(normalized.locks).every(value => value === false)).toBe(true)
    expect(normalized.trailLockContract).toEqual(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.trailLockContract)
    expect(normalized.livingRibbon).toEqual(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon)
    expect(normalized.locks).not.toHaveProperty('unknown')
    expect(normalized).not.toHaveProperty('runtimeFrame')
    expect(normalized).not.toHaveProperty('activeEnvelopes')
  })

  it('migrates pre-source-integration Sound Drawing settings to identity-safe defaults', () => {
    const migrated = migrateReactStore({
      soundDrawingPerformanceSettings: {
        selectedShowId: 'harmonicRibbonReactor',
        autoPerformance: true,
        complexity: 0.8,
        motionIntensity: 0.7,
        reactionIntensity: 0.9,
        trailIntensity: 0.6,
        generatorPreference: 'authored',
        locks: { generator: true },
        runtimeFrame: { stale: true },
      },
    }, 45)

    const settings = migrated.soundDrawingPerformanceSettings as typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS
    expect(settings.selectedShowId).toBeNull()
    expect(settings.autoPerformance).toBe(false)
    expect(settings.performanceSource).toBe('generatedVisual')
    expect(settings.generatorPreference).toBe('authored')
    expect(settings.quality).toBe('auto')
    expect(settings.sourceTreatment).toBe('preserveIdentity')
    expect(settings.useSourceAs).toBe('primaryMotif')
    expect(settings.preserveIdentity).toBe(true)
    expect(Object.values(settings.locks).every(value => value === false)).toBe(true)
    expect(settings).not.toHaveProperty('runtimeFrame')
  })

  it('runs the v56 trail-lock migration explicitly for historical persisted documents', () => {
    const migrated = migrateReactStore({
      soundDrawingPerformanceSettings: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
        locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, trail: true },
        trailLockContract: undefined,
      },
    }, 55)
    const settings = migrated.soundDrawingPerformanceSettings as typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS
    expect(settings.trailLockContract).toEqual({ version: 1, mode: 'legacyRecipe', snapshot: null })
  })

  it('versions historical trail locks without silently changing their recipe', () => {
    const legacy = normalizeSoundDrawingPerformanceSettings({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, trail: true },
      trailLockContract: undefined,
    })
    expect(legacy.trailLockContract).toEqual({ version: 1, mode: 'legacyRecipe', snapshot: null })

    const corrected = normalizeSoundDrawingPerformanceSettings({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks, trail: true },
      trailLockContract: {
        version: 2,
        mode: 'manualResolved',
        snapshot: { trailDecay: 0.37, autoSectionMode: true, ribbonTrailPersistence: 0.82 },
      },
    })
    expect(corrected.trailLockContract).toEqual({
      version: 2,
      mode: 'manualResolved',
      snapshot: { trailDecay: 0.37, autoSectionMode: true, ribbonTrailPersistence: 0.82 },
    })
  })

  it('snapshots the visible manual trail state when the corrected lock is enabled', () => {
    const before = useReactStore.getState()
    useReactStore.setState({
      reactTrailDecay: 0.41,
      oscillatorSettings: { ...before.oscillatorSettings, autoSectionMode: true },
      soundDrawingPerformanceSettings: normalizeSoundDrawingPerformanceSettings({
        ...before.soundDrawingPerformanceSettings,
        locks: { ...before.soundDrawingPerformanceSettings.locks, trail: false },
        livingRibbon: { ...before.soundDrawingPerformanceSettings.livingRibbon, trailPersistence: 0.83 },
        trailLockContract: { version: 2, mode: 'manualResolved', snapshot: null },
      }),
    })
    useReactStore.getState().setSoundDrawingPerformanceLock('trail', true)
    expect(useReactStore.getState().soundDrawingPerformanceSettings.trailLockContract).toEqual({
      version: 2,
      mode: 'manualResolved',
      snapshot: { trailDecay: 0.41, autoSectionMode: true, ribbonTrailPersistence: 0.83 },
    })
    useReactStore.getState().setReactTrailDecay(0.52)
    expect(useReactStore.getState().soundDrawingPerformanceSettings.trailLockContract.snapshot).toEqual({
      trailDecay: 0.52,
      autoSectionMode: true,
      ribbonTrailPersistence: 0.83,
    })
    useReactStore.setState({
      reactTrailDecay: before.reactTrailDecay,
      oscillatorSettings: before.oscillatorSettings,
      soundDrawingPerformanceSettings: before.soundDrawingPerformanceSettings,
      soundDrawingTrailResetRevision: before.soundDrawingTrailResetRevision,
    })
  })

  it('round-trips corrected trail protection and its captured state through persistence', () => {
    const current = useReactStore.getState()
    const corrected = normalizeSoundDrawingPerformanceSettings({
      ...current.soundDrawingPerformanceSettings,
      locks: { ...current.soundDrawingPerformanceSettings.locks, trail: true },
      trailLockContract: {
        version: 2,
        mode: 'manualResolved',
        snapshot: { trailDecay: 0.43, autoSectionMode: true, ribbonTrailPersistence: 0.79 },
      },
    })
    const persisted = reactStorePartialize({
      ...current,
      reactTrailDecay: 0.43,
      soundDrawingPerformanceSettings: corrected,
    })
    const merged = mergeReactStoreState(persisted, current)
    expect(merged.reactTrailDecay).toBe(0.43)
    expect(merged.soundDrawingPerformanceSettings).toEqual(corrected)
  })

  it('preserves the opt-in Living Ribbon selection without rewriting legacy Harmonic Ribbon projects', () => {
    const living = normalizeSoundDrawingPerformanceSettings({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'livingRibbonSystem',
      generatorPreference: 'livingRibbon',
      quality: 'high',
    })
    expect(living).toMatchObject({
      selectedShowId: 'livingRibbonSystem',
      generatorPreference: 'livingRibbon',
      quality: 'high',
    })

    const legacy = normalizeSoundDrawingPerformanceSettings({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      selectedShowId: 'harmonicRibbonReactor',
      generatorPreference: 'harmonicRibbon',
    })
    expect(legacy).toMatchObject({
      selectedShowId: 'harmonicRibbonReactor',
      generatorPreference: 'harmonicRibbon',
    })
  })

  it('keeps an explicitly selected show active in-session but never restores it on app load', () => {
    const current = useReactStore.getState()
    const authoredScope = normalizeSoundDrawingPerformanceSettings({
      ...current.soundDrawingPerformanceSettings,
      selectedShowId: 'stereoPulseStudy',
      autoPerformance: true,
      generatorPreference: 'professionalScope',
    })
    expect(authoredScope.selectedShowId).toBe('stereoPulseStudy')
    expect(authoredScope.autoPerformance).toBe(true)
    expect(authoredScope.generatorPreference).toBe('authored')
    expect(authoredScope.performanceSource).toBe('generatedVisual')
    expect(Object.values(authoredScope.locks).every(value => value === false)).toBe(true)

    const persisted = reactStorePartialize({ ...current, soundDrawingPerformanceSettings: authoredScope })
    expect(persisted.soundDrawingPerformanceSettings.selectedShowId).toBeNull()
    expect(persisted.soundDrawingPerformanceSettings.autoPerformance).toBe(false)
    const merged = mergeReactStoreState(persisted, current)
    expect(merged.soundDrawingPerformanceSettings.selectedShowId).toBeNull()
    expect(merged.soundDrawingPerformanceSettings.autoPerformance).toBe(false)
  })


  it('normalizes missing, invalid, and out-of-range Living Ribbon settings safely', () => {
    const missing = normalizeSoundDrawingPerformanceSettings({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      livingRibbon: undefined,
    })
    expect(missing.livingRibbon).toEqual(DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon)

    const normalized = normalizeSoundDrawingPerformanceSettings({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
      livingRibbon: {
        quality: 'cinema',
        pointDensity: 4,
        tension: -2,
        turbulence: Number.NaN,
        bodyWidth: Number.POSITIVE_INFINITY,
        trailPersistence: 0.31,
        bloom: 7,
        sparkAmount: -1,
        centerAttraction: 0.44,
        audioReactionDepth: Number.NaN,
      },
      locks: { ribbonStructure: true, ribbonMovement: true, ribbonReaction: true, obsoleteRibbonLock: true },
    })
    expect(normalized.livingRibbon).toEqual({
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon,
      pointDensity: 1,
      tension: 0,
      trailPersistence: 0.31,
      bloom: 1,
      sparkAmount: 0,
      centerAttraction: 0.44,
    })
    expect(normalized.locks.ribbonStructure).toBe(true)
    expect(normalized.locks.ribbonMovement).toBe(true)
    expect(normalized.locks.ribbonReaction).toBe(true)
    expect(normalized.locks).not.toHaveProperty('obsoleteRibbonLock')
  })

  it('migrates old projects and round-trips nested Living Ribbon settings through project persistence', () => {
    const { livingRibbon: _legacyMissingRibbon, ...legacySettings } = DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS
    const migrated = migrateReactStore({
      soundDrawingPerformanceSettings: {
        ...legacySettings,
        selectedShowId: 'livingRibbonSystem',
        generatorPreference: 'livingRibbon',
        quality: 'high',
      },
    }, 52)
    const migratedSettings = migrated.soundDrawingPerformanceSettings as typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS
    expect(migratedSettings.selectedShowId).toBeNull()
    expect(migratedSettings.autoPerformance).toBe(false)
    expect(migratedSettings.livingRibbon.quality).toBe('high')
    expect(migratedSettings.livingRibbon.pointDensity).toBe(
      DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon.pointDensity,
    )

    const current = useReactStore.getState()
    const custom = normalizeSoundDrawingPerformanceSettings({
      ...current.soundDrawingPerformanceSettings,
      selectedShowId: 'livingRibbonSystem',
      livingRibbon: {
        ...current.soundDrawingPerformanceSettings.livingRibbon,
        quality: 'low',
        pointDensity: 0.23,
        tension: 0.84,
        audioReactionDepth: 0.46,
      },
      locks: { ...current.soundDrawingPerformanceSettings.locks, ribbonMovement: true },
    })
    const persisted = reactStorePartialize({ ...current, soundDrawingPerformanceSettings: custom })
    expect(persisted).not.toHaveProperty('soundDrawingRibbonResetRevision')
    const merged = mergeReactStoreState(persisted, current)
    expect(merged.soundDrawingPerformanceSettings.selectedShowId).toBeNull()
    expect(merged.soundDrawingPerformanceSettings.autoPerformance).toBe(false)
    expect(merged.soundDrawingPerformanceSettings.livingRibbon).toEqual(custom.livingRibbon)
    expect(merged.soundDrawingPerformanceSettings.locks).toEqual(custom.locks)
  })

  it('resets the live ribbon runtime through a transient command while preserving user settings', () => {
    const before = useReactStore.getState()
    const custom = normalizeSoundDrawingPerformanceSettings({
      ...before.soundDrawingPerformanceSettings,
      selectedShowId: 'livingRibbonSystem',
      livingRibbon: {
        ...before.soundDrawingPerformanceSettings.livingRibbon,
        bodyWidth: 0.27,
        trailPersistence: 0.88,
      },
    })
    useReactStore.setState({ soundDrawingPerformanceSettings: custom })
    const revision = useReactStore.getState().soundDrawingRibbonResetRevision
    useReactStore.getState().requestSoundDrawingRibbonReset()
    expect(useReactStore.getState().soundDrawingRibbonResetRevision).toBe(revision + 1)
    expect(useReactStore.getState().soundDrawingPerformanceSettings).toEqual(custom)
    useReactStore.setState({
      soundDrawingPerformanceSettings: before.soundDrawingPerformanceSettings,
      soundDrawingRibbonResetRevision: before.soundDrawingRibbonResetRevision,
    })
  })

  it('bounds CANVAS pools and controls, removes unknown locks, and falls back from retired shows', () => {
    const pool = Array.from({ length: 140 }, (_, index) => `media-${index}`)
    const normalized = normalizeCanvasOrchestrationSettings({
      enabled: true,
      autoRoleEnabled: false,
      mediaPoolIds: [...pool, 'media-1', '', null],
      mediaRolesById: { 'media-1': ['hero', 'not-a-role'] },
      mediaLocksByLayer: { hero: ' media-1 ', bogus: 'media-2' },
      layerLocks: { hero: true, bogus: true },
      globalLocks: { media: true, unknown: true },
      complexity: 2,
      transitionDensity: -1,
      effectIntensity: Number.POSITIVE_INFINITY,
      motionIntensity: 0.37,
      cutDensity: Number.NaN,
      compositionPreference: 'retired-composition',
      poolRevision: Number.POSITIVE_INFINITY,
      programId: 'retired-show',
      resolvedFrame: { stale: true },
      preloadQueue: ['stale'],
    })

    expect(normalized.enabled).toBe(true)
    expect(normalized.autoRoleEnabled).toBe(false)
    expect(normalized.mediaPoolIds).toHaveLength(128)
    expect(new Set(normalized.mediaPoolIds).size).toBe(normalized.mediaPoolIds.length)
    expect(normalized.mediaLocksByLayer).toEqual({ hero: 'media-1' })
    expect(normalized.layerLocks).toEqual({ hero: true })
    expect(normalized.globalLocks).toEqual({ media: true })
    expect(normalized.complexity).toBe(1)
    expect(normalized.transitionDensity).toBe(0)
    expect(normalized.effectIntensity).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.effectIntensity)
    expect(normalized.motionIntensity).toBe(0.37)
    expect(normalized.cutDensity).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.cutDensity)
    expect(normalized.compositionPreference).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.compositionPreference)
    expect(normalized.poolRevision).toBe(0)
    expect(normalized.programId).toBe(DEFAULT_CANVAS_ORCHESTRATION_SETTINGS.programId)
    expect(normalized).not.toHaveProperty('resolvedFrame')
    expect(normalized).not.toHaveProperty('preloadQueue')
  })
})
