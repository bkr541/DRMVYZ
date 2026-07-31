import type { ReactSectionType } from '../ReactTypes'
import type { PixGridAudioFrame, PixGridState } from './PixGridTypes'

const SCENE_SUFFIXES: ReadonlyArray<readonly [string, ReactSectionType]> = [
  ['preDrop', 'preDrop'],
  ['breakdown', 'breakdown'],
  ['intro', 'intro'],
  ['verse', 'verse'],
  ['build', 'build'],
  ['drop', 'drop'],
  ['outro', 'outro'],
]

export const PIX_GRID_FOLLOW_TRACK_SCENE_VALUE = 'followTrack' as const

export function selectPixGridPreviewScene(state: PixGridState, value: string): PixGridState {
  if (value === PIX_GRID_FOLLOW_TRACK_SCENE_VALUE) {
    return { ...state, editor: { ...state.editor, scenePreviewMode: 'followTrack' } }
  }
  if (!state.scenes.some(scene => scene.id === value)) return state
  return {
    ...state,
    selectedSceneId: value,
    editor: { ...state.editor, scenePreviewMode: 'selectedScene' },
  }
}

export function selectPixGridEditingTarget(state: PixGridState, targetId: string | null): PixGridState {
  const selectedLayerId = targetId && state.layers.some(layer => layer.id === targetId) ? targetId : null
  return { ...state, editor: { ...state.editor, selectedLayerId } }
}

export function resolvePixGridPreviewState(
  state: PixGridState,
  trackSceneId: string | null,
): PixGridState {
  if (state.editor.scenePreviewMode === 'selectedScene') return state
  if (!trackSceneId || !state.scenes.some(scene => scene.id === trackSceneId)) return state
  return trackSceneId === state.selectedSceneId ? state : { ...state, selectedSceneId: trackSceneId }
}

export function resolvePixGridSceneSectionType(state: PixGridState): ReactSectionType | null {
  const scene = state.scenes.find(candidate => candidate.id === state.selectedSceneId)
  if (!scene) return null
  const candidates = [scene.id, scene.name].map(value => value.toLowerCase().replace(/[\s_-]+/g, ''))
  for (const [suffix, sectionType] of SCENE_SUFFIXES) {
    const normalized = suffix.toLowerCase()
    if (candidates.some(value => value.endsWith(normalized) || value.includes(normalized))) return sectionType
  }
  return null
}

/**
 * Manual scene preview keeps the transport's beat clock but gives the selected
 * scene a deterministic four-bar local timeline. This allows authored motion
 * to remain visible without permitting track analysis to reclaim scene ownership.
 */
export function applyPixGridSelectedScenePreviewFrame(
  frame: PixGridAudioFrame,
  state: PixGridState,
): PixGridAudioFrame {
  if (state.editor.scenePreviewMode !== 'selectedScene') return frame
  const sectionType = resolvePixGridSceneSectionType(state)
  if (!sectionType) return frame
  const absoluteBar = frame.motionClockBar ?? ((frame.barIndex ?? 0) + (((frame.beatIndex ?? 0) % 4) + frame.beatPhase) / 4)
  const sectionBar = ((absoluteBar % 4) + 4) % 4
  const sectionProgress = sectionBar / 4
  return {
    ...frame,
    sectionType,
    motionClockSectionType: sectionType,
    sectionProgress,
    motionClockSectionProgress: sectionProgress,
    barsSinceSectionStart: sectionBar,
    beatsSinceSectionStart: sectionBar * 4,
    sectionPhase: sectionProgress < 0.125 ? 'entry' : sectionProgress > 0.875 ? 'exit' : 'body',
    inputSource: 'editor-preview',
    sourceValues: { ...frame.sourceValues, sectionProgress },
    unscaledSourceValues: { ...frame.unscaledSourceValues, sectionProgress },
  }
}
