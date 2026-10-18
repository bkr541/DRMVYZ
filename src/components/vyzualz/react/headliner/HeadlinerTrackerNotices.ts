import { notify } from '../../../../stores/notificationStore'

export type HeadlinerTrackerKind = 'face' | 'body' | 'person'

const TRACKER_LABELS: Record<HeadlinerTrackerKind, { name: string; affects: string }> = {
  face: { name: 'Face tracking', affects: 'Face-reactive effects' },
  body: { name: 'Body tracking', affects: 'Skeleton and pose-reactive effects' },
  person: { name: 'Person cut-out', affects: 'Silhouette, isolation and fill effects' },
}

function reason(error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return text.trim()
}

/**
 * Tells the user a Headliner tracking model did not load or stopped working. The trackers degrade silently on their
 * own (effects fall back to whole-frame behaviour), so without a card a preset just looks broken.
 */
export function reportHeadlinerTrackerFailure(kind: HeadlinerTrackerKind, stage: 'start' | 'detect', error: unknown): void {
  const { name, affects } = TRACKER_LABELS[kind]
  const detail = reason(error)
  notify('react', {
    tone: 'warning',
    title: stage === 'start' ? `${name} unavailable` : `${name} stopped`,
    message: `${stage === 'start' ? `${name} could not start.` : `${name} hit an error while running.`} ${affects} will fall back to a simpler look.${detail ? ` (${detail})` : ''}`,
  })
}
