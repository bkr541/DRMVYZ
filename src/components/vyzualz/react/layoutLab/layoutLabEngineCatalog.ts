import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../reactEngineCatalog'
import type { ReactEngineId } from '../ReactTypes'

export type LayoutLabEngineId = ReactEngineId | 'template' | 'lyricManager'

export interface LayoutLabEngineCatalogEntry {
  id: LayoutLabEngineId
  label: string
  shortLabel: string
  icon: string
  description: string
}

export const LAYOUT_LAB_ENGINE_IDS: LayoutLabEngineId[] = [
  ...REACT_ENGINE_IDS,
  'template',
  'lyricManager',
]

export const LAYOUT_LAB_ENGINE_CATALOG: Record<LayoutLabEngineId, LayoutLabEngineCatalogEntry> = {
  ...REACT_ENGINE_CATALOG,
  template: {
    id: 'template',
    label: 'Template',
    shortLabel: 'Template',
    icon: '▤',
    description: 'Blank Layout Lab workspace for future template authoring.',
  },
  lyricManager: {
    id: 'lyricManager',
    label: 'Lyric Manager',
    shortLabel: 'Lyrics',
    icon: '♪',
    description: 'Concept exploration for Lyric Manager’s track timeline and lyric cue rows.',
  },
}
