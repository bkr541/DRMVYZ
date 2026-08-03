import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getHelpEntry } from '../../../help/HelpCenter'
import { InfoPopover } from './InfoPopover'

const infoPopoverDir = dirname(fileURLToPath(import.meta.url))
const srcDir = join(infoPopoverDir, '..', '..', '..')

const approvedExplicitHelpPlacements = new Map<string, readonly string[]>([
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'ReactView.tsx'),
    [
      'react.shared.header.audioInput',
      'react.shared.trackMap.overview',
      'react.shared.performancePads.overview',
      'react.shared.lowerWorkspace.outputActions',
      'react.soundDrawing.workspace.tabs',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'ReactGlobalOutputControls.tsx'),
    [
      'react.shared.header.productionOutput',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'ReactEnginePanel.tsx'),
    [
      'react.soundDrawing.authoredPerformance.autoPerformance',
      'react.soundDrawing.authoredPerformance.performanceShow',
      'react.soundDrawing.engineMode.overview',
      'react.soundDrawing.engineMode.visualSize',
      'react.soundDrawing.engineMode.followTrackSections',
      'react.soundDrawing.engineMode.classicMode',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'ReactPresetsPanel.tsx'),
    [
      'react.soundDrawing.presetLibrary',
      'react.laserDmx.presetLibrary',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'ReactModulationPanel.tsx'),
    [
      'react.soundDrawing.audioReactivity.displaceMode',
      'react.soundDrawing.audioReactivity.displacement',
      'react.soundDrawing.audioReactivity.bassScale',
      'react.soundDrawing.audioReactivity.midTwist',
      'react.soundDrawing.audioReactivity.alternate',
      'react.soundDrawing.audioReactivity.highJitter',
      'react.soundDrawing.audioReactivity.beatBloom',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'LaserDmxEnginePanel.tsx'),
    [
      'react.laserDmx.workspace.overview',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'LaserDmxBeamMatrixPanel.tsx'),
    [
      'react.laserDmx.beamMatrix.programAndCanvas.program.overview',
      'react.laserDmx.beamMatrix.programAndCanvas.design.overview',
      'react.laserDmx.beamMatrix.programAndCanvas.canvas.showBeamEditor',
      'react.laserDmx.beamMatrix.programAndCanvas.canvas.snapToGrid',
      'react.laserDmx.beamMatrix.programAndCanvas.canvas.showGrid',
      'react.laserDmx.beamMatrix.programAndCanvas.canvas.showBeamPaths',
      'react.laserDmx.beamMatrix.programAndCanvas.canvas.overscan',
      'react.laserDmx.beamMatrix.programAndCanvas.reactionGroups.overview',
      'react.laserDmx.beamMatrix.programAndCanvas.cueList.overview',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'ReactFxPanel.tsx'),
    [
      'react.laserDmx.design.previewOutputTrim',
      'react.laserDmx.design.previewGlowTrim',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'LaserDmxShowDirectorControls.tsx'),
    [
      'react.laserDmx.showDirector.performanceProgram.enabled',
      'react.laserDmx.showDirector.performanceProgram.programIntensity',
      'react.laserDmx.showDirector.performanceProgram.variationAmount',
      'react.laserDmx.showDirector.performanceProgram.audioIntelligenceResponse',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'react', 'ReactTrackMapStrip.tsx'),
    [
      'react.shared.trackMap.beatGridLane',
      'react.shared.trackMap.sectionsLane',
      'react.shared.trackMap.cuesLane',
    ],
  ],
  [
    join(srcDir, 'components', 'vyzualz', 'shared', 'VyzualzAudioDock.tsx'),
    [
      'visualizer.audioDeck.trackPlayer',
      'visualizer.audioDeck.waveform',
      'visualizer.audioDeck.tempoAndSync',
    ],
  ],
])

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry: Dirent) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return productionTsxFiles(path)
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) return []
    if (entry.name.includes('.test.') || entry.name.includes('.spec.')) return []
    if (path === join(infoPopoverDir, 'HelpInfoTrigger.tsx')) return []
    return [path]
  })
}

describe('contextual help clean reset', () => {
  it('removes the automatic discovery layer from the production architecture', () => {
    expect(existsSync(join(infoPopoverDir, 'PriorityOneHelpLayer.tsx'))).toBe(false)

    const viewSource = readFileSync(join(srcDir, 'components', 'vyzualz', 'VyzualzView.tsx'), 'utf8')
    expect(viewSource).not.toContain('PriorityOneHelpLayer')
    expect(viewSource).not.toContain('drm-priority-help-slot')
  })

  it('limits production help triggers to the explicitly approved first rollout', () => {
    for (const file of productionTsxFiles(srcDir)) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toContain('<HelpLabel')
      expect(source, file).not.toContain('drm-help-info-trigger')
      expect(source, file).not.toContain('<PriorityOneHelpLayer')

      const approvedHelpIds = approvedExplicitHelpPlacements.get(file)
      if (!approvedHelpIds) {
        expect(source, file).not.toContain('HelpInfoTrigger')
        expect(source, file).not.toMatch(/\bhelpId\s*=/)
        continue
      }

      expect(source, file).toContain('HelpInfoTrigger')
      for (const helpId of approvedHelpIds) {
        expect(source, file).toContain(helpId)
      }
    }

    for (const approvedFile of approvedExplicitHelpPlacements.keys()) {
      expect(existsSync(approvedFile), approvedFile).toBe(true)
    }
  })

  it('preserves the registry and reusable modal component', () => {
    expect(getHelpEntry('react.soundDrawing.authoredPerformance.autoPerformance')?.title).toBe('Auto Performance')
    expect(typeof InfoPopover).toBe('function')
  })
})
