import { describe, expect, it } from 'vitest'
import { createDefaultLaserDmxBeamMatrixSettings, createDefaultLaserDmxShowDirectorFixture } from '../react/ReactTypes'
import { createLaserDmxScannerPattern, scannerPointsToBeamTargets } from '../react/laserDmxScannerAuthoring'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../react/renderers/LaserDmxShowDirectorBeamMatrixCompiler'
import { createLaserDmxSceneFrame } from '../react/renderers/laserDmx/LaserDmxSceneFrame'
import { buildLaserDmxDedicatedFixtureRenderPlan } from '../react/renderers/laserDmx/LaserDmxDedicatedFixturePlan'
import {
  DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS,
  LASER_DMX_SHOW_MANAGER_GRID_SIZE,
  LASER_DMX_SHOW_MANAGER_QUALITY,
  LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS,
  addLaserDmxShowManagerFixtureToSection,
  copyLaserDmxShowManagerFixturesBetweenSections,
  createLaserDmxShowManagerEmptyRuntimeShowDirector,
  createLaserDmxShowManagerRuntimeSectionPrograms,
  createLaserDmxShowManagerRuntimeShowDirector,
  createLaserDmxShowManagerShow,
  getEligibleLaserDmxShowManagerFixtureCopySources,
  normalizeLaserDmxShowManagerShow,
  parseLaserDmxShowManagerFixtureKind,
  removeLaserDmxShowManagerFixtureFromSection,
  reorderLaserDmxShowManagerSection,
  resolveLaserDmxShowManagerPlaybackSection,
  resolveLaserDmxShowManagerGridCell,
  resolveLaserDmxShowManagerTriggerOption,
  describeLaserDmxShowManagerStoredTrigger,
  normalizeLaserDmxShowManagerFixture,
  triggerPatchForLaserDmxShowManagerOption,
  updateLaserDmxShowManagerFixtureInSection,
  updateLaserDmxShowManagerSection,
  updateLaserDmxShowManagerSectionWorkspaceSettings,
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

  it('stores LaserDMX workspace settings independently on each authored section', () => {
    const show = createLaserDmxShowManagerShow()
    const introId = show.sections[0]!.id
    const dropId = show.sections[4]!.id
    const updated = updateLaserDmxShowManagerSectionWorkspaceSettings(show, introId, {
      showGrid: false,
      rendererMode: 'webgl',
    })

    expect(updated.sections.find(section => section.id === introId)?.settings).toMatchObject({
      showGrid: false,
      rendererMode: 'webgl',
    })
    expect(updated.sections.find(section => section.id === dropId)?.settings).toEqual(
      DEFAULT_LASER_DMX_SHOW_MANAGER_WORKSPACE_SETTINGS,
    )
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

  it('creates a newly dropped Moving Head target from its actual Show Manager position and preserves authored targets', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const dropped = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'movingHead', {
      x: 12,
      y: 8,
      rotation: 90,
    })
    show = dropped.show
    const fixture = show.sections[0]!.fixtures.find(candidate => candidate.id === dropped.fixtureId)!

    expect(fixture).toMatchObject({ x: 12, y: 8, rotation: 90 })
    expect(fixture.beam).toMatchObject({ targetX: 16, targetY: 8 })
    expect(fixture.beam.targets?.[0]).toMatchObject({ x: 16, y: 8 })

    const explicit = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'movingHead', {
      x: 15,
      y: 9,
      beam: {
        targetX: 3,
        targetY: 4,
        targets: [{ id: 'authored-moving-head-target', x: 3, y: 4 }],
      },
    })
    const explicitFixture = explicit.show.sections[0]!.fixtures.find(candidate => candidate.id === explicit.fixtureId)!
    expect(explicitFixture.beam).toMatchObject({ targetX: 3, targetY: 4 })
    expect(explicitFixture.beam.targets?.[0]).toMatchObject({ id: 'authored-moving-head-target', x: 3, y: 4 })

    const saved = createDefaultLaserDmxShowDirectorFixture('movingHead', 'saved-moving-head-target', 0)
    saved.x = 14
    saved.y = 10
    saved.beam.targetX = 2
    saved.beam.targetY = 3
    saved.beam.targets = [{ id: 'saved-moving-head-target-1', x: 2, y: 3 }]
    const normalizedSaved = normalizeLaserDmxShowManagerFixture(saved)
    expect(normalizedSaved.beam).toMatchObject({ targetX: 2, targetY: 3 })
    expect(normalizedSaved.beam.targets?.[0]).toMatchObject({ id: 'saved-moving-head-target-1', x: 2, y: 3 })
  })

  it('maps pointer coordinates deterministically to the fixed grid, including boundary clamping', () => {
    const bounds = { left: 100, top: 50, width: 900, height: 600 }
    expect(resolveLaserDmxShowManagerGridCell(100, 50, bounds)).toEqual({ x: 0, y: 0 })
    expect(resolveLaserDmxShowManagerGridCell(550, 350, bounds)).toEqual({ x: 9, y: 6 })
    expect(resolveLaserDmxShowManagerGridCell(999.9, 649.9, bounds)).toEqual({ x: 17, y: 11 })
    expect(resolveLaserDmxShowManagerGridCell(5000, -5000, bounds)).toEqual({ x: 17, y: 0 })
    expect(resolveLaserDmxShowManagerGridCell(100, 50, { ...bounds, width: 0 })).toBeNull()
  })

  it('accepts only enabled drag payloads and generates kind-local display names without collisions', () => {
    expect(parseLaserDmxShowManagerFixtureKind('laser')).toBe('laser')
    expect(parseLaserDmxShowManagerFixtureKind('co2Jet')).toBeNull()
    expect(parseLaserDmxShowManagerFixtureKind('not-a-fixture')).toBeNull()

    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    show = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'laser', { x: 1, y: 1 }).show
    show = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'strobe', { x: 1, y: 1 }).show
    show = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'laser', { x: 1, y: 1 }).show
    expect(show.sections[0]!.fixtures.map(fixture => fixture.label)).toEqual(['Laser 1', 'Strobe 1', 'Laser 2'])
    expect(new Set(show.sections[0]!.fixtures.map(fixture => fixture.id)).size).toBe(3)
  })

  it('deep-copies eligible source fixtures once, appends them with unique identities, and keeps sections independent', () => {
    let show = createLaserDmxShowManagerShow()
    const introId = show.sections[0]!.id
    const verseId = show.sections[1]!.id

    const sourceLaser = addLaserDmxShowManagerFixtureToSection(show, introId, 'laser', {
      label: 'Front Laser',
      x: 17,
      y: 11,
      z: 0.35,
      rotation: 27,
      color: '#00ffaa',
      brightness: 0.43,
      beam: { beamSpread: 71, focus: 0.22 },
      trigger: triggerPatchForLaserDmxShowManagerOption('4bars'),
    })
    show = sourceLaser.show
    const sourceStrobe = addLaserDmxShowManagerFixtureToSection(show, introId, 'strobe', { x: 17, y: 11 })
    show = sourceStrobe.show
    const destinationExisting = addLaserDmxShowManagerFixtureToSection(show, verseId, 'laser', { label: 'Front Laser', x: 0, y: 0 })
    show = destinationExisting.show

    expect(getEligibleLaserDmxShowManagerFixtureCopySources(show, verseId).map(section => section.id)).toEqual([introId])
    expect(getEligibleLaserDmxShowManagerFixtureCopySources(show, verseId).every(section => section.id !== verseId)).toBe(true)

    const sourceBefore = show.sections[0]!.fixtures
    const result = copyLaserDmxShowManagerFixturesBetweenSections(show, introId, verseId)
    show = result.show

    expect(result.fixtureIds).toHaveLength(2)
    expect(new Set(result.fixtureIds).size).toBe(2)
    expect(result.fixtureIds).not.toContain(sourceLaser.fixtureId)
    expect(result.fixtureIds).not.toContain(sourceStrobe.fixtureId)
    expect(show.sections[0]!.fixtures.map(fixture => fixture.id)).toEqual(sourceBefore.map(fixture => fixture.id))
    expect(show.sections[1]!.fixtures.map(fixture => fixture.label)).toEqual(['Front Laser', 'Front Laser 2', 'Strobe 1'])
    expect(show.sections[1]!.fixtures[0]!.id).toBe(destinationExisting.fixtureId)

    const copiedLaser = show.sections[1]!.fixtures.find(fixture => fixture.id === result.fixtureIds[0])!
    const originalLaser = show.sections[0]!.fixtures.find(fixture => fixture.id === sourceLaser.fixtureId)!
    expect(copiedLaser).toMatchObject({
      kind: 'laser',
      x: 17,
      y: 11,
      z: 0.35,
      rotation: 27,
      color: '#00ffaa',
      brightness: 0.43,
      groupId: null,
      linkedPairId: null,
    })
    expect(copiedLaser.beam).not.toBe(originalLaser.beam)
    expect(copiedLaser.trigger).not.toBe(originalLaser.trigger)
    expect(copiedLaser.beam.targets?.[0]).not.toBe(originalLaser.beam.targets?.[0])
    expect(copiedLaser.beam.targets?.[0]?.id).not.toBe(originalLaser.beam.targets?.[0]?.id)
    expect(resolveLaserDmxShowManagerTriggerOption(copiedLaser.trigger)).toBe('4bars')

    show = updateLaserDmxShowManagerFixtureInSection(show, introId, sourceLaser.fixtureId!, { brightness: 0.91 })
    expect(show.sections[1]!.fixtures.find(fixture => fixture.id === copiedLaser.id)?.brightness).toBe(0.43)
    show = updateLaserDmxShowManagerFixtureInSection(show, verseId, copiedLaser.id, { color: '#ff0055' })
    expect(show.sections[0]!.fixtures.find(fixture => fixture.id === sourceLaser.fixtureId)?.color).toBe('#00ffaa')

    const failed = copyLaserDmxShowManagerFixturesBetweenSections(show, verseId, verseId)
    expect(failed.show).toBe(show)
    expect(failed.fixtureIds).toEqual([])
  })

  it('updates and deletes exactly one section-local fixture while preserving colocated neighbors', () => {
    let show = createLaserDmxShowManagerShow()
    const introId = show.sections[0]!.id
    const verseId = show.sections[1]!.id
    const first = addLaserDmxShowManagerFixtureToSection(show, introId, 'laser', { x: 4, y: 5 })
    show = first.show
    const colocated = addLaserDmxShowManagerFixtureToSection(show, introId, 'strobe', { x: 4, y: 5 })
    show = colocated.show
    const otherSection = addLaserDmxShowManagerFixtureToSection(show, verseId, 'laser', { x: 4, y: 5 })
    show = otherSection.show

    show = updateLaserDmxShowManagerFixtureInSection(show, introId, first.fixtureId!, {
      x: 999,
      y: -5,
      z: 4,
      rotation: 999,
      color: '#ff00aa',
      brightness: 3,
      colorMode: 'music',
      beam: { targetX: 999, targetY: -10, beamSpread: 999, focus: -1 },
      optics: { zoom: 9 },
    })

    const updated = show.sections[0]!.fixtures.find(fixture => fixture.id === first.fixtureId)!
    expect(updated).toMatchObject({ x: 17, y: 0, z: 1, rotation: 360, color: '#ff00aa', brightness: 1, colorMode: 'fixed' })
    expect(updated.beam).toMatchObject({ targetX: 17, targetY: 0, beamSpread: 180, focus: 0 })
    expect(updated.optics.zoom).toBe(1)

    const removed = removeLaserDmxShowManagerFixtureFromSection(show, introId, first.fixtureId!)
    expect(removed.sections[0]!.fixtures.map(fixture => fixture.id)).toEqual([colocated.fixtureId])
    expect(removed.sections[1]!.fixtures.map(fixture => fixture.id)).toEqual([otherSection.fixtureId])
  })

  it('resolves playback sections with the canonical Track Map boundary convention across seeks', () => {
    const show = createLaserDmxShowManagerShow()
    const intro = show.sections[0]!
    const verse = show.sections[1]!
    const outro = show.sections[show.sections.length - 1]!

    expect(resolveLaserDmxShowManagerPlaybackSection(show, 0)?.id).toBe(intro.id)
    expect(resolveLaserDmxShowManagerPlaybackSection(show, 0.999)?.id).toBe(intro.id)
    expect(resolveLaserDmxShowManagerPlaybackSection(show, 1)?.id).toBe(verse.id)
    expect(resolveLaserDmxShowManagerPlaybackSection(show, 5.25)?.label).toBe('Breakdown')
    expect(resolveLaserDmxShowManagerPlaybackSection(show, 1)?.id).toBe(verse.id)
    expect(resolveLaserDmxShowManagerPlaybackSection(show, outro.endSec)?.id).toBe(outro.id)
    expect(resolveLaserDmxShowManagerPlaybackSection(show, outro.endSec + 0.001)).toBeNull()
  })

  it('projects only the playback section fixtures into an isolated 18x12 Show Director runtime rig', () => {
    let show = createLaserDmxShowManagerShow()
    const introId = show.sections[0]!.id
    const dropId = show.sections[4]!.id
    show = addLaserDmxShowManagerFixtureToSection(show, introId, 'laser', {
      label: 'Editing Laser',
      trigger: triggerPatchForLaserDmxShowManagerOption('beat'),
    }).show
    show = addLaserDmxShowManagerFixtureToSection(show, dropId, 'strobe', {
      label: 'Playback Strobe',
      trigger: triggerPatchForLaserDmxShowManagerOption('24bars'),
    }).show
    show = updateLaserDmxShowManagerSectionWorkspaceSettings(show, dropId, { rendererMode: 'webgl', showBeams: false })

    const drop = show.sections.find(section => section.id === dropId)!
    const runtime = createLaserDmxShowManagerRuntimeShowDirector(show, drop)
    const programs = createLaserDmxShowManagerRuntimeSectionPrograms(show)
    const empty = createLaserDmxShowManagerEmptyRuntimeShowDirector(show)

    expect(runtime.sourceTemplateId).toBe(`show-manager:${show.id}:${dropId}`)
    expect(runtime.fixtures.map(fixture => fixture.label)).toEqual(['Playback Strobe'])
    expect(runtime.fixtures[0]).not.toBe(drop.fixtures[0])
    expect(resolveLaserDmxShowManagerTriggerOption(runtime.fixtures[0]!.trigger)).toBe('24bars')
    expect(runtime.selectedFixtureId).toBeNull()
    expect(runtime.selectedFixtureIds).toEqual([])
    expect(runtime.settings).toMatchObject({
      gridSize: { columns: 18, rows: 12 },
      rendererMode: 'webgl',
      webglQuality: 'high',
      showBeams: false,
      presentationMode: 'live',
    })
    expect(programs).toHaveLength(show.sections.length)
    expect(programs.find(program => program.section.id === introId)?.showDirector.fixtures.map(fixture => fixture.label))
      .toEqual(['Editing Laser'])
    expect(empty.fixtures).toEqual([])
    expect(empty.sourceTemplateId).toBe(`show-manager:${show.id}:empty`)
  })

  it('keeps Show Beams preview-only while preserving LED Bar/Strobe output and truthful grid semantics', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const fixtureIds: Record<string, string> = {}
    for (const kind of ['laser', 'movingHead', 'ledBar', 'strobe'] as const) {
      const added = addLaserDmxShowManagerFixtureToSection(show, sectionId, kind, { label: `Stage 7 ${kind}` })
      show = added.show
      fixtureIds[kind] = added.fixtureId!
    }
    show = updateLaserDmxShowManagerSectionWorkspaceSettings(show, sectionId, {
      showBeams: false,
      highlightGrid: false,
    })

    const persistedSection = show.sections[0]!
    expect(persistedSection.fixtures.every(fixture => fixture.beam.beamEnabled)).toBe(true)

    const runtime = createLaserDmxShowManagerRuntimeShowDirector(show, persistedSection)
    const runtimeByKind = Object.fromEntries(runtime.fixtures.map(fixture => [fixture.kind, fixture]))
    expect(runtimeByKind.laser.beam.beamEnabled).toBe(false)
    expect(runtimeByKind.movingHead.beam.beamEnabled).toBe(false)
    expect(runtimeByKind.ledBar.beam.beamEnabled).toBe(true)
    expect(runtimeByKind.strobe.beam.beamEnabled).toBe(true)
    expect(runtime.settings).toMatchObject({ showBeams: false, highlightFixtures: true })

    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: runtime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    expect(compiled.beams.some(beam => beam.id.includes(fixtureIds.laser))).toBe(false)
    expect(compiled.beams.some(beam => beam.id.includes(fixtureIds.movingHead))).toBe(false)
    expect(compiled.beams.some(beam => beam.id.includes(fixtureIds.ledBar))).toBe(true)
    expect(compiled.beams.some(beam => beam.id.includes(fixtureIds.strobe))).toBe(true)
  })

  it('keeps the visible Laser position, target-mode, aim, spread, focus, color, and brightness contract reachable through production compilation', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const added = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'laser', {
      label: 'Stage 4 Legacy Target Laser',
      x: 4,
      y: 5,
      z: 0.25,
      color: '#ff00aa',
      brightness: 0.67,
      beam: {
        beamEnabled: true,
        beamAngle: 27,
        beamSpread: 64,
        focus: 0.91,
        targetMode: 'fan',
      },
    })
    show = added.show
    const fixtureId = added.fixtureId!
    const section = () => show.sections.find(candidate => candidate.id === sectionId)!
    const runtime = () => createLaserDmxShowManagerRuntimeShowDirector(show, section())
    const compile = () => compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: runtime(),
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })

    const fanRuntime = runtime()
    expect(fanRuntime.fixtures[0]).toMatchObject({
      id: fixtureId,
      x: 4,
      y: 5,
      z: 0.25,
      color: '#ff00aa',
      brightness: 0.67,
      beam: { beamEnabled: true, beamAngle: 27, beamSpread: 64, focus: 0.91, targetMode: 'fan' },
    })
    const fanCompiled = compile()
    expect(fanCompiled.beams.length).toBeGreaterThan(0)
    expect(fanCompiled.beams[0]!.target.kind).toBe('stage')
    expect(fanCompiled.beams[0]!.appearance).toMatchObject({
      dimmer: 0.67,
      focus: 0.91,
    })
    expect(fanCompiled.beams[0]!.color).toMatchObject({ red: 255, green: 0, blue: 170 })
    expect(fanCompiled.beams[0]!.appearance.divergence).toBeCloseTo(64 / 240)
    const firstFanTarget = fanCompiled.beams[0]!.target

    show = updateLaserDmxShowManagerFixtureInSection(show, sectionId, fixtureId, { beam: { beamAngle: 83 } })
    expect(compile().beams[0]!.target).not.toEqual(firstFanTarget)

    show = updateLaserDmxShowManagerFixtureInSection(show, sectionId, fixtureId, {
      beam: {
        targetMode: 'fixed',
        targetX: 2,
        targetY: 3,
        targets: [{ id: `${fixtureId}-stage4-fixed-target`, x: 2, y: 3 }],
      },
    })
    const fixedRuntime = runtime()
    expect(fixedRuntime.fixtures[0]!.beam).toMatchObject({ targetMode: 'fixed', targetX: 2, targetY: 3 })
    const fixedCompiled = compile()
    expect(fixedCompiled.beams[0]!.target).toMatchObject({ kind: 'grid', column: 3, row: 3 })

    const frame = createLaserDmxSceneFrame({
      showDirector: fixedRuntime,
      evaluatedBeamMatrix: fixedCompiled,
      audioTimeSec: 2,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'show-manager-stage-4-legacy-target',
      bpm: 128,
    })
    expect(frame.fixtures[0]!.position.x).toBeCloseTo(4 / 17)
    expect(frame.fixtures[0]!.position.y).toBeCloseTo(5 / 11)
    expect(frame.fixtures[0]!.position.z).toBeCloseTo(0.25)
    expect(frame.beams[0]?.focus).toBeCloseTo(0.91)
    expect(frame.beams[0]?.spreadDeg).toBeCloseTo(64)
  })

  it('round-trips the Moving Head Stage 5 contract and carries its aiming, optics, and pattern fields through the production renderer', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const added = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'movingHead', {
      label: 'Stage 5 Moving Head',
      x: 8,
      y: 8,
      rotation: 28,
      color: '#22ffaa',
      brightness: 0.74,
      beam: {
        beamEnabled: true,
        beamAngle: 14,
        beamSpread: 36,
        focus: 0.64,
        targetMode: 'fixed',
        targetX: 8,
        targetY: 4,
        targetDepthLayer: 'deepAir',
      },
      component: { movingHeadPanTiltStyle: 'snap' },
      optics: {
        zoom: 0.33,
        iris: 0.71,
        frost: 0.12,
        goboPattern: 'star',
        goboAmount: 0.82,
        goboRotation: 47,
        prismFacets: 3,
      },
    })
    show = added.show
    const fixtureId = added.fixtureId!

    const reloaded = normalizeLaserDmxShowManagerShow(JSON.parse(JSON.stringify(show)))
    const reloadedFixture = reloaded.sections[0]!.fixtures.find(candidate => candidate.id === fixtureId)!
    expect(reloadedFixture).toMatchObject({
      x: 8,
      y: 8,
      rotation: 28,
      color: '#22ffaa',
      brightness: 0.74,
      beam: {
        beamEnabled: true,
        beamAngle: 14,
        beamSpread: 36,
        focus: 0.64,
        targetMode: 'fixed',
        targetX: 8,
        targetY: 4,
        targetDepthLayer: 'deepAir',
      },
      component: { movingHeadPanTiltStyle: 'snap' },
      optics: {
        zoom: 0.33,
        iris: 0.71,
        frost: 0.12,
        goboPattern: 'star',
        goboAmount: 0.82,
        goboRotation: 47,
        prismFacets: 3,
      },
    })

    const runtime = createLaserDmxShowManagerRuntimeShowDirector(reloaded, reloaded.sections[0]!)
    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: runtime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    expect(compiled.beams).toHaveLength(1)
    expect(compiled.beams[0]!.motion.mode).toBe('projectile')
    expect(compiled.beams[0]!.appearance).toMatchObject({ dimmer: 0.74, focus: 0.64 })

    const frame = createLaserDmxSceneFrame({
      showDirector: runtime,
      evaluatedBeamMatrix: compiled,
      audioTimeSec: 2,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'show-manager-stage-5-moving-head',
      bpm: 128,
    })
    expect(frame.targets.find(target => target.fixtureId === fixtureId)).toMatchObject({
      depthZone: 'deepAir',
      depthSource: 'explicitLayer',
    })
    expect(frame.beams[0]).toMatchObject({ fixtureId, focus: 0.64, spreadDeg: 36 })

    const fixturePlan = buildLaserDmxDedicatedFixtureRenderPlan(frame, {
      backingWidth: 1920,
      backingHeight: 1080,
      cssWidth: 960,
      cssHeight: 540,
    })
    expect(fixturePlan.movingHeads).toHaveLength(3)
    expect(fixturePlan.movingHeads.every(head => head.goboPattern === 5 && head.goboAmount === 0.82)).toBe(true)
    expect(fixturePlan.movingHeads.every(head => head.zoom === 0.33 && head.iris === 0.71 && head.frost === 0.12)).toBe(true)
    expect(fixturePlan.movingHeads[0]?.goboRotationRad).toBeCloseTo(47 * Math.PI / 180 + 2 * 0.22, 6)

    const disabled = updateLaserDmxShowManagerFixtureInSection(reloaded, sectionId, fixtureId, { beam: { beamEnabled: false } })
    const disabledRuntime = createLaserDmxShowManagerRuntimeShowDirector(disabled, disabled.sections[0]!)
    const disabledCompiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: disabledRuntime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    expect(disabledCompiled.beams).toHaveLength(0)
  })

  it('round-trips the Stage 6 LED Bar and Strobe contracts through the production compiler and dedicated renderer', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const addedLed = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'ledBar', {
      label: 'Stage 6 LED Bar',
      x: 5,
      y: 7,
      z: 0.2,
      rotation: 90,
      color: '#33ffaa',
      brightness: 0.68,
      optics: { zoom: 0.66 },
      beam: {
        beamEnabled: true,
        targetX: 14,
        targetY: 2,
        beamSpread: 88,
        focus: 0.23,
      },
      component: {
        ledCellCount: 24,
        ledDirection: 'centerOut',
      },
    })
    show = addedLed.show
    const ledId = addedLed.fixtureId!
    const addedStrobe = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'strobe', {
      label: 'Stage 6 Strobe',
      x: 11,
      y: 4,
      z: -0.15,
      rotation: 35,
      color: '#ffffff',
      brightness: 0.9,
      optics: { zoom: 0.44 },
      beam: {
        beamEnabled: true,
        targetX: 1,
        targetY: 10,
        beamSpread: 104,
        focus: 0.12,
      },
      component: { strobeRate: 15 },
    })
    show = addedStrobe.show
    const strobeId = addedStrobe.fixtureId!

    const reloaded = normalizeLaserDmxShowManagerShow(JSON.parse(JSON.stringify(show)))
    const reloadedLed = reloaded.sections[0]!.fixtures.find(candidate => candidate.id === ledId)!
    const reloadedStrobe = reloaded.sections[0]!.fixtures.find(candidate => candidate.id === strobeId)!
    expect(reloadedLed).toMatchObject({
      x: 5,
      y: 7,
      z: 0.2,
      rotation: 90,
      color: '#33ffaa',
      brightness: 0.68,
      component: { ledCellCount: 24, ledDirection: 'centerOut' },
      // Hidden Stage 6 legacy fields remain loadable/persisted for compatibility.
      optics: { zoom: 0.66 },
      beam: { targetX: 14, targetY: 2, beamSpread: 88, focus: 0.23 },
    })
    expect(reloadedStrobe).toMatchObject({
      x: 11,
      y: 4,
      z: -0.15,
      rotation: 35,
      brightness: 0.9,
      component: { strobeRate: 15 },
      optics: { zoom: 0.44 },
      beam: { targetX: 1, targetY: 10, beamSpread: 104, focus: 0.12 },
    })

    const runtime = createLaserDmxShowManagerRuntimeShowDirector(reloaded, reloaded.sections[0]!)
    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: runtime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    const ledBeams = compiled.beams.filter(beam => beam.id.startsWith(`sd-${ledId}-bar-`))
    const strobeBeam = compiled.beams.find(beam => beam.id.startsWith(`sd-${strobeId}-strobe-field`))
    expect(ledBeams).toHaveLength(16)
    expect(compiled.groups.find(group => group.name === 'Stage 6 LED Bar')?.sequence.mode).toBe('centerOut')
    expect(strobeBeam?.appearance).toMatchObject({ width: 8, divergence: 0.42, focus: 0.42, strobeRate: 0.5 })

    const frame = createLaserDmxSceneFrame({
      showDirector: runtime,
      evaluatedBeamMatrix: compiled,
      audioTimeSec: 0,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'show-manager-stage-6-led-strobe',
      bpm: 128,
    })
    expect(frame.fixtures.find(candidate => candidate.id === strobeId)?.strobeRate).toBeCloseTo(0.5)
    const fixturePlan = buildLaserDmxDedicatedFixtureRenderPlan(frame, {
      backingWidth: 1920,
      backingHeight: 1080,
      cssWidth: 960,
      cssHeight: 540,
    })
    expect(fixturePlan.leds.find(led => led.id === `${ledId}-led`)).toMatchObject({ segments: 24, behavior: 3 })
    expect(fixturePlan.flashes.some(flash => flash.id === `${strobeId}-strobe`)).toBe(true)

    const strobeOff = updateLaserDmxShowManagerFixtureInSection(reloaded, sectionId, strobeId, { component: { strobeRate: 0 } })
    const offRuntime = createLaserDmxShowManagerRuntimeShowDirector(strobeOff, strobeOff.sections[0]!)
    const offCompiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: offRuntime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    expect(offCompiled.beams.find(beam => beam.id.startsWith(`sd-${strobeId}-strobe-field`))?.appearance.strobeRate).toBe(0)
    const offFrame = createLaserDmxSceneFrame({
      showDirector: offRuntime,
      evaluatedBeamMatrix: offCompiled,
      audioTimeSec: 0,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'show-manager-stage-6-strobe-off',
      bpm: 128,
    })
    expect(offFrame.fixtures.find(candidate => candidate.id === strobeId)?.strobeRate).toBe(0)
    expect(offFrame.transientEvents.some(event => event.kind === 'strobe')).toBe(false)

    const strobeMax = updateLaserDmxShowManagerFixtureInSection(reloaded, sectionId, strobeId, { component: { strobeRate: 30 } })
    const maxRuntime = createLaserDmxShowManagerRuntimeShowDirector(strobeMax, strobeMax.sections[0]!)
    const maxCompiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: maxRuntime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    const maxFrame = createLaserDmxSceneFrame({
      showDirector: maxRuntime,
      evaluatedBeamMatrix: maxCompiled,
      audioTimeSec: 0,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'show-manager-stage-6-strobe-max',
      bpm: 128,
    })
    expect(maxFrame.fixtures.find(candidate => candidate.id === strobeId)?.strobeRate).toBe(1)
  })

  it('defaults missing Stage 6 fixture-specific fields without deleting legacy saved fixture data', () => {
    const legacyLed = createDefaultLaserDmxShowDirectorFixture('ledBar', 'legacy-led-stage-6')
    const legacyStrobe = createDefaultLaserDmxShowDirectorFixture('strobe', 'legacy-strobe-stage-6')
    const rawLed = JSON.parse(JSON.stringify(legacyLed)) as {
      component: Record<string, unknown>
      beam: Record<string, unknown>
      optics: Record<string, unknown>
    }
    const rawStrobe = JSON.parse(JSON.stringify(legacyStrobe)) as {
      component: Record<string, unknown>
      beam: Record<string, unknown>
      optics: Record<string, unknown>
    }
    delete rawLed.component.ledCellCount
    delete rawLed.component.ledDirection
    delete rawStrobe.component.strobeRate
    rawLed.optics.zoom = 0.71
    rawStrobe.optics.zoom = 0.39
    rawLed.beam.targetX = 16
    rawLed.beam.targetY = 9
    rawLed.beam.beamSpread = 77
    rawLed.beam.focus = 0.31
    rawStrobe.beam.targetX = 2
    rawStrobe.beam.targetY = 8
    rawStrobe.beam.beamSpread = 99
    rawStrobe.beam.focus = 0.17

    const normalizedLed = normalizeLaserDmxShowManagerFixture(rawLed)
    const normalizedStrobe = normalizeLaserDmxShowManagerFixture(rawStrobe)
    expect(normalizedLed.component).toMatchObject({ ledCellCount: 8, ledDirection: 'leftToRight' })
    expect(normalizedStrobe.component.strobeRate).toBe(8)
    expect(normalizedLed.optics.zoom).toBe(0.71)
    expect(normalizedStrobe.optics.zoom).toBe(0.39)
    expect(normalizedLed.beam).toMatchObject({ targetX: 16, targetY: 9, beamSpread: 77, focus: 0.31 })
    expect(normalizedStrobe.beam).toMatchObject({ targetX: 2, targetY: 8, beamSpread: 99, focus: 0.17 })
  })

  it('uses angle-based Moving Head aiming only outside Fixed mode', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const added = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'movingHead', {
      x: 8,
      y: 8,
      rotation: 0,
      beam: { targetMode: 'fixed', targetX: 8, targetY: 4, beamAngle: -90 },
    })
    show = added.show
    const fixtureId = added.fixtureId!
    const compile = () => compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: createLaserDmxShowManagerRuntimeShowDirector(show, show.sections[0]!),
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })

    const fixedTarget = compile().beams[0]!.target
    show = updateLaserDmxShowManagerFixtureInSection(show, sectionId, fixtureId, { rotation: 90, beam: { beamAngle: 0 } })
    expect(compile().beams[0]!.target).toEqual(fixedTarget)

    show = updateLaserDmxShowManagerFixtureInSection(show, sectionId, fixtureId, { beam: { targetMode: 'fan' } })
    const fanTarget = compile().beams[0]!.target
    show = updateLaserDmxShowManagerFixtureInSection(show, sectionId, fixtureId, { rotation: 180 })
    expect(compile().beams[0]!.target).not.toEqual(fanTarget)
  })

  it('keeps Stage 4 Laser parameters reachable from canonical Show Manager state through the production compiler and scanner renderer', () => {
    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const added = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'laser', { label: 'Stage 4 Laser' })
    show = added.show
    const fixtureId = added.fixtureId!
    const fixture = show.sections[0]!.fixtures.find(candidate => candidate.id === fixtureId)!
    const scanner = createLaserDmxScannerPattern(fixture, 'fanSweep', LASER_DMX_SHOW_MANAGER_GRID_SIZE)
    scanner.scanRatePps = 18000
    scanner.direction = 'reverse'
    const targets = scannerPointsToBeamTargets(scanner)

    show = updateLaserDmxShowManagerFixtureInSection(show, sectionId, fixtureId, {
      color: '#ff00aa',
      brightness: 0.67,
      beam: {
        beamEnabled: true,
        beamSpread: 64,
        focus: 0.91,
        targetX: targets[0]!.x,
        targetY: targets[0]!.y,
        targets,
      },
      scanner,
    })

    const section = show.sections.find(candidate => candidate.id === sectionId)!
    const runtime = createLaserDmxShowManagerRuntimeShowDirector(show, section)
    const runtimeFixture = runtime.fixtures[0]!
    expect(runtimeFixture).toMatchObject({
      id: fixtureId,
      color: '#ff00aa',
      brightness: 0.67,
      beam: {
        beamEnabled: true,
        beamSpread: 64,
        focus: 0.91,
      },
      scanner: { patternType: 'fanSweep', scanRatePps: 18000, direction: 'reverse' },
    })

    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: runtime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })
    expect(compiled.beams.length).toBeGreaterThan(0)
    expect(compiled.beams[0]!.appearance.focus).toBeCloseTo(0.91)
    expect(compiled.beams[0]!.appearance.divergence).toBeCloseTo(64 / 240)

    const frame = createLaserDmxSceneFrame({
      showDirector: runtime,
      evaluatedBeamMatrix: compiled,
      audioTimeSec: 2,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: false,
      trackKey: 'show-manager-stage-4',
      bpm: 128,
    })
    expect(frame.scannerHeads[0]?.scanRatePps).toBe(18000)
    expect(frame.scanPaths[0]).toMatchObject({
      fixtureId,
      authoringPatternType: 'fanSweep',
      scanDirection: 'reverse',
      compatibilityMode: 'native',
    })
    expect(frame.beams[0]?.focus).toBeCloseTo(0.91)
    expect(frame.beams[0]?.spreadDeg).toBeCloseTo(64)
  })

  it('preserves legacy Laser optics.zoom data even though Stage 4 no longer presents it as beam Width', () => {
    const legacy = createDefaultLaserDmxShowDirectorFixture('laser', 'legacy-laser-zoom')
    legacy.optics.zoom = 0.73

    const normalized = normalizeLaserDmxShowManagerFixture(legacy)

    expect(normalized.optics.zoom).toBe(0.73)
  })

  it('centralizes the supported Show Manager trigger choices onto canonical trigger fields', () => {
    expect(LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.map(option => option.label)).toEqual([
      'None', 'Beat', 'Downbeat', '4 Bars', '8 Bars', '16 Bars', '24 Bars', 'Kick Hit', 'Snare Hit',
    ])

    let show = createLaserDmxShowManagerShow()
    const sectionId = show.sections[0]!.id
    const added = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'laser')
    show = added.show
    const fixtureId = added.fixtureId!

    for (const option of LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS) {
      show = updateLaserDmxShowManagerFixtureInSection(show, sectionId, fixtureId, {
        trigger: triggerPatchForLaserDmxShowManagerOption(option.value),
      })
      const fixture = show.sections[0]!.fixtures.find(candidate => candidate.id === fixtureId)!
      expect(resolveLaserDmxShowManagerTriggerOption(fixture.trigger)).toBe(option.value)
    }
  })


  it('normalizes the legacy hidden Drop default for Show Manager lasers without rewriting other unsupported stored triggers', () => {
    const legacyDefault = createDefaultLaserDmxShowDirectorFixture('laser', 'legacy-hidden-drop')
    const normalizedDefault = normalizeLaserDmxShowManagerFixture(legacyDefault)

    expect(normalizedDefault.trigger).toMatchObject({
      mode: 'alwaysOn',
      quantize: 'none',
      retrigger: 'allow',
      fadeInMs: 0,
      fadeOutMs: 0,
    })
    expect(resolveLaserDmxShowManagerTriggerOption(normalizedDefault.trigger)).toBe('none')

    const storedBuild = normalizeLaserDmxShowManagerFixture({
      ...legacyDefault,
      id: 'stored-build',
      trigger: {
        ...legacyDefault.trigger,
        sectionTypes: ['build'],
      },
    })
    expect(storedBuild.trigger.mode).toBe('section')
    expect(storedBuild.trigger.sectionTypes).toEqual(['build'])
    expect(resolveLaserDmxShowManagerTriggerOption(storedBuild.trigger)).toBeNull()
    expect(describeLaserDmxShowManagerStoredTrigger(storedBuild.trigger)).toBe('Stored: Section (build)')
  })

  it('reorders canonical sections while keeping deterministic non-overlapping timing windows', () => {
    const show = createLaserDmxShowManagerShow()
    const verse = show.sections[1]!
    const moved = reorderLaserDmxShowManagerSection(show, verse.id, -1)

    expect(moved.sections.map(section => section.label).slice(0, 2)).toEqual(['Verse', 'Intro'])
    expect(moved.sections.map(section => [section.startSec, section.endSec]).slice(0, 2)).toEqual([[0, 1], [1, 2]])
  })
})
