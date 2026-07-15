export type LyricManagerWorkflow = 'timeline' | 'active-lyrics' | 'ai-extract'

export interface LyricManagerNavigationIntent {
  id: string
  targetAudioTrackId: string
  workflow: LyricManagerWorkflow
}

export function createLyricManagerNavigationIntent(
  targetAudioTrackId: string,
  workflow: LyricManagerWorkflow,
): LyricManagerNavigationIntent {
  return {
    id: `${targetAudioTrackId}:${workflow}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    targetAudioTrackId,
    workflow,
  }
}
