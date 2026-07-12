import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const auditedFiles = [
  '../components/vyzualz/media/MediaLibraryBrowser.tsx',
  '../components/vyzualz/MediaUploadModal.tsx',
  '../components/vyzualz/media/MediaStatusBar.tsx',
  '../components/vyzualz/media/MediaPreviewModal.tsx',
  '../components/vyzualz/VisualizerWorkspace.tsx',
  '../components/vyzualz/hooks/useMediaNavigation.ts',
  '../components/vyzualz/layers/VzLayersPanel.tsx',
  '../components/vyzualz/SettingsModal.tsx',
  '../components/vyzualz/settings/SettingsModal.tsx',
]

describe('media store subscription audit', () => {
  it.each(auditedFiles)('%s does not subscribe to the whole media store', file => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    expect(source).not.toMatch(/useMediaStore\s*\(\s*\)/)
    expect(source).not.toMatch(/useMediaStore\s*\(\s*(?:state|s)\s*=>\s*(?:state|s)\s*\)/)
  })
})
