// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REACT_PRESETS,
  createDefaultLaserDmxSettings,
  type LaserDmxSettings,
} from '../ReactTypes'
import {
  LASER_DMX_PRODUCTION_PRESETS,
  adaptProductionPresetToRig,
  analyzeProductionPresetCompatibility,
} from '../LaserDmxProductionPresets'
import { resolvePresetCardNavigationIndex } from '../ReactPresetsPanel'
import {
  getReactPerformanceActionsForTarget,
  type ReactPerformanceActionEvent,
} from '../ReactPerformanceActions'
import { applyLaserDmxPerformanceActions } from '../renderers/LaserDmxPerformanceActionEngine'
import { fingerprintReactPresetThumbnail } from '../renderers/ReactPresetThumbnailRenderer'
import { LASER_DMX_VIRTUAL_CAPTURE_LAYERS } from '../renderers/LaserDmxRenderer'
import { resolveLaserDmxPersonalization } from '../../../../features/personalization/laserDmxPersonalization'
import { resolveEffectiveReactPreset } from '../../../../features/personalization/effectivePalette'
import type { BrandKit } from '../../../../features/personalization/BrandKitTypes'

const EXPECTED_NAMES = ['Red Club Crossfire']

function settingsFor(): LaserDmxSettings {
  return structuredClone(LASER_DMX_PRODUCTION_PRESETS[0].laserDmxSettings as LaserDmxSettings)
}

function brandKit(): BrandKit {
  return {
    id: 'patch-10-kit', userId: 'user', name: 'Patch 10 Brand',
    palette: { primary: '#10E0D0', secondary: '#7A42FF', accent: '#FF3C91', background: '#020508', highlight: '#FFFFFF', text: '#FFFFFF' },
    extractedPalette: null, extractionMetadata: null, defaultStrength: 1,
    engineRules: { laserDmx: { mode: 'brand', strength: 1, preserveTriggerSemantics: true } },
    presetRules: {}, useForAppAccent: false, autoApply: true, createdAt: '', updatedAt: '',
  }
}

describe('LaserDMX Production Rig Patch 10 curated presets', () => {
  it('keeps Red Club Crossfire as the single curated Spatial Fixtures preset in the canonical browser library', () => {
    expect(LASER_DMX_PRODUCTION_PRESETS.map(preset => preset.name)).toEqual(EXPECTED_NAMES)
    for (const name of EXPECTED_NAMES) {
      expect(DEFAULT_REACT_PRESETS.some(preset => preset.name === name && preset.engine === 'laserDmx')).toBe(true)
    }
  })

  it('ships coherent rigs, looks, choreography, transitions, cues, atmosphere, and performance actions', () => {
    for (const preset of LASER_DMX_PRODUCTION_PRESETS) {
      const settings = preset.laserDmxSettings as LaserDmxSettings
      expect(settings.fixtures.length).toBeGreaterThanOrEqual(16)
      expect(settings.productionGroups?.length).toBeGreaterThanOrEqual(8)
      expect(settings.productionLooks?.length).toBeGreaterThanOrEqual(4)
      expect(settings.productionLooks?.every(look => look.transition.durationMs >= 0)).toBe(true)
      expect(settings.productionCues?.some(cue => cue.timing.mode === 'sectionRelative')).toBe(true)
      expect(settings.productionCues?.some(cue => cue.actions.some(action => action.type === 'blackout'))).toBe(true)
      expect(settings.productionCues?.some(cue => cue.actions.some(action => action.type === 'reveal'))).toBe(true)
      expect(settings.choreography).toMatchObject({ enabled: true, automaticLookChanges: true, automaticMovementChanges: true })
      expect(settings.atmosphere?.persistentHaze.enabled).toBe(true)
      expect(preset.productionPreset?.performanceActionIds).toHaveLength(13)
      expect(preset.productionPreset?.palettePolicy).toBe('brandKitAdaptable')
      expect(preset.productionPreset?.reserveWhiteForImpacts).toBe(true)
    }
  })

  it('reports missing families and produces safe partial playback on a smaller rig', () => {
    const preset = LASER_DMX_PRODUCTION_PRESETS[0]
    const smallRig = createDefaultLaserDmxSettings()
    const compatibility = analyzeProductionPresetCompatibility(preset, smallRig)
    expect(compatibility.mode).toBe('partial')
    expect(compatibility.diagnostics.some(item => item.code === 'missingFixtureFamily')).toBe(true)

    const adapted = adaptProductionPresetToRig(preset, smallRig)
    expect(adapted.settings.fixtures.map(item => item.id)).toEqual(smallRig.fixtures.map(item => item.id))
    expect(adapted.settings.productionGroups?.every(group => group.fixtureIds.every(id => smallRig.fixtures.some(item => item.id === id)))).toBe(true)
    expect(adapted.settings.runtime?.productionPresetDiagnostics).toEqual(expect.any(Array))
    expect(adapted.settings.productionCues?.every(cue => cue.actions.length > 0)).toBe(true)
  })

  it('reports the included virtual rig as fully compatible', () => {
    const preset = LASER_DMX_PRODUCTION_PRESETS[0]
    expect(analyzeProductionPresetCompatibility(preset, settingsFor())).toMatchObject({ mode: 'full', missingRequiredKinds: [] })
  })

  it('fingerprints production metadata and uses distinct thumbnail identities', () => {
    const preset = LASER_DMX_PRODUCTION_PRESETS[0]
    const baseline = fingerprintReactPresetThumbnail(preset)
    const changed = {
      ...preset,
      productionPreset: {
        ...preset.productionPreset!,
        thumbnail: { ...preset.productionPreset!.thumbnail, activeLookId: 'different-look' },
      },
    }
    expect(fingerprintReactPresetThumbnail(changed)).not.toBe(baseline)
  })

  it('keeps Brand Kit adaptation enabled while preserving authored white-impact intent', () => {
    const preset = LASER_DMX_PRODUCTION_PRESETS[0]
    const kit = brandKit()
    const context = resolveLaserDmxPersonalization(kit, preset.id)
    expect(context?.palette.primary).toBe('#10E0D0')
    const browserPreview = resolveEffectiveReactPreset(preset, kit)
    expect(browserPreview.palette.primary).toBe('#10E0D0')
    const settings = preset.laserDmxSettings as LaserDmxSettings
    const impacts = settings.fixtures.filter(fixture => fixture.fixtureKind === 'strobe' || fixture.fixtureKind === 'blinder')
    expect(impacts.every(fixture => fixture.colorPolicy?.preserveFixedColor === true)).toBe(true)
    expect(impacts.every(fixture => fixture.color.white === 255)).toBe(true)
  })
})

describe('LaserDMX contextual performance actions', () => {
  it('registers the requested actions through the generalized action registry', () => {
    const actions = getReactPerformanceActionsForTarget({ engineId: 'laserDmx' })
    expect(actions.map(action => action.productionAction)).toEqual([
      'blackout', 'reveal', 'whiteHit', 'blinderHit', 'laserStarburst', 'fanOpen', 'fanClose',
      'movementVariation', 'strobeBurst', 'fogBurst', 'cryoBurst', 'previousLook', 'nextLook',
    ])
  })

  it('queues compatible actions through Show Director and diagnoses unavailable effects', () => {
    const settings = settingsFor()
    const event: ReactPerformanceActionEvent = {
      actionId: 'laserDmx.fanOpen', sequence: 11, target: { engineId: 'laserDmx' }, triggeredAtMs: 100,
    }
    const result = applyLaserDmxPerformanceActions(settings, [event])
    expect(result.settings.runtime?.showDirectorManualRequest).toEqual({ cueId: 'performance:laserDmx.fanOpen:11', sequence: 11 })
    const lastCue = result.settings.productionCues?.[Math.max(0, (result.settings.productionCues?.length ?? 1) - 1)]
    expect(lastCue?.actions[0]).toMatchObject({ type: 'fanOpen', groupId: 'group:lasers' })

    const unavailableEvent: ReactPerformanceActionEvent = {
      actionId: 'laserDmx.fogBurst', sequence: 12, target: { engineId: 'laserDmx' }, triggeredAtMs: 120,
    }
    const unavailable = applyLaserDmxPerformanceActions(createDefaultLaserDmxSettings(), [unavailableEvent])
    expect(unavailable.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missingFixtureFamily', severity: 'warning' }),
    ]))
  })
})

describe('preset browser accessibility and capture integration', () => {
  it('supports arrows plus Home and End without wrapping focus unexpectedly', () => {
    expect(resolvePresetCardNavigationIndex(2, 'ArrowRight', 6, 2)).toBe(3)
    expect(resolvePresetCardNavigationIndex(2, 'ArrowDown', 6, 2)).toBe(4)
    expect(resolvePresetCardNavigationIndex(0, 'ArrowLeft', 6, 2)).toBe(0)
    expect(resolvePresetCardNavigationIndex(4, 'Home', 6, 2)).toBe(0)
    expect(resolvePresetCardNavigationIndex(1, 'End', 6, 2)).toBe(5)
    expect(resolvePresetCardNavigationIndex(1, 'Enter', 6, 2)).toBeNull()
  })

  it('declares every virtual production layer on the single captured canvas', () => {
    expect(LASER_DMX_VIRTUAL_CAPTURE_LAYERS).toEqual(expect.arrayContaining([
      'stage', 'lasers', 'movingHeads', 'washes', 'persistentHaze', 'localizedFog', 'cryoPlumes', 'flashImpacts',
    ]))
  })
})
