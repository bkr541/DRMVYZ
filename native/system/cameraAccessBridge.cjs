'use strict'

const MAC_CAMERA_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera'
const WINDOWS_CAMERA_SETTINGS_URL = 'ms-settings:privacy-webcam'

/**
 * Electron only exposes the OS-level camera permission on macOS and Windows. Elsewhere the
 * renderer's own getUserMedia result is the only signal, so we report 'granted' and let it decide.
 */
function readCameraAccessStatus({ systemPreferences, platform = process.platform }) {
  if (platform !== 'darwin' && platform !== 'win32') return 'granted'
  try {
    return systemPreferences.getMediaAccessStatus('camera')
  } catch {
    return 'unknown'
  }
}

/** The macOS prompt can only be raised from the main process, and only while status is 'not-determined'. */
async function requestCameraAccess({ systemPreferences, platform = process.platform, log }) {
  const before = readCameraAccessStatus({ systemPreferences, platform })
  if (platform !== 'darwin' || before !== 'not-determined') return before
  try {
    const granted = await systemPreferences.askForMediaAccess('camera')
    const after = readCameraAccessStatus({ systemPreferences, platform })
    log?.info?.('camera access prompt resolved', { granted, status: after })
    return after
  } catch (error) {
    log?.warn?.('camera access prompt failed', error)
    return readCameraAccessStatus({ systemPreferences, platform })
  }
}

function cameraSettingsUrl(platform = process.platform) {
  if (platform === 'darwin') return MAC_CAMERA_SETTINGS_URL
  if (platform === 'win32') return WINDOWS_CAMERA_SETTINGS_URL
  return null
}

/** Serves Headliner's camera preflight (see src/native/cameraAccessBridge.ts). */
function installCameraAccessBridge({ ipcMain, shell, systemPreferences, log, platform = process.platform }) {
  const scoped = log?.scope?.('system:camera')

  ipcMain.handle('drmvyz:camera:get-access', () => readCameraAccessStatus({ systemPreferences, platform }))
  ipcMain.handle('drmvyz:camera:request-access', () => requestCameraAccess({ systemPreferences, platform, log: scoped }))
  ipcMain.handle('drmvyz:camera:open-settings', async () => {
    const url = cameraSettingsUrl(platform)
    if (!url) return false
    try {
      await shell.openExternal(url)
      return true
    } catch (error) {
      scoped?.warn?.('open camera settings failed', error)
      return false
    }
  })
}

module.exports = {
  installCameraAccessBridge,
  readCameraAccessStatus,
  requestCameraAccess,
  cameraSettingsUrl,
}
