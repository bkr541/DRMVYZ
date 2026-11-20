import { expect, it } from 'vitest'
import { describeMoodMigration } from './support/describeMoodMigration'
import { moodStage, moodMusic } from './support/MoodMigrationHarness'
import { CINEMA2_WIREFRAME_PORTAL_PRESET_MANIFEST as manifest, wireframePortalParameterId as pid } from '../presets/Cinema2WireframePortalPreset'

const M = 'wireframe-portal-core'
describeMoodMigration('Wireframe Portal', [{
  name: 'Kinetic Truss', manifest, auto: pid('autoPerformance'), strength: pid('reactivity'),
  pattern: { patternChange: pid('patternChange'), trigger: pid('trigger') },
  up: [[M, 'kinetics'], [M, 'beamLighting'], [M, 'jointHeat']],
  down: [[M, 'motionRate'], [M, 'kinetics'], [M, 'beamLighting']],
  shock: [[M, 'strobe'], [M, 'pinLighting']],
}])

it('delivers shared audio facts into the module and leaves saved values untouched', () => {
  const stage = moodStage(manifest)
  const music = moodMusic()
  stage.state.setPersistentValue(pid('reactivity'), 1)
  const saved = stage.state.serialize()
  for (let i = 0; i < 40; i += 1) stage.choreography.update(music.next({ energy: 1, bass: 1, high: 1, vocal: 1 }))
  expect(stage.read(M, 'kinetics')).toBeGreaterThan(1)
  expect(stage.read(M, 'motionRate')).toBeGreaterThan(1)
  expect(stage.read(M, 'rimLighting')).toBeLessThan(1)
  expect(stage.state.serialize()).toBe(saved)
  stage.choreography.dispose()
})

it('keeps lighting zeros authoritative through a drop', () => {
  const stage = moodStage(manifest)
  const music = moodMusic()
  const zeroed = ['jointHeat', 'edgeLighting', 'pinLighting', 'rimLighting', 'beamLighting', 'haze']
  for (const name of zeroed) stage.state.setPersistentValue(pid(name), 0)
  stage.state.setPersistentValue(pid('autoPerformance'), true)
  for (let i = 0; i < 20; i += 1) stage.choreography.update(music.next({ energy: 1, bass: 1, event: 'drop', eventId: i, section: 'drop' }))
  for (const name of zeroed) expect(stage.read(M, name), name).toBe(0)
  stage.choreography.dispose()
})
