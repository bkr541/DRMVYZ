import { describe, expect, it } from 'vitest'
import { CINEMA2_CORRIDOR_MODULE_TYPE_ID, CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID, Cinema2CorridorPerformance } from '../modules/Cinema2CorridorNativeModule'
import { buildCorridorGeometry, GOONZ_CORRIDOR_PATTERNS, CORRIDOR_BANK_SPAN, CORRIDOR_BAY_LENGTH, CORRIDOR_MAX_INSET, CORRIDOR_VERTEX_FLOATS, GOONZ_MIN_SIDE, GOONZ_MAX_PAIR_SIDE, GOONZ_MAX_AXIAL_SIDE, GOONZ_PAIR_SPAN, GOONZ_PAIR_GAP, GOONZ_MAX_SINGLE_SIDE, CORRIDOR_RAIL_PART, CORRIDOR_RAIL_VERTEX_COUNT } from '../modules/corridor/Cinema2CorridorRenderer'
import { CINEMA2_CORRIDOR_PRESET_ID, CINEMA2_CORRIDOR_PRESET_MANIFEST } from '../presets/Cinema2CorridorPreset'
import { CINEMA2_GOONZ_CORRIDOR_PRESET_ID, CINEMA2_GOONZ_CORRIDOR_PRESET_MANIFEST } from '../presets/Cinema2GoonzCorridorPreset'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'

import { goonzPoolTrigger, goonzRoutineBeat } from '../modules/corridor/Cinema2GoonzCorridorChoreography'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'

describe('GOONZ CORRIDOR', () => {
  it('compiles separately with expanded controls and stable media, camera and render graph', () => {
    const original = CINEMA2_CORRIDOR_PRESET_MANIFEST
    const variant = CINEMA2_GOONZ_CORRIDOR_PRESET_MANIFEST
    expect(variant.id).not.toBe(original.id)
    expect(variant.metadata.name).toBe('GOONZ CORRIDOR')
    expect(variant.modules?.[0]?.typeId).toBe(CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID)
    expect(original.modules?.[0]?.typeId).toBe(CINEMA2_CORRIDOR_MODULE_TYPE_ID)
    for (const key of ['mediaSlots', 'cameras', 'render'] as const) expect(variant[key]).toEqual(original[key])
    expect(variant.parameters?.find(p=>p.id==='corridor-pattern')?.options).toHaveLength(12)
    expect(original.parameters?.find(p=>p.id==='corridor-pattern')?.options).toHaveLength(6)
    expect(variant.parameters?.find(p=>p.id==='corridor-intensity')).toMatchObject({defaultValue:1.15,max:2.5})
    expect(variant.effects?.[0]?.parameters).toMatchObject({protectMedia:1,threshold:1.15,intensity:.55})
    expect(variant.choreography?.rules.map(r=>r.source.signal)).toEqual(expect.arrayContaining(['snare','downbeat','phrase','section-change']))
    for (const p of original.parameters ?? []) expect(variant.parameters?.some(v=>v.id===p.id)).toBe(true)
    for (const id of [CINEMA2_CORRIDOR_PRESET_ID, CINEMA2_GOONZ_CORRIDOR_PRESET_ID]) {
      const result = cinema2NativePresetRegistry.compile(id)
      expect(result.diagnostics).toEqual([])
      expect(result.ok).toBe(true)
    }
  })

  it('uses twelve independent program cadences and preserves explicit trigger authority', () => {
    expect(GOONZ_CORRIDOR_PATTERNS.map(p=>goonzPoolTrigger(p.value))).toEqual(['phrase','beat2','beat4','bar','beat2','bar','beat2','bar','bar4','bar','phrase','beat2'])
    const performance=new Cinema2CorridorPerformance(()=>.5,true)
    const values:Record<string,unknown>={pattern:'ricochet',poolTrigger:'program',motion:.75,autoPerformance:true,snare:1}
    const update=(time:number,paused=false)=>performance.update({parameters:{get:(key:string)=>values[key]},frame:{
      contextGeneration:1,elapsedTimeSec:time,deltaTimeSec:.1,mood:null,director:null,audio:null,
      transport:{trackId:'track',sourcePresent:true,playing:!paused,paused,animationActive:!paused,timeSec:time,bpm:120},
    }} as unknown as Cinema2ModuleUpdateContext)
    expect(update(0).pattern).toBe('ricochet')
    const active=update(.1)
    expect(active.goonz?.beat).toBeGreaterThan(0)
    expect(active.goonz?.snare).toBeCloseTo(.75)
    expect(update(.2,true).goonz?.beat).toBe(active.goonz?.beat)
    values.pattern='helix'
    expect(update(.3).goonz?.beat).toBe(0)
    expect(performance.poolFrame.patternChanged).toBe(true)
    values.poolTrigger='bar8'
    update(.4)
    expect(performance.poolFrame.patternChanged).toBe(true)
    values.pattern='overload'
    expect(update(.5).pattern).toBe('overload')
    expect(performance.poolFrame.patternChanged).toBe(false)
    expect(update(0).goonz?.beat).toBe(0)
    values.autoPerformance=false
    expect(update(.1).goonz?.snare).toBe(0)
    expect(goonzRoutineBeat(300,4)).toBe(40)
  })

  it('guarantees double the minimum original casing, face and illuminated aperture at every width', () => {
    for (const width of [1.8, 2.35, 3.3]) {
      const originalUnit = Math.min(width * CORRIDOR_BANK_SPAN * 2 / 4 * .72, CORRIDOR_BAY_LENGTH * .66)
      const minimum = Math.min(width * GOONZ_MIN_SIDE, GOONZ_MAX_AXIAL_SIDE)
      expect(minimum).toBeGreaterThanOrEqual(2 * .95 * originalUnit)
      expect(minimum * .70 / .95).toBeGreaterThanOrEqual(2 * .804 * originalUnit)
      expect(minimum * .64 / .95).toBeGreaterThanOrEqual(2 * .73 * originalUnit)
      // Adjacent pairs, single panels, axial staggering and full piston extension
      // must fit without touching any neighboring bank or depth bay.
      expect(GOONZ_PAIR_SPAN - GOONZ_MAX_PAIR_SIDE).toBeCloseTo(GOONZ_MIN_SIDE)
      expect((GOONZ_PAIR_SPAN + GOONZ_PAIR_GAP) / 2).toBeLessThan(CORRIDOR_BANK_SPAN)
      expect(GOONZ_MAX_SINGLE_SIDE / 2).toBeLessThan(CORRIDOR_BANK_SPAN)
      expect(CORRIDOR_BANK_SPAN + CORRIDOR_MAX_INSET).toBeLessThan(1)
      expect(GOONZ_MAX_AXIAL_SIDE + .11).toBeLessThan(CORRIDOR_BAY_LENGTH)
    }
  })

  it('uses at most two individually cased squares and exactly one corner rail per bank and bay', () => {
    const original = buildCorridorGeometry()
    const variant = buildCorridorGeometry(true)
    const railBytes = CORRIDOR_RAIL_VERTEX_COUNT * CORRIDOR_VERTEX_FLOATS * 4
    expect(original.byteLength).toBe(1382400 + railBytes)
    expect(variant.byteLength).toBe((original.byteLength-railBytes)/2+railBytes)
    const rails = new Map<string, number>()
    const cells = new Map<string, Set<number>>()
    for (let i = 0; i < variant.length; i += CORRIDOR_VERTEX_FLOATS) {
      if (variant[i+8] === CORRIDOR_RAIL_PART) {
        const key = `${variant[i+5]}:${variant[i+6]}`
        rails.set(key,(rails.get(key) ?? 0)+1)
        continue
      }
      const key = `${variant[i+5]}:${variant[i+6]}:${variant[i+7]}`
      const parts = cells.get(key) ?? new Set<number>()
      parts.add(variant[i+8]!)
      cells.set(key, parts)
    }
    expect(cells.size).toBe(96)
    expect(rails.size).toBe(48)
    expect([...rails.values()]).toEqual(Array(48).fill(6))
    for (const parts of cells.values()) expect([...parts].sort()).toEqual([0,1,2,3,4,5])
  })
})
