import { expect, it } from 'vitest'
import { describeMoodMigration } from './support/describeMoodMigration'
import { moodStage, moodMusic } from './support/MoodMigrationHarness'
import { CINEMA2_GLYPH_SPHERE_PRESET_MANIFEST as manifest, glyphSphereParameterId as pid } from '../presets/Cinema2GlyphSpherePreset'

describeMoodMigration('Glyph Sphere', [{
  name: 'Glyph Armillary', manifest, auto: pid('autoPerformance'), strength: pid('reactivity'),
  up: [['glyph-sphere-core', 'coreGlow'], ['glyph-sphere-core', 'bandLighting'], ['glyph-sphere-core', 'halo']],
  down: [['glyph-sphere-core', 'motionRate'], ['glyph-sphere-core', 'tickLighting'], ['glyph-sphere-core', 'bandWobble']],
  shock: [['glyph-sphere-core', 'frameLighting'], ['glyph-sphere-core', 'bandSpread']],
}])

it('delivers independent shared audio facts into the module and leaves saved values untouched', () => {
  const stage = moodStage(manifest)
  const music = moodMusic()
  stage.state.setPersistentValue(pid('reactivity'), 1)
  const saved = stage.state.serialize()
  for (let i = 0; i < 40; i += 1) stage.choreography.update(music.next({ energy: 1, bass: 1, high: 1, vocal: 1 }))
  expect(stage.read('glyph-sphere-core', 'coreScale')).toBeLessThan(1)
  expect(stage.read('glyph-sphere-core', 'motionRate')).toBeGreaterThan(1)
  expect(stage.state.serialize()).toBe(saved)
  stage.choreography.dispose()
})

it('keeps lighting zeros authoritative through a drop', () => {
  const stage = moodStage(manifest)
  const music = moodMusic()
  const zeroed = ['frameLighting', 'tickLighting', 'jointLighting', 'coreGlow', 'halo', 'bandLighting']
  for (const name of zeroed) stage.state.setPersistentValue(pid(name), 0)
  stage.state.setPersistentValue(pid('autoPerformance'), true)
  for (let i = 0; i < 20; i += 1) stage.choreography.update(music.next({ energy: 1, bass: 1, event: 'drop', eventId: i, section: 'drop' }))
  for (const name of zeroed) expect(stage.read('glyph-sphere-core', name), name).toBe(0)
  stage.choreography.dispose()
})
