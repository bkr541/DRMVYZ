import type { MediaDeletionGuard, MediaDeletionGuardResult } from './mediaStore'

type AllowedMediaDeletionGuardResult = Extract<MediaDeletionGuardResult, { allowed: true }>

/**
 * Evaluates every deletion guard before any mutation is applied, then composes
 * their transactional hooks so independent subsystems can clean references in
 * one media deletion without silently dropping an earlier guard's work.
 */
export function composeMediaDeletionGuards(...guards: MediaDeletionGuard[]): MediaDeletionGuard {
  return (item, confirmation) => {
    const results: AllowedMediaDeletionGuardResult[] = []
    for (const guard of guards) {
      const result = guard(item, confirmation)
      if (!result.allowed) return result
      results.push(result)
    }

    const applied: AllowedMediaDeletionGuardResult[] = []
    return {
      allowed: true,
      apply: () => {
        for (const result of results) {
          if (result.apply && !result.apply()) {
            for (const prior of [...applied].reverse()) prior.rollback?.()
            applied.length = 0
            return false
          }
          applied.push(result)
        }
        return true
      },
      commit: () => {
        for (const result of applied) result.commit?.()
        applied.length = 0
      },
      rollback: () => {
        for (const result of [...applied].reverse()) result.rollback?.()
        applied.length = 0
      },
    }
  }
}
