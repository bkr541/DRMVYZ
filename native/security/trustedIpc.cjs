'use strict'

/**
 * One sender check for every privileged native bridge (beta remediation SEC-04).
 *
 * A bridge request is served only when it comes from the main frame of a live page whose own URL is the app (the dev server in development,
 * drmvyz-app://app in the built app). Requests from an embedded frame, from a page that has navigated elsewhere, or from any other window
 * (a popup, an output window) are refused: a rejected promise for `handle`, and nothing at all for `on`.
 *
 * main.cjs hands every bridge `createTrustedIpcMain(...)` instead of Electron's ipcMain, so each handler is checked without the bridge having
 * to remember to do it.
 */

function isTrustedIpcSender(event, isTrustedAppUrl) {
  const sender = event && event.sender
  const frame = event && event.senderFrame
  if (!sender || !frame) return false
  if (typeof sender.isDestroyed === 'function' && sender.isDestroyed()) return false
  // The page itself, never a frame embedded in it.
  if (sender.mainFrame && frame !== sender.mainFrame) return false
  return typeof frame.url === 'string' && isTrustedAppUrl(frame.url)
}

function createTrustedIpcMain({ ipcMain, isTrustedAppUrl, log }) {
  const rejected = new Set()
  const reject = channel => {
    // Logged once per channel, so a misbehaving page cannot flood the log.
    if (rejected.has(channel)) return
    rejected.add(channel)
    log?.scope?.('system:ipc')?.warn?.('refused a request from an untrusted sender', { channel })
  }
  const wrappedListeners = new Map()

  return {
    handle(channel, handler) {
      ipcMain.handle(channel, (event, ...args) => {
        if (!isTrustedIpcSender(event, isTrustedAppUrl)) {
          reject(channel)
          throw new Error(`Untrusted request: ${channel}`)
        }
        return handler(event, ...args)
      })
    },
    removeHandler(channel) {
      ipcMain.removeHandler(channel)
    },
    on(channel, listener) {
      const wrapped = (event, ...args) => {
        if (!isTrustedIpcSender(event, isTrustedAppUrl)) { reject(channel); return }
        listener(event, ...args)
      }
      wrappedListeners.set(listener, wrapped)
      ipcMain.on(channel, wrapped)
      return this
    },
    removeListener(channel, listener) {
      ipcMain.removeListener(channel, wrappedListeners.get(listener) ?? listener)
      wrappedListeners.delete(listener)
      return this
    },
    off(channel, listener) {
      return this.removeListener(channel, listener)
    },
  }
}

module.exports = { isTrustedIpcSender, createTrustedIpcMain }
