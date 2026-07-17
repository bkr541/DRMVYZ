import { describe, expect, it } from 'vitest'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from './LaserDmxShowDirectorPerformancePresets'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES, createLaserDmxShowDirectorTemplateState } from './laserDmxShowDirectorTemplates'
import {
  LASER_DMX_PHYSICAL_CONTENT_AUTHORING_VERSION,
  auditLaserDmxBuiltInPhysicalContent,
} from './LaserDmxShowDirectorPhysicalContentMigration'
import {
  SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES,
  resolveShowDirectorVisualValidationFrame,
} from './LaserDmxShowDirectorVisualValidation'

function ids(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

const REQUIRED_FRAME_IDS = [
  'intro',
  'verse',
  'build',
  'pre-drop',
  'drop-1-body',
  'breakdown',
  'drop-2-body',
  'outro',
] as const

const REQUIRED_VISUAL_SHOW_IDS = [
  'prism-cathedral',
  'cardinal-fan-reactor',
  'cyan-mirror-cage',
  'small-club-rig-performance',
  'festival-front-beams-performance',
  'dubstep-drop-lasers-performance',
] as const

describe('LaserDMX Patch 5 physical built-in content migration', () => {
  it('migrates every first-party Performance Show rig to native ordered scanner paths', () => {
    expect(LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS).toHaveLength(20)
    for (const preset of LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS) {
      const rig = preset.createRig(ids(preset.id))
      const audit = auditLaserDmxBuiltInPhysicalContent(preset.id, rig)
      expect(audit.persistentTargetNetworkCount, preset.id).toBe(0)
      expect(audit.radialSpokeRiskCount, preset.id).toBe(0)
      expect(audit.unblankedDisconnectedPathCount, preset.id).toBe(0)
      expect(audit.maximumOpticalCopyCount, preset.id).toBeLessThanOrEqual(9)
      if (audit.laserFixtureCount > 0) {
        expect(audit.nativeScannerCount, preset.id).toBe(audit.laserFixtureCount)
        expect(audit.singleApertureScannerCount + audit.explicitOpticalScannerCount, preset.id).toBe(audit.laserFixtureCount)
        for (const fixture of rig.fixtures.filter(item => item.kind === 'laser')) {
          expect(fixture.scanner?.migration.status, `${preset.id}:${fixture.semanticKey}`).toBe('native')
          expect(fixture.scanner?.path.retraceBlanking, `${preset.id}:${fixture.semanticKey}`).toBe(true)
          expect(fixture.scanner?.optics.apertureCount, `${preset.id}:${fixture.semanticKey}`).toBe(1)
          expect(fixture.beam.targets?.length ?? 0, `${preset.id}:${fixture.semanticKey}`).toBeLessThanOrEqual(1)
          expect(fixture.optics.rayCount, `${preset.id}:${fixture.semanticKey}`).toBe(1)
        }
      }
    }
  })

  it('migrates all seven static Rig Layout presets without touching legacy project compatibility', () => {
    expect(LASER_DMX_SHOW_DIRECTOR_TEMPLATES).toHaveLength(7)
    for (const template of LASER_DMX_SHOW_DIRECTOR_TEMPLATES) {
      const rig = createLaserDmxShowDirectorTemplateState(template.id, ids(template.id))
      expect(rig, template.id).not.toBeNull()
      const audit = auditLaserDmxBuiltInPhysicalContent(template.id, rig!)
      expect(audit.persistentTargetNetworkCount, template.id).toBe(0)
      expect(audit.radialSpokeRiskCount, template.id).toBe(0)
      expect(audit.nativeScannerCount, template.id).toBe(audit.laserFixtureCount)
    }
  })

  it('adds section and cadence scanner development while retaining the original programs', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS) {
      const program = preset.createProgram()
      expect(program.diagnostics?.authoringVersion, preset.id).toBe(LASER_DMX_PHYSICAL_CONTENT_AUTHORING_VERSION)
      expect(program.scenes.length, preset.id).toBeGreaterThanOrEqual(8)
      for (const scene of program.scenes) {
        expect(scene.sectionBodyMutations?.some(mutation => mutation.id.includes('physical-')), `${preset.id}:${scene.id}`).toBe(true)
        if (preset.createRig(ids(`${preset.id}-probe`)).fixtures.some(fixture => fixture.kind === 'laser')) {
          expect(scene.sectionBodyMutations?.some(mutation => mutation.id.includes('physical-scanner-body')), `${preset.id}:${scene.id}`).toBe(true)
          expect(scene.barMutations?.some(mutation => mutation.id.includes('physical-scanner-bar-handoff')), `${preset.id}:${scene.id}`).toBe(true)
          expect(scene.barMutations?.some(mutation => mutation.id.includes('physical-scanner-four-bar')), `${preset.id}:${scene.id}`).toBe(true)
          expect(scene.eightBarRecruitment?.some(mutation => mutation.id.includes('physical-scanner-eight-bar')), `${preset.id}:${scene.id}`).toBe(true)
          expect(scene.sixteenBarEvolution?.some(mutation => mutation.id.includes('physical-scanner-sixteen-bar')), `${preset.id}:${scene.id}`).toBe(true)
          const roleScannerMutations = (scene.sectionBodyMutations ?? []).filter(mutation => (
            mutation.id.includes('physical-scanner-hero')
            || mutation.id.includes('physical-scanner-support')
            || mutation.id.includes('physical-scanner-texture')
          ))
          expect(roleScannerMutations.length, `${preset.id}:${scene.id}:role scanner hierarchy`).toBeGreaterThanOrEqual(2)
          expect(roleScannerMutations.every(mutation => (mutation.address?.bankRoles?.length ?? 0) > 0), `${preset.id}:${scene.id}:semantic scanner banks`).toBe(true)
        }
      }
      if (preset.createRig(ids(`${preset.id}-section-profile`)).fixtures.some(fixture => fixture.kind === 'laser')) {
        const scannerProfiles = program.scenes.flatMap(scene => (scene.sectionBodyMutations ?? [])
          .filter(mutation => mutation.id.includes('physical-scanner-body'))
          .flatMap(mutation => mutation.fixtureActions ?? [])
          .filter(action => action.kind === 'scanner')
          .map(action => JSON.stringify({ patternType: action.patternType, scanRatePps: action.scanRatePps, durationBeats: action.durationBeats, fanWidth: action.fanWidth, depthLayer: action.depthLayer, opticalMode: action.opticalMode, opticalCopyCount: action.opticalCopyCount })))
        expect(new Set(scannerProfiles).size, `${preset.id}:authored section scanner profiles`).toBeGreaterThanOrEqual(6)
      }
    }
  })

  it('resolves deterministic native scanner states across the complete song arc for representative laser shows', () => {
    for (const presetId of REQUIRED_VISUAL_SHOW_IDS) {
      const preset = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(item => item.id === presetId)
      expect(preset, presetId).toBeTruthy()
      const signatures: string[] = []
      for (const frameId of REQUIRED_FRAME_IDS) {
        const definition = SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.find(frame => frame.id === frameId)!
        const first = resolveShowDirectorVisualValidationFrame(preset!, definition)
        const second = resolveShowDirectorVisualValidationFrame(preset!, definition)
        expect(first.sceneFrame.scannerDiagnostics.scannerHeadCount, `${presetId}:${frameId}`).toBeGreaterThan(0)
        expect(first.sceneFrame.scannerDiagnostics.compatibilityMode, `${presetId}:${frameId}`).not.toBe('legacy-only')
        expect(first.sceneFrame.scannerDiagnostics.pathValidationErrorCount, `${presetId}:${frameId}`).toBe(0)
        expect(first.sceneFrame.scanPaths.length, `${presetId}:${frameId}`).toBeGreaterThan(0)
        expect(first.sceneFrame.exposureSamples.length, `${presetId}:${frameId}`).toBeGreaterThan(0)
        expect(JSON.stringify(first.sceneFrame.scanPaths), `${presetId}:${frameId}:determinism`).toBe(JSON.stringify(second.sceneFrame.scanPaths))
        signatures.push(first.sceneFrame.scanPaths.map((path, index) => `${path.fixtureId}:${path.scanDirection}:${path.durationBeats}:${path.points.length}:${first.sceneFrame.scannerHeads[index]?.scanRatePps}`).join('|'))
      }
      expect(signatures.length, `${presetId}:validated song states`).toBe(REQUIRED_FRAME_IDS.length)
    }
  })
})
