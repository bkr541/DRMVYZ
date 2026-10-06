import { describe, expect, it } from 'vitest'
import {
  HEADLINER_GROUP_ORDER,
  HEADLINER_PRESETS,
  getHeadlinerPreset,
  isHeadlinerParameterVisible,
  normalizeHeadlinerParameterOverrides,
  resolveHeadlinerParameters,
  resolveHeadlinerPresetClick,
} from './HeadlinerEffectCatalog'
import { DEFAULT_HEADLINER_SETTINGS, normalizeHeadlinerSettings } from './HeadlinerSettings'

describe('Headliner Clean Playback', () => {
  it('toggles the active preset off to Clean Playback and otherwise selects the clicked preset', () => {
    expect(resolveHeadlinerPresetClick('motion-echo', 'motion-echo')).toBeNull()
    expect(resolveHeadlinerPresetClick('ghost-trails', 'motion-echo')).toBe('ghost-trails')
    expect(resolveHeadlinerPresetClick('velocity-smear', null)).toBe('velocity-smear')
  })

  it('keeps Clean Playback (null) through settings normalization, and still rejects unknown ids', () => {
    expect(normalizeHeadlinerSettings({ presetId: null }).presetId).toBeNull()
    expect(normalizeHeadlinerSettings({ presetId: 'nope' }).presetId).toBe(DEFAULT_HEADLINER_SETTINGS.presetId)
  })
})

describe('Headliner effect catalog', () => {
  it('ships the first seven effects of the POV effects document, in priority order', () => {
    expect(HEADLINER_PRESETS.map(preset => preset.name)).toEqual([
      'Motion Echo', 'Ghost Trails', 'Velocity Smear', 'Motion Melt', 'Freeze Ghost', 'Strobe Clone', 'Clone Spread',
    ])
  })

  it('keeps one-shot buttons out of the stored values and shows the isolation controls only when they apply', () => {
    const freeze = getHeadlinerPreset('freeze-ghost')
    const byId = (id: string) => freeze.parameters.find(parameter => parameter.id === id)!
    expect(byId('capturePose')).toMatchObject({ kind: 'button', trigger: 'capture-pose' })
    expect(resolveHeadlinerParameters('freeze-ghost', { capturePose: true })).not.toHaveProperty('capturePose')
    expect(normalizeHeadlinerParameterOverrides({ 'freeze-ghost': { capturePose: true, maxGhosts: 2 } })).toEqual({ 'freeze-ghost': { maxGhosts: 2 } })

    const off = resolveHeadlinerParameters('freeze-ghost', {})
    const background = resolveHeadlinerParameters('freeze-ghost', { isolation: 'background' })
    expect(isHeadlinerParameterVisible(byId('isolationStrength'), off)).toBe(false)
    expect(isHeadlinerParameterVisible(byId('isolationStrength'), background)).toBe(true)
    expect(isHeadlinerParameterVisible(byId('relearnBackground'), off)).toBe(false)
    expect(isHeadlinerParameterVisible(byId('relearnBackground'), background)).toBe(true)
  })

  it.each(HEADLINER_PRESETS.map(preset => [preset.name, preset] as const))('%s has the standard Master Controls and fills every Design group', (_name, preset) => {
    const master = preset.parameters.filter(parameter => parameter.group === 'master')
    expect(master.find(parameter => parameter.id === 'masterIntensity')).toMatchObject({ kind: 'slider', default: 1 })
    expect(master.find(parameter => parameter.id === 'bpmSync')).toMatchObject({ kind: 'toggle', default: true })
    for (const group of HEADLINER_GROUP_ORDER) {
      expect(preset.parameters.some(parameter => parameter.group === group)).toBe(true)
    }
  })

  it.each(HEADLINER_PRESETS.map(preset => [preset.name, preset] as const))('%s has unique ids, in-range defaults and valid visibility rules', (_name, preset) => {
    const ids = preset.parameters.map(parameter => parameter.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const parameter of preset.parameters) {
      if (parameter.kind === 'slider') {
        expect(parameter.default).toBeGreaterThanOrEqual(parameter.min)
        expect(parameter.default).toBeLessThanOrEqual(parameter.max)
      }
      if (parameter.kind === 'button') continue
      if (parameter.kind === 'select') expect(parameter.options.some(option => option.value === parameter.default)).toBe(true)
      if (parameter.visibleWhen) expect(ids).toContain(parameter.visibleWhen.parameter)
    }
  })

  it('validates stored values: clamps, snaps to the step, and rejects unknown ids and bad types', () => {
    const values = resolveHeadlinerParameters('motion-echo', {
      masterIntensity: 9,
      echoCount: 4.4,
      bpmSync: 'yes',
      blendMode: 'nonsense',
      primaryColor: 'red',
      bogus: 1,
    })
    expect(values.masterIntensity).toBe(1.5)
    expect(values.echoCount).toBe(4)
    expect(values.bpmSync).toBe(true)
    expect(values.blendMode).toBe('normal')
    expect(values.primaryColor).toBe('#67f7ff')
    expect(values).not.toHaveProperty('bogus')
  })

  it('stores only non-default overrides of known presets', () => {
    expect(normalizeHeadlinerParameterOverrides({
      'motion-echo': { echoCount: 5, echoOpacity: 0.9, junk: 3 },
      unknown: { x: 1 },
    })).toEqual({ 'motion-echo': { echoOpacity: 0.9 } })
    expect(normalizeHeadlinerSettings({ presetId: 'nope', parameters: 'bad' })).toEqual(DEFAULT_HEADLINER_SETTINGS)
  })

  it('swaps beat-division and millisecond timing with BPM Sync, and hides colours until a mode is picked', () => {
    const echo = getHeadlinerPreset('motion-echo')
    const byId = (id: string) => echo.parameters.find(parameter => parameter.id === id)!
    const synced = resolveHeadlinerParameters('motion-echo', {})
    const free = resolveHeadlinerParameters('motion-echo', { bpmSync: false })
    expect(isHeadlinerParameterVisible(byId('echoSpacingBeats'), synced)).toBe(true)
    expect(isHeadlinerParameterVisible(byId('echoDelayMs'), synced)).toBe(false)
    expect(isHeadlinerParameterVisible(byId('echoSpacingBeats'), free)).toBe(false)
    expect(isHeadlinerParameterVisible(byId('echoDelayMs'), free)).toBe(true)

    expect(isHeadlinerParameterVisible(byId('primaryColor'), synced)).toBe(false)
    const tinted = resolveHeadlinerParameters('motion-echo', { colorMode: 'tint' })
    expect(isHeadlinerParameterVisible(byId('primaryColor'), tinted)).toBe(true)
    expect(isHeadlinerParameterVisible(byId('secondaryColor'), tinted)).toBe(false)
    expect(isHeadlinerParameterVisible(byId('secondaryColor'), resolveHeadlinerParameters('motion-echo', { colorMode: 'gradient' }))).toBe(true)
  })
})
