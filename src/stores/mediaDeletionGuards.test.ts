import { describe, expect, it, vi } from 'vitest'
import type { MediaDeletionGuard } from './mediaStore'
import { composeMediaDeletionGuards } from './mediaDeletionGuards'

describe('composed media deletion guards', () => {
  it('preserves every allowed transactional hook and commits in order', () => {
    const events: string[] = []
    const first: MediaDeletionGuard = () => ({
      allowed: true,
      apply: () => { events.push('apply:first'); return true },
      commit: () => events.push('commit:first'),
      rollback: () => events.push('rollback:first'),
    })
    const second: MediaDeletionGuard = () => ({
      allowed: true,
      apply: () => { events.push('apply:second'); return true },
      commit: () => events.push('commit:second'),
      rollback: () => events.push('rollback:second'),
    })

    const result = composeMediaDeletionGuards(first, second)({ id: 'media-a' } as Parameters<MediaDeletionGuard>[0])
    expect(result.allowed).toBe(true)
    if (!result.allowed) throw new Error(result.warning.message)
    expect(result.apply?.()).toBe(true)
    result.commit?.()
    expect(events).toEqual(['apply:first', 'apply:second', 'commit:first', 'commit:second'])
  })

  it('does not apply earlier guards when a later guard refuses deletion', () => {
    const apply = vi.fn(() => true)
    const first: MediaDeletionGuard = () => ({ allowed: true, apply })
    const blocked: MediaDeletionGuard = item => ({
      allowed: false,
      warning: {
        itemId: item.id,
        affectedDecks: [],
        action: 'confirm-reference-removal',
        message: 'blocked',
        confirmationCopy: 'blocked',
      },
    })

    const result = composeMediaDeletionGuards(first, blocked)({ id: 'media-a' } as Parameters<MediaDeletionGuard>[0])
    expect(result.allowed).toBe(false)
    expect(apply).not.toHaveBeenCalled()
  })

  it('rolls back already-applied guards in reverse order when a later apply fails', () => {
    const events: string[] = []
    const first: MediaDeletionGuard = () => ({
      allowed: true,
      apply: () => { events.push('apply:first'); return true },
      rollback: () => events.push('rollback:first'),
    })
    const second: MediaDeletionGuard = () => ({
      allowed: true,
      apply: () => { events.push('apply:second'); return false },
      rollback: () => events.push('rollback:second'),
    })

    const result = composeMediaDeletionGuards(first, second)({ id: 'media-a' } as Parameters<MediaDeletionGuard>[0])
    expect(result.allowed).toBe(true)
    if (!result.allowed) throw new Error(result.warning.message)
    expect(result.apply?.()).toBe(false)
    expect(events).toEqual(['apply:first', 'apply:second', 'rollback:first'])
  })
})
