// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeOutputBridge, OutputCastRequest, OutputTarget } from '../../../../native/outputBridge'
import { OutputCastControl } from './OutputCastControl'

const targets: OutputTarget[] = [
  {
    id: 'display:2',
    kind: 'display',
    name: 'Stage Screen',
    detail: '1920 × 1080',
    available: true,
  },
  {
    id: 'receiver:lan-stage',
    kind: 'network',
    name: 'Booth Mac · DRMVYZ',
    detail: 'DRMVYZ Receiver · 192.168.1.20',
    available: true,
  },
]

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let startCast: ReturnType<typeof vi.fn>

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

beforeEach(async () => {
  startCast = vi.fn(async (request: OutputCastRequest) => ({
    id: 'session-1',
    targetId: request.targetId,
    targetName: 'Stage Screen',
    windowMode: request.windowMode,
    aspectRatio: request.aspectRatio,
    state: 'connecting' as const,
    error: null,
  }))
  const bridge: NativeOutputBridge = {
    listTargets: vi.fn(async () => targets),
    getSession: vi.fn(async () => null),
    startCast,
    stopCast: vi.fn(async () => null),
    publishOffer: vi.fn(async () => true),
    waitForAnswer: vi.fn(async () => ({ type: 'answer', sdp: 'answer' })),
    failSession: vi.fn(async () => true),
    onTargetsChanged: vi.fn(() => () => {}),
    onSessionChanged: vi.fn(() => () => {}),
    onReceiverRequested: vi.fn(() => () => {}),
  }
  window.drmvyzNative = {
    runtime: { isElectron: true, platform: 'darwin' },
    output: bridge,
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  await act(async () => root.render(<OutputCastControl canvas={canvas} />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.querySelector('.rv-cast-overlay')?.remove()
  delete window.drmvyzNative
  vi.restoreAllMocks()
})

describe('OutputCastControl', () => {
  it('places casting behind the visualizer icon and requires window and aspect selections', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    expect(trigger).not.toBeNull()
    await act(async () => trigger?.click())

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Cast Output')
    const device = buttonWithText('Stage Screen')
    expect(device.disabled).toBe(true)

    await act(async () => buttonWithText('Full Screen').click())
    expect(device.disabled).toBe(true)
    await act(async () => buttonWithText('16:9').click())
    expect(device.disabled).toBe(false)

    await act(async () => device.click())
    expect(startCast).toHaveBeenCalledWith({
      targetId: 'display:2',
      windowMode: 'fullscreen',
      aspectRatio: '16:9',
    })
  })

  it('shows discovered network receivers in the same chooser', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    expect(document.body.textContent).toContain('Booth Mac · DRMVYZ')
    expect(document.body.textContent).toContain('Network Receivers')
  })
})
