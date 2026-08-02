import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getHelpEntry } from '../../../help/HelpCenter'
import { InfoPopover } from './InfoPopover'

const infoPopoverDir = dirname(fileURLToPath(import.meta.url))
const srcDir = join(infoPopoverDir, '..', '..', '..')

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

  it('has no production TSX render path for a help trigger during the reset stage', () => {
    for (const file of productionTsxFiles(srcDir)) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toContain('HelpInfoTrigger')
      expect(source, file).not.toContain('<HelpLabel')
      expect(source, file).not.toContain('drm-help-info-trigger')
      expect(source, file).not.toMatch(/\bhelpId\s*=/)
      expect(source, file).not.toContain('<PriorityOneHelpLayer')
    }
  })

  it('preserves the registry and reusable modal component', () => {
    expect(getHelpEntry('react.soundDrawing.authoredPerformance.autoPerformance')?.title).toBe('Auto Performance')
    expect(typeof InfoPopover).toBe('function')
  })
})
