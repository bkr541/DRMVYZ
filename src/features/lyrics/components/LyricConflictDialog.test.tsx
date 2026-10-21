// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LyricConflictDialog } from './LyricConflictDialog'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const render = (props: Partial<React.ComponentProps<typeof LyricConflictDialog>> = {}) => {
  const onReloadLatest = vi.fn()
  const onSaveAsNewVersion = vi.fn()
  act(() => root.render(
    <LyricConflictDialog
      open
      documentTitle="Reverie"
      serverRevision={5}
      yourRevision={1}
      onReloadLatest={onReloadLatest}
      onSaveAsNewVersion={onSaveAsNewVersion}
      {...props}
    />,
  ))
  return { onReloadLatest, onSaveAsNewVersion }
}
const buttons = () => [...container.querySelectorAll<HTMLButtonElement>('.dv-confirm-actions button')]

describe('LyricConflictDialog', () => {
  it('renders nothing while there is no conflict', () => {
    render({ open: false })
    expect(container.querySelector('.dv-confirm-dialog')).toBeNull()
  })

  it('offers exactly Reload Latest and Save as New Version, in the informational (not destructive) style', () => {
    const { onReloadLatest, onSaveAsNewVersion } = render()
    expect(container.textContent).toContain('Reverie')
    expect(container.textContent).toContain('revision 5')
    expect(buttons().map(button => button.textContent)).toEqual(['Reload Latest', 'Save as New Version'])
    expect(container.querySelector('.dv-confirm-icon--neutral')).not.toBeNull()
    expect(container.querySelector('.dv-icon-chip--danger')).toBeNull()

    act(() => buttons()[0]!.click())
    expect(onReloadLatest).toHaveBeenCalledTimes(1)
    act(() => buttons()[1]!.click())
    expect(onSaveAsNewVersion).toHaveBeenCalledTimes(1)
  })

  it('cannot be dismissed by Escape or the backdrop, because a choice is required', () => {
    const { onReloadLatest, onSaveAsNewVersion } = render()
    act(() => { container.querySelector('.dv-confirm-dialog')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    act(() => { container.querySelector('.dv-confirm-backdrop')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(onReloadLatest).not.toHaveBeenCalled()
    expect(onSaveAsNewVersion).not.toHaveBeenCalled()
  })

  it('disables both choices while one is running', () => {
    render({ busy: 'copy' })
    expect(buttons().every(button => button.disabled)).toBe(true)
  })
})
