// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { ReactResetActionsControls } from '../ReactResetActions'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(
    candidate => candidate.textContent?.trim() === label,
  )
  if (!match) throw new Error(`Button not found: ${label}`)
  return match as HTMLButtonElement
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('ReactResetActionsControls', () => {
  it('cannot clear authored content until the explicit confirmation button is clicked', async () => {
    const clearProject = vi.fn()
    await act(async () => {
      root.render(
        <ReactResetActionsControls
          onResetCurrentEngineSettings={vi.fn()}
          onResetReactViewPreferences={vi.fn()}
          onClearReactProjectContent={clearProject}
        />,
      )
    })

    await act(async () => button('Clear Authored Automation & Project Content…').click())
    expect(clearProject).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull()

    await act(async () => button('Cancel').click())
    expect(clearProject).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alertdialog"]')).toBeNull()

    await act(async () => button('Clear Authored Automation & Project Content…').click())
    expect(clearProject).not.toHaveBeenCalled()
    await act(async () => button('Confirm Clear Project Content').click())
    expect(clearProject).toHaveBeenCalledTimes(1)
  })
})
