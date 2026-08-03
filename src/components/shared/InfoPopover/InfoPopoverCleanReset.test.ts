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
      'react.shared.trackMap.overview',
      'react.shared.performancePads.overview',
      'react.shared.lowerWorkspace.outputActions',
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
