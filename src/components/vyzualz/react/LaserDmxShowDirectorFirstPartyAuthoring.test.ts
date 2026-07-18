import { describe, expect, it } from 'vitest'
import { LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY } from './LaserDmxShowDirectorPerformanceProgram'
import { listLaserDmxProfessionalEffects } from './LaserDmxShowDirectorProfessionalEffectLibrary'
import { validateLaserShowProgrammingDocument } from './LaserDmxShowDirectorProgramming'

const REQUIRED_EFFECT_NAMES = [
  'Narrow Stepped Fan', 'Wide Stepped Fan', 'Smooth Opening Fan', 'Smooth Closing Fan',
  'Mirrored Fans', 'Opposed Fans', 'Crossing Fans', 'Parallel Sheet', 'Center-Out Fan',
  'Outside-In Fan', 'Aerial Rake', 'Upper Canopy', 'Tunnel', 'Corridor', 'Circle Scan',
  'Arc Scan', 'Triangle Outline', 'Diamond Outline', 'Polygon Outline', 'Progressive Wave',
  'Grid Scan', 'Line Diffraction Accent', 'Grid Diffraction Accent', 'Burst Diffraction Accent',
  'Held Tension Beam', 'Alternating Bank Fan', 'Call-and-Response Fan',
  'Front Fan Position', 'Cross Position', 'Center Convergence', 'Wide Drop Position',
  'Slow Pan Sweep', 'Slow Tilt Sweep', 'Gobo Breakup Look', 'Prism Expansion',
  'Narrow Beam Build', 'Frosted Breakdown', 'Section Color Bed', 'Build Lift',
  'Drop Saturation', 'Breakdown Wash', 'Outro Fade', 'Snare Flash',
  'Four-Beat Strobe Burst', 'Drop Impact', 'Phrase Blinder', 'Transition Flash',
  'Center-Out Chase', 'Outside-In Chase', 'Alternating Blocks', 'Symmetrical Fill',
  'Palette Gradient', 'Beat Step', 'Phrase Sweep', 'Baseline Haze', 'Build Haze Rise',
  'Drop Haze Hold', 'Breakdown Haze Reduction', 'CO₂ Drop Impact', 'CO₂ Phrase Accent',
] as const

describe('LaserDMX professional first-party show authoring', () => {
  it('ships the complete bounded professional effect library', () => {
    const effects = listLaserDmxProfessionalEffects()
    expect(effects.map(effect => effect.name)).toEqual(REQUIRED_EFFECT_NAMES)
    expect(new Set(effects.map(effect => effect.id)).size).toBe(REQUIRED_EFFECT_NAMES.length)
    for (const effect of effects) {
      expect(effect.pattern.raySlotCount, effect.id).toBeGreaterThan(0)
      expect(effect.pattern.raySlotCount, effect.id).toBeLessThanOrEqual(24)
      expect(effect.scan.scanRatePps, effect.id).toBeGreaterThanOrEqual(10)
      expect(effect.scan.scanRatePps, effect.id).toBeLessThanOrEqual(100_000)
      expect(effect.optics.copyCount, effect.id).toBeGreaterThanOrEqual(1)
      expect(effect.optics.copyCount, effect.id).toBeLessThanOrEqual(25)
      expect(effect.transitionIn.blankDisconnectedTravel, effect.id).toBe(true)
      expect(effect.transitionOut.blankDisconnectedTravel, effect.id).toBe(true)
    }
  })

  it('re-authors every shipped program as a native cue stack instead of a provisional adapter', () => {
    const entries = Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)
    expect(entries).toHaveLength(20)
    for (const entry of entries) {
      const program = entry.program
      expect(program, entry.id).not.toBeNull()
      expect(program?.diagnostics?.authoringVersion, entry.id).toBe('professional-cue-authoring-v1')
      const document = program?.laserProgramming
      expect(document, entry.id).toBeDefined()
      expect(document?.compatibility.source, entry.id).toBe('native')
      expect(document?.compatibility.warnings, entry.id).toEqual([])
      expect(document?.macros.some(macro => macro.compatibility?.provisional), entry.id).toBe(false)
      expect(validateLaserShowProgrammingDocument(document!), entry.id).toEqual([])
      expect(document?.cueStacks).toHaveLength(1)
      expect(document?.cueStacks[0]?.cues.length, entry.id).toBeGreaterThanOrEqual((program?.scenes.length ?? 0) * 4)
      expect(document?.macros.length, entry.id).toBeGreaterThanOrEqual(4)
      expect(document?.macros.length, entry.id).toBeLessThanOrEqual(32)
      expect(document?.groupRelationships.length, entry.id).toBe(document?.macros.length)
    }
  })

  it('keeps topology stable for four bars and makes every laser relationship share speed and spread', () => {
    for (const entry of Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)) {
      const document = entry.program!.laserProgramming!
      const topologyByCue = new Map(document.macros.map(macro => [macro.id, macro.pattern.topologyId]))
      for (const cue of document.cueStacks[0].cues.filter(candidate => !candidate.blackout)) {
        expect(cue.duration.kind, `${entry.id}:${cue.id}`).toBe('fourBars')
        expect(cue.repeatEveryBeats, `${entry.id}:${cue.id}`).toBe(64)
        expect(topologyByCue.get(cue.macroId), `${entry.id}:${cue.id}`).toBeTruthy()
      }
      for (const relationship of document.groupRelationships) {
        expect(relationship.sharedSpeed, `${entry.id}:${relationship.id}`).toBe(true)
        expect(relationship.sharedSpread, `${entry.id}:${relationship.id}`).toBe(true)
        expect(relationship.sharedIntensity, `${entry.id}:${relationship.id}`).toBe(true)
      }
    }
  })

  it('authors drop evolution, impact-only CO₂, and intentional pre-drop blackouts', () => {
    for (const entry of Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)) {
      const program = entry.program!
      const document = program.laserProgramming!
      const cueStack = document.cueStacks[0]
      const preDropSceneIds = new Set(program.scenes.filter(scene => scene.energyEnvelopeKey === 'preDrop' || scene.section.types.includes('preDrop')).map(scene => scene.id))
      for (const sceneId of preDropSceneIds) {
        expect(cueStack.cues.some(cue => cue.sceneIds?.includes(sceneId) && cue.blackout && cue.shutterClosed), `${entry.id}:${sceneId}`).toBe(true)
      }
      const dropOneMacros = cueStack.cues
        .filter(cue => cue.sceneIds?.some(sceneId => program.scenes.some(scene => scene.id === sceneId && scene.energyEnvelopeKey === 'drop1')))
        .map(cue => document.macros.find(macro => macro.id === cue.macroId)?.family)
      const dropTwoMacros = cueStack.cues
        .filter(cue => cue.sceneIds?.some(sceneId => program.scenes.some(scene => scene.id === sceneId && scene.energyEnvelopeKey === 'drop2')))
        .map(cue => document.macros.find(macro => macro.id === cue.macroId)?.family)
      if (dropOneMacros.length && dropTwoMacros.length) expect(dropTwoMacros).not.toEqual(dropOneMacros)
      for (const cue of cueStack.cues) {
        for (const accent of cue.accents.filter(item => item.id.endsWith(':drop-co2'))) {
          expect(accent.trigger).toBe('section')
          expect(accent.fixtureGroupAssignmentIds?.every(id => id.endsWith(':co2'))).toBe(true)
        }
      }
    }
  })
})
