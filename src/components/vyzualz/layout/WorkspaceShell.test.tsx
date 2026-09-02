// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceShell } from './WorkspaceShell'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function render(node: React.ReactElement) {
  return act(async () => root.render(node))
}

describe('WorkspaceShell', () => {
  it('composes the shared vz-content grid with a left rail, center stage, and right rail', async () => {
    await render(
      <WorkspaceShell
        header={<span data-testid="hdr">Header</span>}
        left={<div data-testid="l">L</div>}
        center={<div data-testid="c">C</div>}
        right={<div data-testid="r">R</div>}
        leftLabel="Library"
        rightLabel="Details"
      />,
    )

    const shell = container.querySelector('.ws-shell')!
    expect(shell.querySelector('.ws-shell-header [data-testid="hdr"]')).not.toBeNull()

    const body = shell.querySelector('.ws-shell-body.vz-content')!
    expect(body.getAttribute('data-left-collapsed')).toBe('false')
    expect(body.getAttribute('data-right-collapsed')).toBe('false')

    const rails = body.querySelectorAll(':scope > .vz-inspector')
    expect(rails).toHaveLength(2)
    expect(rails[0].getAttribute('aria-label')).toBe('Library')
    expect(rails[1].getAttribute('aria-label')).toBe('Details')

    expect(rails[0].querySelector('.vz-inspector-inner [data-testid="l"]')).not.toBeNull()
    expect(rails[1].querySelector('.vz-inspector-inner [data-testid="r"]')).not.toBeNull()
    expect(body.querySelector(':scope > .ws-shell-stage [data-testid="c"]')).not.toBeNull()
  })

  it('omits the header element entirely when no header is passed', async () => {
    await render(<WorkspaceShell left={null} center={null} right={null} />)
    expect(container.querySelector('.ws-shell-header')).toBeNull()
    expect(container.querySelector('.ws-shell > .ws-shell-body')).not.toBeNull()
  })

  it('self-manages rail collapse from the toggle buttons and honours the defaults', async () => {
    await render(
      <WorkspaceShell left={null} center={null} right={null} defaultRightCollapsed />,
    )
    const body = container.querySelector('.ws-shell-body')!
    expect(body.getAttribute('data-left-collapsed')).toBe('false')
    expect(body.getAttribute('data-right-collapsed')).toBe('true')

    const leftToggle = container.querySelector<HTMLButtonElement>('.vz-inspector--left .vz-inspector-toggle')!
    await act(async () => leftToggle.click())
    expect(body.getAttribute('data-left-collapsed')).toBe('true')
    await act(async () => leftToggle.click())
    expect(body.getAttribute('data-left-collapsed')).toBe('false')
  })
})
