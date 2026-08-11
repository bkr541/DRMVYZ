'use strict'

const MACOS_AIRPLAY_PROVIDER_ID = 'airplay'
const OPEN_SYSTEM_PICKER_ACTION = 'open-system-picker'

class MacOsAirPlayProvider {
  constructor({ platform = process.platform, openSystemDisplays = null } = {}) {
    this.id = MACOS_AIRPLAY_PROVIDER_ID
    this.label = 'AirPlay / Wireless Displays'
    this.capabilities = Object.freeze({
      targetEnumeration: false,
      sessions: false,
      picker: true,
      actions: [OPEN_SYSTEM_PICKER_ACTION],
    })
    this.platform = platform
    this.openSystemDisplays = openSystemDisplays
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
    if (this.platform !== 'darwin') {
      return {
        state: 'unsupported',
        message: 'AirPlay wireless-display selection is available on macOS only.',
      }
    }
    if (typeof this.openSystemDisplays !== 'function') {
      return {
        state: 'unavailable',
        message: 'The native macOS display-selection action is unavailable in this build.',
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

  async performAction(actionId) {
    if (actionId !== OPEN_SYSTEM_PICKER_ACTION) {
      throw new Error(`${this.label} does not support action: ${actionId}`)
    }
    if (this.platform !== 'darwin') throw new Error('AirPlay wireless-display selection is available on macOS only')
    if (typeof this.openSystemDisplays !== 'function') throw new Error('The native macOS display-selection action is unavailable')

    this.lastError = null
    try {
      const result = await this.openSystemDisplays()
      this.onTargetsChanged()
      return {
        providerId: this.id,
        actionId,
        state: 'opened',
        message: result?.message ?? 'macOS display controls opened. Connect with Screen Mirroring or extend the display; DRMVYZ will list the resulting system display automatically.',
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Could not open macOS display controls'
      this.onStatusChanged()
      throw error
    }
  }

  shutdown() {
    this.lastError = null
  }
}

module.exports = {
  MACOS_AIRPLAY_PROVIDER_ID,
  OPEN_SYSTEM_PICKER_ACTION,
  MacOsAirPlayProvider,
}
