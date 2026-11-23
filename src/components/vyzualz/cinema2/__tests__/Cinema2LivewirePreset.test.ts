import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { setAutoPerformanceUserDefault } from '../../../../lib/autoPerformanceDefault'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_LIVEWIRE_PRESET_ID, CINEMA2_LIVEWIRE_PRESET_MANIFEST } from '../presets/Cinema2LivewirePreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { LIVEWIRE_GLYPH_METRICS, LIVEWIRE_GLYPH_MESHES } from '../modules/livewire/Cinema2LivewireGlyphs'
import { livewireGlyphShapes } from '../modules/livewire/Cinema2LivewireContours'
import { resolveCinema2SayItTextLayout } from '../modules/sayIt/Cinema2SayItTextLayout'

const manifest = CINEMA2_LIVEWIRE_PRESET_MANIFEST
const parameter = (name: string) => manifest.parameters!.find(item => item.id === `livewire-${name}`)!

afterEach(() => setAutoPerformanceUserDefault(null))

describe('LIVEWIRE', () => {
  it('compiles and exposes the four groups, authored text and canonical pattern controls', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_LIVEWIRE_PRESET_ID)
    expect(result.diagnostics).toEqual([])
    expect(result.ok).toBe(true)
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest }).diagnostics).toEqual([])
    expect(new Set(manifest.parameters!.filter(item => item.section === 'Design').map(item => item.designParentGroup))).toEqual(new Set(['master-controls', 'design', 'effects', 'palette']))
    expect(parameter('text').defaultValue).toBe('LIVEWIRE')
    expect(parameter('pattern').options).toHaveLength(6)
    expect(parameter('pattern-change')).toMatchObject({ defaultValue: false, metadata: { moodPolicy: 'patternChange' } })
    expect(parameter('trigger')).toMatchObject({
      options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: 'livewire-pattern-change', value: true }],
    })
    expect(manifest.parameters!.filter(item => item.designParentGroup === 'palette' && item.type === 'color')).toHaveLength(4)
  })

  it('takes its initial Auto Performance from the shared system preference', () => {
    const result = cinema2NativePresetRegistry.compile(CINEMA2_LIVEWIRE_PRESET_ID)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    for (const preference of [true, false]) {
      setAutoPerformanceUserDefault(preference)
      const state = new Cinema2ParameterState(result.plan.parameters)
      expect(state.getValue(parameter('auto-performance').id)).toBe(preference)
      expect(state.getValue(parameter('text').id)).toBe('LIVEWIRE')
    }
  })

  it('lays out both lines from the original glyph repertoire', () => {
    const layout = resolveCinema2SayItTextLayout({ line1: 'LIVEWIRE', line2: 'D.O.R.! 42' }, {
      alignment: 'center', lineMode: 'two', tracking: 0.04, lineSpacing: 0.84, glyphScale: 0.5,
    }, LIVEWIRE_GLYPH_METRICS)
    expect(layout.replacementCount).toBe(0)
    expect(layout.glyphs.length).toBe(17)
    expect(layout.glyphs.every(glyph => LIVEWIRE_GLYPH_MESHES.has(glyph.mesh))).toBe(true)
    expect(Object.keys(LIVEWIRE_GLYPH_METRICS.glyphs)).toHaveLength(95)
  })

  it('merges a closed glyph into one machinable shell and preserves its counter', () => {
    const shape = livewireGlyphShapes(THREE, [
      { start: [0, 0], end: [0, 1] }, { start: [0, 1], end: [0.75, 1] },
      { start: [0.75, 1], end: [1, 0.5] }, { start: [1, 0.5], end: [0.75, 0] },
      { start: [0.75, 0], end: [0, 0] },
    ], 0.22)
    expect(shape).toHaveLength(1)
    expect(shape[0]!.holes).toHaveLength(1)
    expect(THREE.ShapeUtils.isClockWise(shape[0]!.getPoints())).toBe(true)
    expect(THREE.ShapeUtils.isClockWise(shape[0]!.holes[0]!.getPoints())).toBe(false)
  })
})
