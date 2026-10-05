'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { cameraSettingsUrl, installCameraAccessBridge, readCameraAccessStatus, requestCameraAccess } = require('./cameraAccessBridge.cjs')

const prefs = (status, { grant = true } = {}) => {
  const state = { status, asked: 0 }
  return {
    state,
    getMediaAccessStatus: () => state.status,
    askForMediaAccess: async () => {
      state.asked += 1
      state.status = grant ? 'granted' : 'denied'
      return grant
    },
  }
}

test('reports the OS camera status on macOS and Windows, and defers to the renderer elsewhere', () => {
  assert.equal(readCameraAccessStatus({ systemPreferences: prefs('denied'), platform: 'darwin' }), 'denied')
  assert.equal(readCameraAccessStatus({ systemPreferences: prefs('restricted'), platform: 'win32' }), 'restricted')
  assert.equal(readCameraAccessStatus({ systemPreferences: prefs('denied'), platform: 'linux' }), 'granted')
})

test('a throwing status read becomes "unknown" instead of failing the preflight', () => {
  const systemPreferences = { getMediaAccessStatus: () => { throw new Error('nope') } }
  assert.equal(readCameraAccessStatus({ systemPreferences, platform: 'darwin' }), 'unknown')
})

test('only prompts on macOS while the status is not-determined', async () => {
  const undecided = prefs('not-determined')
  assert.equal(await requestCameraAccess({ systemPreferences: undecided, platform: 'darwin' }), 'granted')
  assert.equal(undecided.state.asked, 1)

  const refused = prefs('not-determined', { grant: false })
  assert.equal(await requestCameraAccess({ systemPreferences: refused, platform: 'darwin' }), 'denied')

  const denied = prefs('denied')
  assert.equal(await requestCameraAccess({ systemPreferences: denied, platform: 'darwin' }), 'denied')
  assert.equal(denied.state.asked, 0)
})

test('registers the three camera channels and opens the platform settings page', async () => {
  const handlers = new Map()
  const opened = []
  installCameraAccessBridge({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    shell: { openExternal: async url => { opened.push(url) } },
    systemPreferences: prefs('denied'),
    platform: 'darwin',
  })
  assert.deepEqual([...handlers.keys()].sort(), [
    'drmvyz:camera:get-access',
    'drmvyz:camera:open-settings',
    'drmvyz:camera:request-access',
  ])
  assert.equal(await handlers.get('drmvyz:camera:get-access')(), 'denied')
  assert.equal(await handlers.get('drmvyz:camera:open-settings')(), true)
  assert.deepEqual(opened, [cameraSettingsUrl('darwin')])
  assert.equal(cameraSettingsUrl('linux'), null)
})
