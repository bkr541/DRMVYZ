// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useContextualHelpStore } from '../../../features/contextualHelp/contextualHelpStore'
import { HelpInfoTrigger } from './HelpInfoTrigger'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function renderTrigger() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<HelpInfoTrigger helpId="visualizer.audioDeck.trackPlayer" currentValue="No track loaded" />)
  })
}

beforeEach(() => {
  useContextualHelpStore.setState({
    infoEnabled: true,
    currentUserId: null,
    loading: false,
    syncing: false,
    error: null,
    source: 'default',
  })
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  document.body.innerHTML = ''
  container = null
  root = null
})

describe('HelpInfoTrigger', () => {
  it('removes the hover info trigger when the user preference is disabled', () => {
    renderTrigger()
    expect(document.body.querySelector('.drm-help-info-trigger')).not.toBeNull()

    act(() => useContextualHelpStore.setState({ infoEnabled: false }))

    expect(document.body.querySelector('.drm-help-info-trigger')).toBeNull()
    expect(document.body.querySelector('.drm-info-popover')).toBeNull()
  })

  it('uses the learn icon in the restyled popover header', () => {
    renderTrigger()
    const trigger = document.body.querySelector('.drm-help-info-trigger') as HTMLButtonElement
    act(() => trigger.click())

    expect(document.body.querySelector('.drm-info-popover__header-icon img')).not.toBeNull()
    expect(document.body.querySelector('.drm-info-popover')?.textContent).toContain('Track Player')
  })
})
