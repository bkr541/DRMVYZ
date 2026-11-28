// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BetaTermsDialog } from './BetaTermsDialog'
import { MIN_PASSWORD_LENGTH, signUpErrorMessage } from './AuthPage'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
afterEach(() => { if (root) act(() => root?.unmount()); container?.remove(); container = root = null })

describe('beta sign-up (AUTH-01, AUTH-04, PRIV-01)', () => {
  it('opens a readable Terms & Privacy notice that covers what the app does with data, and closes with the button or Escape', () => {
    const onClose = vi.fn()
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
    act(() => root?.render(<BetaTermsDialog onClose={onClose} />))
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    for (const topic of ['What you upload', 'Camera and microphone', 'Lyric transcription', 'Diagnostics and issue reports']) expect(dialog.textContent).toContain(topic)
    expect(document.activeElement?.textContent).toBe('Close')
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    act(() => (document.activeElement as HTMLButtonElement).click())
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('explains a refused, uninvited sign-up and leaves other errors as they are', () => {
    expect(signUpErrorMessage('Database error saving new user')).toMatch(/has not been invited to the beta/)
    expect(signUpErrorMessage('User already registered')).toBe('User already registered')
  })

  it('asks for passwords of at least 10 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10)
  })
})
