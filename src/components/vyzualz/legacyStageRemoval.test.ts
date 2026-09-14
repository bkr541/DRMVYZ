import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = join(process.cwd(), 'src')
const REMOVED_LEGACY_STAGE_MODULES = [
  'components/vyzualz/stage/LiveVisualCanvas.tsx',
  'components/vyzualz/stage/LiveVisualPreview.tsx',
  'components/vyzualz/stage/OutputFrame.tsx',
  'components/vyzualz/stage/PreviewOverlay.tsx',
  'components/vyzualz/stage/RenderSourceBadge.tsx',
  'components/vyzualz/stage/mediaPool.ts',
  'components/vyzualz/layout/OutputHealthIndicator.tsx',
  'types/performanceStats.ts',
] as const

const REMOVED_MODULE_NAMES = [
  'LiveVisualCanvas',
  'LiveVisualPreview',
  'OutputFrame',
  'PreviewOverlay',
  'RenderSourceBadge',
  'mediaPool',
  'OutputHealthIndicator',
  'performanceStats',
] as const

function collectProductionSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (entry === '__tests__') continue
      collectProductionSourceFiles(fullPath, files)
      continue
    }
    if (!/\.tsx?$/.test(fullPath)) continue
    if (/\.(?:test|spec)\.tsx?$/.test(fullPath)) continue
    files.push(fullPath)
  }
  return files
}

describe('legacy Visualizer stage retirement', () => {
  it('removes the verified Visualizer-only stage and preview modules', () => {
    for (const modulePath of REMOVED_LEGACY_STAGE_MODULES) {
      expect(existsSync(join(SRC_ROOT, modulePath)), modulePath).toBe(false)
    }
    expect(existsSync(join(SRC_ROOT, 'components/vyzualz/stage'))).toBe(false)
  })

  it('leaves no production import of a removed legacy stage module', () => {
    const residues: string[] = []
    for (const filePath of collectProductionSourceFiles(SRC_ROOT)) {
      const text = readFileSync(filePath, 'utf8')
      for (const moduleName of REMOVED_MODULE_NAMES) {
        const importPattern = new RegExp(
          `(?:from\\s+['\"][^'\"]*${moduleName}(?:\\.[^'\"]*)?['\"]|import\\(['\"][^'\"]*${moduleName}(?:\\.[^'\"]*)?['\"]\\))`,
        )
        if (importPattern.test(text)) residues.push(`${relative(process.cwd(), filePath)} -> ${moduleName}`)
      }
    }
    expect(residues).toEqual([])
  })

  it('keeps the current production router on modern workspaces only', () => {
    const router = readFileSync(join(SRC_ROOT, 'components/vyzualz/VyzualzView.tsx'), 'utf8')
    expect(router).toContain("import('./react/ReactView')")
    expect(router).toContain("import('./showManager/ShowManagerView')")
    expect(router).toContain("import('../../features/media/MediaManagerView')")
    expect(router).toContain("import('../../features/lyrics/LyricManagerView')")
    expect(router).not.toMatch(/import\([^)]*\/stage\//)
  })

  it('keeps active React, Cinema 2.0, Canvas, and output surfaces reachable', () => {
    const reactView = readFileSync(join(SRC_ROOT, 'components/vyzualz/react/ReactView.tsx'), 'utf8')
    expect(reactView).toContain('<Cinema2Stage')
    expect(reactView).toContain('<CanvasEngineSurface')
    expect(reactView).toContain('<ReactPlaceholderCanvas')
    expect(reactView).toContain('<OutputCastControl')

    const showManager = readFileSync(join(SRC_ROOT, 'components/vyzualz/showManager/ShowManagerView.tsx'), 'utf8')
    expect(showManager).toContain('<CanvasShowManagerStage')
    expect(showManager).toContain('<CanvasEngineSurface')
    expect(showManager).toContain('<ReactPlaceholderCanvas')
  })
})
