import { describe, expect, it } from 'vitest'
import {
  LASER_DMX_SHOW_DIRECTOR_TEMPLATES,
  createLaserDmxShowDirectorStateFromTemplate,
  createLaserDmxShowDirectorTemplateState,
  type LaserDmxShowDirectorTemplate,
} from './laserDmxShowDirectorTemplates'

describe('LaserDMX Show Director starter templates', () => {
  it('builds every starter template into normalized Show Director fixture state with unique ids', () => {
    for (const template of LASER_DMX_SHOW_DIRECTOR_TEMPLATES) {
      let nextId = 0
      const state = createLaserDmxShowDirectorTemplateState(template.id, () => `template-fixture-${nextId++}`)

      expect(state).not.toBeNull()
      expect(state?.fixtures).toHaveLength(template.fixtures.length)
      expect(new Set(state?.fixtures.map(fixture => fixture.id)).size).toBe(template.fixtures.length)
      expect(state?.selectedFixtureId).toBe(state?.fixtures[0]?.id ?? null)
      expect(state?.settings.gridSize.columns).toBeGreaterThan(0)
      expect(state?.settings.gridSize.rows).toBeGreaterThan(0)
      expect(state?.fixtures.every(fixture => (fixture.schemaVersion ?? 0) > 0)).toBe(true)
    }
  })

  it('ignores invalid template fixture data safely instead of creating legacy rig records', () => {
    const invalidTemplate = {
      id: 'invalid-template',
      name: 'Invalid Template',
      description: 'Includes malformed fixture rows that should be skipped.',
      category: 'club',
      tags: ['invalid'],
      fixtures: [
        { kind: 'spatialFixture', label: 'Legacy Spatial Fixture', x: 2, y: 2 },
        { kind: 'laser', label: 'Valid Laser', x: 4, y: 4, beam: { targetMode: 'fan' } },
        null,
      ],
    } as unknown as LaserDmxShowDirectorTemplate

    const state = createLaserDmxShowDirectorStateFromTemplate(invalidTemplate, () => 'safe-fixture-id')

    expect(state).not.toBeNull()
    expect(state?.fixtures).toHaveLength(1)
    expect(state?.fixtures[0]?.kind).toBe('laser')
    expect(state?.fixtures[0]?.id).toBe('safe-fixture-id')
    expect(state?.fixtures.every(fixture => !('spatialFixtures' in fixture))).toBe(true)
  })

  it('returns null for unknown template ids', () => {
    expect(createLaserDmxShowDirectorTemplateState('missing-template')).toBeNull()
  })
})
