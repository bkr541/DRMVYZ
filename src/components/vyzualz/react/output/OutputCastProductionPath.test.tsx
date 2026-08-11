// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Node test runtime API; the renderer tsconfig intentionally excludes Node globals.
import { mkdtempSync, rmSync } from 'node:fs'
// @ts-expect-error Node test runtime API; the renderer tsconfig intentionally excludes Node globals.
import { tmpdir } from 'node:os'
// @ts-expect-error Node test runtime API; the renderer tsconfig intentionally excludes Node globals.
import { join } from 'node:path'
// @ts-expect-error Production native bridge is CommonJS and intentionally has no renderer TypeScript declaration.
import outputCastBridgeModule from '../../../../../native/output/outputCastBridge.cjs'
import preloadSource from '../../../../../native/rekordbox/preloadRekordboxBridge.cjs?raw'
import { OutputCastControl } from './OutputCastControl'

const { installOutputCastBridge } = outputCastBridgeModule as {
  installOutputCastBridge: (options: Record<string, unknown>) => {
    targetManager: { getSession: () => { providerId?: string; targetId?: string } | null }
    shutdown: () => Promise<void>
  }
}

class FakeEmitter {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  on(event: string, listener: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)?.add(listener)
    return this
  }

  once(event: string, listener: (...args: unknown[]) => void) {
    const wrapped = (...args: unknown[]) => {
      this.removeListener(event, wrapped)
      listener(...args)
    }
    return this.on(event, wrapped)
  }

  removeListener(event: string, listener: (...args: unknown[]) => void) {
    this.listeners.get(event)?.delete(listener)
    return this
  }

  emit(event: string, ...args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args)
    return true
  }
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

afterEach(() => {
  document.body.replaceChildren()
  delete window.drmvyzNative
})

describe('OutputCastControl production path', () => {
  it('dispatches React selection through the real preload and IPC manager into LocalDisplayProvider', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle(channel: string, handler: (...args: unknown[]) => unknown) { handlers.set(channel, handler) },
      removeHandler(channel: string) { handlers.delete(channel) },
    }
    const userData = mkdtempSync(join(tmpdir(), 'drmvyz-output-react-production-'))
    const app = new FakeEmitter() as FakeEmitter & { getPath: () => string }
    app.getPath = () => userData
    const display = {
      id: 7,
      label: 'Stage Screen',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      displayFrequency: 60,
    }
    const screen = new FakeEmitter() as FakeEmitter & {
      getAllDisplays: () => typeof display[]
      getPrimaryDisplay: () => typeof display
    }
    screen.getAllDisplays = () => [display]
    screen.getPrimaryDisplay = () => display

    const createdWindows: Array<{ loadedUrl?: string }> = []
    class FakeBrowserWindow extends FakeEmitter {
      static getAllWindows() { return [] }
      destroyed = false
      webContents = Object.assign(new FakeEmitter(), { setWindowOpenHandler: () => {} })
      loadedUrl?: string
      constructor(_options: unknown) {
        super()
        createdWindows.push(this)
      }
      setAspectRatio() {}
      setMenuBarVisibility() {}
      setFullScreen() {}
      show() {}
      loadURL(url: string) { this.loadedUrl = url; return Promise.resolve() }
      isDestroyed() { return this.destroyed }
      close() { if (this.destroyed) return; this.destroyed = true; this.emit('closed') }
      destroy() { this.close() }
    }

    const installed = installOutputCastBridge({
      app,
      BrowserWindow: FakeBrowserWindow,
      ipcMain,
      screen,
      platform: 'linux',
      isTrustedAppUrl: () => true,
      listenHttpServer: async (_server: unknown, host: string) => host === '127.0.0.1' ? 43123 : 43124,
    })

    const sender = Object.assign(new FakeEmitter(), {
      id: 101,
      getURL: () => 'file:///app/index.html',
      isDestroyed: () => false,
    })
    const event = { sender, senderFrame: { url: 'file:///app/index.html' } }
    const ipcRenderer = Object.assign(new FakeEmitter(), {
      invoke: async (channel: string, ...args: unknown[]) => {
        const handler = handlers.get(channel)
        if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
        return handler(event, ...args)
      },
    })
    const exposed: Record<string, unknown> = {}
    const contextBridge = { exposeInMainWorld: (name: string, value: unknown) => { exposed[name] = value } }
    const evaluatePreload = new Function('require', 'process', preloadSource)
    evaluatePreload(
      (request: string) => {
        if (request !== 'electron') throw new Error(`Unexpected preload dependency: ${request}`)
        return { contextBridge, ipcRenderer, webUtils: { getPathForFile: () => null } }
      },
      { platform: 'linux' },
    )
    window.drmvyzNative = exposed.drmvyzNative as typeof window.drmvyzNative

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720

    try {
      await act(async () => {
        root.render(<OutputCastControl canvas={canvas} />)
        await Promise.resolve()
        await Promise.resolve()
      })
      await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Cast visual output"]')?.click())

      for (let attempt = 0; attempt < 20 && !document.body.textContent?.includes('Stage Screen'); attempt += 1) {
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
      }
      await act(async () => buttonWithText('Full Screen').click())
      await act(async () => buttonWithText('16:9').click())
      await act(async () => buttonWithText('Stage Screen').click())

      const managedSession = installed.targetManager.getSession()
      expect(managedSession?.providerId).toBe('local-display')
      expect(managedSession?.targetId).toBe('display:7')
      expect(createdWindows).toHaveLength(1)
      expect(createdWindows[0].loadedUrl).toMatch(/^http:\/\/127\.0\.0\.1:43123\/receiver\?/)
    } finally {
      await act(async () => root.unmount())
      await installed.shutdown()
      rmSync(userData, { recursive: true, force: true })
    }
  })
})
