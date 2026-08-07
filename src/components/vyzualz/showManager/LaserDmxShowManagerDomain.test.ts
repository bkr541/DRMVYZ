import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS,
  LASER_DMX_SHOW_MANAGER_GRID_SIZE,
  LASER_DMX_SHOW_MANAGER_QUALITY,
  addLaserDmxShowManagerFixtureToSection,
  createLaserDmxShowManagerShow,
  normalizeLaserDmxShowManagerShow,
  reorderLaserDmxShowManagerSection,
  updateLaserDmxShowManagerSection,
  updateLaserDmxShowManagerWorkspaceSettings,
} from './LaserDmxShowManagerDomain'

describe('LaserDMX Show Manager Part 1 domain', () => {
  it('creates a no-audio Show with the exact canonical seven-section template', () => {
    const show = createLaserDmxShowManagerShow()

    expect(show.sections.map(section => [section.type, section.label])).toEqual([
      ['intro', 'Intro'],
      ['verse', 'Verse'],
      ['build', 'Build'],
      ['preDrop', 'Pre-Drop'],
      ['drop', 'Drop'],
      ['breakdown', 'Breakdown'],
      ['outro', 'Outro'],
    ])
    expect(show.sections.every(section => section.engineId === 'laserDmx')).toBe(true)
    expect(show.sections.every(section => section.source === 'user-created')).toBe(true)
    expect(show.sections.every(section => section.fixtures.length === 0)).toBe(true)
    expect(LASER_DMX_SHOW_MANAGER_GRID_SIZE).toEqual({ columns: 18, rows: 12 })
    expect(show.settings).toEqual(DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS)
    expect(LASER_DMX_SHOW_MANAGER_QUALITY).toBe('high')
  })

  it('defaults missing legacy section data but never overwrites an explicit valid section collection', () => {
    const missing = normalizeLaserDmxShowManagerShow({ id: 'legacy', name: 'Legacy' })
    expect(missing.sections).toHaveLength(7)

    const explicitEmpty = normalizeLaserDmxShowManagerShow({ id: 'empty', name: 'Empty', sections: [] })
    expect(explicitEmpty.sections).toEqual([])

    const existing = normalizeLaserDmxShowManagerShow({
      id: 'existing',
      name: 'Existing',
      sections: [{
        id: 'existing-section',
        label: 'Custom PreDrop',
        type: 'preDrop',
        startSec: 4,
        endSec: 9,
        source: 'user-created',
      }],
    })
    expect(existing.sections).toHaveLength(1)
    expect(existing.sections[0]).toMatchObject({ id: 'existing-section', label: 'Custom PreDrop', fixtures: [] })
  })

  it('migrates missing or malformed Stage 2 workspace settings without touching explicit sections', () => {
    const migrated = normalizeLaserDmxShowManagerShow({
      schemaVersion: 1,
      id: 'legacy-settings',
      settings: {
        showGrid: false,
        showLabels: 'invalid',
        showBeams: false,
        highlightGrid: false,
        rendererMode: 'made-up-renderer',
      },
      sections: [{
        id: 'kept-section',
        label: 'Kept',
        type: 'verse',
        startSec: 2,
        endSec: 5,
        fixtures: [],
      }],
    })

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.sections.map(section => section.id)).toEqual(['kept-section'])
    expect(migrated.settings).toEqual({
      showGrid: false,
      showLabels: true,
      showBeams: false,
      highlightGrid: false,
      rendererMode: 'auto',
    })
  })

  it('updates only canonical show-owned workspace settings and normalizes invalid renderer values', () => {
    const show = createLaserDmxShowManagerShow()
    const updated = updateLaserDmxShowManagerWorkspaceSettings(show, {
      showGrid: false,
      rendererMode: 'webgl',
    })

    expect(updated).not.toBe(show)
    expect(updated.sections).toBe(show.sections)
    expect(updated.settings).toEqual({
      ...show.settings,
      showGrid: false,
      rendererMode: 'webgl',
    })

    const malformed = updateLaserDmxShowManagerWorkspaceSettings(updated, {
      rendererMode: 'invalid' as never,
    })
    expect(malformed.settings.rendererMode).toBe('auto')
  })

  it('normalizes the canonical Pre-Drop display label without replacing custom labels', () => {
    const normalized = normalizeLaserDmxShowManagerShow({
      id: 'labels',
      sections: [
        { id: 'a', type: 'preDrop', label: 'PreDrop', startSec: 0, endSec: 1 },
        { id: 'b', type: 'preDrop', label: 'Tension', startSec: 1, endSec: 2 },
      ],
    })
    expect(normalized.sections[0]?.label).toBe('Pre-Drop')
    expect(normalized.sections[1]?.label).toBe('Tension')
  })

  it('keeps fixture ownership section-local, permits shared cells, and creates independent fixture IDs', () => {
    let show = createLaserDmxShowManagerShow()
    const firstSectionId = show.sections[0]!.id
    const secondSectionId = show.sections[1]!.id

    const first = addLaserDmxShowManagerFixtureToSection(show, firstSectionId, 'laser', { x: 4, y: 5 })
    show = first.show
    const second = addLaserDmxShowManagerFixtureToSection(show, secondSectionId, 'laser', { x: 4, y: 5 })
    show = second.show
    const sameCell = addLaserDmxShowManagerFixtureToSection(show, firstSectionId, 'strobe', { x: 4, y: 5 })
    show = sameCell.show

    expect(first.fixtureId).not.toBeNull()
    expect(second.fixtureId).not.toBeNull()
    expect(first.fixtureId).not.toBe(second.fixtureId)
    expect(show.sections[0]!.fixtures).toHaveLength(2)
    expect(show.sections[1]!.fixtures).toHaveLength(1)
    expect(show.sections[0]!.fixtures.map(fixture => [fixture.x, fixture.y])).toEqual([[4, 5], [4, 5]])

    const secondBefore = show.sections[1]!.fixtures[0]!.brightness
    show = updateLaserDmxShowManagerSection(show, firstSectionId, {
      fixtures: show.sections[0]!.fixtures.map((fixture, index) => index === 0 ? { ...fixture, brightness: 0.11 } : fixture),
    })
    expect(show.sections[0]!.fixtures[0]!.brightness).toBe(0.11)
    expect(show.sections[1]!.fixtures[0]!.brightness).toBe(secondBefore)
    expect(show.sections[0]!.fixtures[0]).not.toBe(show.sections[1]!.fixtures[0])
  })

  it('rejects disabled fixture families and clamps coordinates to the fixed Part 1 grid', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const disabled = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'ledTube')
    expect(disabled.fixtureId).toBeNull()
    expect(disabled.show).toBe(show)

    const enabled = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'movingHead', { x: 999, y: -4 })
    show = enabled.show
    expect(show.sections[0]!.fixtures[0]).toMatchObject({ x: 17, y: 0, groupId: null, colorMode: 'fixed' })
    expect(show).not.toHaveProperty('groups')
  })

  it('reorders canonical sections while keeping deterministic non-overlapping timing windows', () => {
    const show = createLaserDmxShowManagerShow()
    const verse = show.sections[1]!
    const moved = reorderLaserDmxShowManagerSection(show, verse.id, -1)

    expect(moved.sections.map(section => section.label).slice(0, 2)).toEqual(['Verse', 'Intro'])
    expect(moved.sections.map(section => [section.startSec, section.endSec]).slice(0, 2)).toEqual([[0, 1], [1, 2]])
  })
})
