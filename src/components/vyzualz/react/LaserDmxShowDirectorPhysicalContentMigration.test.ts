import { describe, expect, it } from 'vitest'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from './LaserDmxShowDirectorPerformancePresets'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES, createLaserDmxShowDirectorTemplateState } from './laserDmxShowDirectorTemplates'
import {
  auditLaserDmxBuiltInPhysicalContent,
} from './LaserDmxShowDirectorPhysicalContentMigration'
import { validateLaserShowProgrammingDocument } from './LaserDmxShowDirectorProgramming'
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

  it('uses native macros as first-party authority while retaining the physical rig migration', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS) {
      const program = preset.createProgram()
      expect(program.diagnostics?.authoringVersion, preset.id).toBe('professional-cue-authoring-v1')
      expect(program.laserProgramming?.compatibility.source, preset.id).toBe('native')
      expect(validateLaserShowProgrammingDocument(program.laserProgramming!), preset.id).toEqual([])
      expect(program.laserProgramming?.macros.some(macro => macro.compatibility?.provisional), preset.id).toBe(false)
      for (const scene of program.scenes) {
        const payloads = [
          scene,
          ...(scene.variations ?? []),
          ...(scene.beatMutations ?? []),
          ...(scene.kickMutations ?? []),
          ...(scene.snareMutations ?? []),
          ...(scene.hatMutations ?? []),
          ...(scene.transientMutations ?? []),
          ...(scene.barMutations ?? []),
          ...(scene.barProgression ?? []),
          ...(scene.fourBarVariations ?? []),
          ...(scene.eightBarRecruitment ?? []),
          ...(scene.sixteenBarEvolution ?? []),
          ...(scene.sectionEntryMutations ?? []),
          ...(scene.sectionBodyMutations ?? []),
          ...(scene.sectionExitMutations ?? []),
        ]
        for (const payload of payloads) {
          expect(payload.fixture?.scanner, `${preset.id}:${scene.id}:legacy scanner override`).toBeUndefined()
          expect(payload.fixture?.targetPoints, `${preset.id}:${scene.id}:legacy target topology`).toBeUndefined()
          expect(payload.fixtureActions?.some(action => action.kind === 'scanner' || action.kind === 'beam'), `${preset.id}:${scene.id}:legacy scanner action`).not.toBe(true)
        }
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
