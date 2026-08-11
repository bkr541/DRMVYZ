'use strict'

const WINDOWS_MIRACAST_PROVIDER_ID = 'miracast'
const OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION = 'open-system-picker'

class WindowsMiracastProvider {
  constructor({ platform = process.platform, openWindowsDisplays = null } = {}) {
    this.id = WINDOWS_MIRACAST_PROVIDER_ID
    this.label = 'Windows Wireless Displays'
    this.capabilities = Object.freeze({
      targetEnumeration: false,
      sessions: false,
      picker: true,
      actions: [OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION],
    })
    this.platform = platform
    this.openWindowsDisplays = openWindowsDisplays
    this.lastError = null
    this.onStatusChanged = () => {}
    this.onTargetsChanged = () => {}
  }

  start({ onStatusChanged, onTargetsChanged } = {}) {
    this.onStatusChanged = typeof onStatusChanged === 'function' ? onStatusChanged : () => {}
    this.onTargetsChanged = typeof onTargetsChanged === 'function' ? onTargetsChanged : () => {}
  }

  listTargets() {
    return []
  }

  getStatus() {
    if (this.platform !== 'win32') {
      return {
        state: 'unsupported',
        message: 'Windows Wireless Display selection is available on Windows only.',
      }
    }
    if (typeof this.openWindowsDisplays !== 'function') {
      return {
        state: 'unavailable',
        message: 'The native Windows display-selection action is unavailable in this build.',
      }
    }
    if (this.lastError) {
      return {
        state: 'initialization-failed',
        message: this.lastError,
      }
    }
    return { state: 'available', message: null }
  }

  async performAction(actionId, payload, context) {
    if (actionId !== OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION) {
      throw new Error(`${this.label} does not support action: ${actionId}`)
    }
    if (this.platform !== 'win32') throw new Error('Windows Wireless Display selection is available on Windows only')
    if (typeof this.openWindowsDisplays !== 'function') throw new Error('The native Windows display-selection action is unavailable')

    this.lastError = null
    try {
      const result = await this.openWindowsDisplays({ payload, context })
      this.onTargetsChanged()
      return {
        providerId: this.id,
        actionId,
        state: 'opened',
        message: result?.message ?? 'Windows Display settings opened. Connect to a wireless display there; DRMVYZ will list the resulting Windows display automatically.',
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Could not open Windows Display settings'
      this.onStatusChanged()
      throw error
    }
  }

  shutdown() {
    this.lastError = null
  }
}

module.exports = {
  WINDOWS_MIRACAST_PROVIDER_ID,
  OPEN_WINDOWS_DISPLAY_SETTINGS_ACTION,
  WindowsMiracastProvider,
}
