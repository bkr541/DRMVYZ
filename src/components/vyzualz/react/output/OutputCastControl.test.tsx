// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeOutputBridge, OutputCastRequest, OutputCastSession, OutputTarget } from '../../../../native/outputBridge'
import { CANVAS_FRACTURES_OUTPUT_DEFERRED } from '../canvasFracturesOutputContract'
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
let stopCast: ReturnType<typeof vi.fn>
let performProviderAction: ReturnType<typeof vi.fn>
let bridge: NativeOutputBridge
let canvas: HTMLCanvasElement

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
  stopCast = vi.fn(async () => null)
  performProviderAction = vi.fn(async (providerId: string, actionId: string) => ({
    providerId,
    actionId,
    state: 'opened',
    message: 'macOS display controls opened.',
  }))
  bridge = {
    listTargets: vi.fn(async () => targets),
    getTargetSnapshot: vi.fn(async () => ({
      targets,
      providers: [
        { providerId: 'local-display', label: 'Connected displays', state: 'available', targetCount: 1, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
        { providerId: 'airplay', label: 'AirPlay / Wireless Displays', state: 'available', targetCount: 0, message: null, capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'miracast', label: 'Windows Wireless Displays', state: 'unsupported', targetCount: 0, message: 'Windows only.', capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'drmvyz-receiver', label: 'DRMVYZ Receivers', state: 'available', targetCount: 1, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
      ],
    })),
    getSession: vi.fn(async () => null),
    performProviderAction,
    startCast,
    stopCast,
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
  canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  await act(async () => root.render(<OutputCastControl canvas={canvas} />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  document.querySelector('.rv-cast-popover')?.remove()
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
    expect(dialog?.classList.contains('rv-cast-popover')).toBe(true)
    expect(dialog?.getAttribute('aria-modal')).toBeNull()
    expect(document.body.querySelector('.rv-cast-overlay')).toBeNull()
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
    expect(document.body.textContent).toContain('DRMVYZ Receivers')
  })


  it('exposes macOS wireless-display selection as a provider action without starting a cast session', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())

    expect(document.body.textContent).toContain('AirPlay / Wireless Displays')
    await act(async () => buttonWithText('Open macOS Displays').click())

    expect(performProviderAction).toHaveBeenCalledWith('airplay', 'open-system-picker')
    expect(startCast).not.toHaveBeenCalled()
  })


  it('exposes Windows wireless-display selection through the same provider-action contract', async () => {
    bridge.getTargetSnapshot = vi.fn(async () => ({
      targets,
      providers: [
        { providerId: 'local-display', label: 'Connected displays', state: 'available', targetCount: 1, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
        { providerId: 'airplay', label: 'AirPlay / Wireless Displays', state: 'unsupported', targetCount: 0, message: 'macOS only.', capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'miracast', label: 'Windows Wireless Displays', state: 'available', targetCount: 0, message: null, capabilities: { targetEnumeration: false, sessions: false, picker: true, actions: ['open-system-picker'] } },
        { providerId: 'drmvyz-receiver', label: 'DRMVYZ Receivers', state: 'available', targetCount: 1, message: null, capabilities: { targetEnumeration: true, sessions: true, picker: false, actions: [] } },
      ],
    }))

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())

    expect(document.body.textContent).toContain('Windows Wireless Displays')
    await act(async () => buttonWithText('Open Windows Displays').click())

    expect(performProviderAction).toHaveBeenCalledWith('miracast', 'open-system-picker')
    expect(startCast).not.toHaveBeenCalled()
  })


  it('rejects a cast that finishes starting after output becomes deferred', async () => {
    let resolveStartCast: ((session: OutputCastSession) => void) | null = null
    startCast.mockImplementation((request: OutputCastRequest) => new Promise<OutputCastSession>((resolve) => {
      resolveStartCast = resolve
      expect(request.targetId).toBe('display:2')
    }))

    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    await act(async () => buttonWithText('Full Screen').click())
    await act(async () => buttonWithText('16:9').click())
    await act(async () => buttonWithText('Stage Screen').click())

    await act(async () => root.render(
      <OutputCastControl canvas={canvas} capability={CANVAS_FRACTURES_OUTPUT_DEFERRED} />,
    ))
    stopCast.mockClear()

    await act(async () => {
      resolveStartCast?.({
        id: 'late-session',
        targetId: 'display:2',
        targetName: 'Stage Screen',
        windowMode: 'fullscreen',
        aspectRatio: '16:9',
        state: 'connecting',
        error: null,
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(stopCast).toHaveBeenCalledTimes(1)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Fractures cast unavailable"]')?.disabled).toBe(true)
  })

  it('stops and disables casting when the canonical capability becomes deferred', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    expect(document.body.querySelector('.rv-cast-popover')).not.toBeNull()

    await act(async () => root.render(
      <OutputCastControl canvas={canvas} capability={CANVAS_FRACTURES_OUTPUT_DEFERRED} />,
    ))

    const disabled = container.querySelector<HTMLButtonElement>('[aria-label="Fractures cast unavailable"]')
    expect(disabled?.disabled).toBe(true)
    expect(disabled?.textContent).toContain('Cast unavailable for Fractures')
    expect(document.body.querySelector('.rv-cast-popover')).toBeNull()
    expect(stopCast).toHaveBeenCalled()
    expect(startCast).not.toHaveBeenCalled()
  })

  it('closes the anchored popover when the trigger is clicked again or the page is clicked', async () => {
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')
    await act(async () => trigger?.click())
    expect(document.body.querySelector('.rv-cast-popover')).not.toBeNull()

    await act(async () => trigger?.click())
    expect(document.body.querySelector('.rv-cast-popover')).toBeNull()

    await act(async () => trigger?.click())
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(document.body.querySelector('.rv-cast-popover')).toBeNull()
  })
})
