'use strict'

const { contextBridge, ipcRenderer, webUtils } = require('electron')

// Settings Logging and developer notices can share the same native file watcher.
let mainLogSubscriberCount = 0

contextBridge.exposeInMainWorld('drmvyzNative', Object.freeze({
  runtime: Object.freeze({
    isElectron: true,
    platform: process.platform,
  }),
  ...(process.argv.includes('--stageless-review-notes') ? {
    reviewNotes: Object.freeze({ capturePage: () => ipcRenderer.invoke('drmvyz:review-notes:capture') }),
  } : {}),
  files: Object.freeze({
    getPathForFile: file => {
      try {
        return webUtils.getPathForFile(file) || null
      } catch {
        return null
      }
    },
  }),
  rekordbox: Object.freeze({
    selectUsbRootAndParse: () => ipcRenderer.invoke('drmvyz:rekordbox:select-usb-root-and-parse'),
    scanUsbRoot: rootPath => ipcRenderer.invoke('drmvyz:rekordbox:scan-usb-root', rootPath),
    getIndexStatus: () => ipcRenderer.invoke('drmvyz:rekordbox:index-status'),
    selectIndexDirectory: () => ipcRenderer.invoke('drmvyz:rekordbox:select-index-directory'),
    syncIndex: () => ipcRenderer.invoke('drmvyz:rekordbox:sync-index'),
    lookupIndexedTracks: filePaths => ipcRenderer.invoke('drmvyz:rekordbox:lookup-indexed-tracks', filePaths),
  }),
  output: Object.freeze({
    copyWebCastCode: code => ipcRenderer.invoke('drmvyz:output:copy-web-cast-code', code),
    listTargets: () => ipcRenderer.invoke('drmvyz:output:list-targets'),
    getTargetSnapshot: () => ipcRenderer.invoke('drmvyz:output:get-target-snapshot'),
    getSession: () => ipcRenderer.invoke('drmvyz:output:get-session'),
    performProviderAction: (providerId, actionId, payload) => ipcRenderer.invoke('drmvyz:output:perform-provider-action', providerId, actionId, payload),
    startCast: request => ipcRenderer.invoke('drmvyz:output:start-cast', request),
    stopCast: () => ipcRenderer.invoke('drmvyz:output:stop-cast'),
    publishOffer: (sessionId, offer) => ipcRenderer.invoke('drmvyz:output:publish-offer', sessionId, offer),
    waitForAnswer: sessionId => ipcRenderer.invoke('drmvyz:output:wait-for-answer', sessionId),
    failSession: (sessionId, message) => ipcRenderer.invoke('drmvyz:output:fail-session', sessionId, message),
    beginGoogleCastStream: (sessionId, metadata) => ipcRenderer.invoke('drmvyz:output:google-cast-begin-stream', sessionId, metadata),
    publishGoogleCastChunk: (sessionId, chunk) => ipcRenderer.invoke('drmvyz:output:google-cast-publish-chunk', sessionId, chunk),
    endGoogleCastStream: sessionId => ipcRenderer.invoke('drmvyz:output:google-cast-end-stream', sessionId),
    reportStats: (sessionId, stats) => ipcRenderer.invoke('drmvyz:output:report-stats', sessionId, stats),
    onTargetsChanged: callback => {
      const listener = (_event, targets) => callback(targets)
      ipcRenderer.on('drmvyz:output:targets-changed', listener)
      return () => ipcRenderer.removeListener('drmvyz:output:targets-changed', listener)
    },
    onTargetSnapshotChanged: callback => {
      const listener = (_event, snapshot) => callback(snapshot)
      ipcRenderer.on('drmvyz:output:target-snapshot-changed', listener)
      return () => ipcRenderer.removeListener('drmvyz:output:target-snapshot-changed', listener)
    },
    onSessionChanged: callback => {
      const listener = (_event, session) => callback(session)
      ipcRenderer.on('drmvyz:output:session-changed', listener)
      return () => ipcRenderer.removeListener('drmvyz:output:session-changed', listener)
    },
    onReceiverRequested: callback => {
      const listener = (_event, request) => callback(request)
      ipcRenderer.on('drmvyz:output:receiver-requested', listener)
      return () => ipcRenderer.removeListener('drmvyz:output:receiver-requested', listener)
    },
  }),
  system: Object.freeze({
    getCpuUsage: () => ipcRenderer.invoke('drmvyz:system:get-cpu-usage'),
  }),
  // Performance recordings written to disk as they are made (native/recording/recordingBridge.cjs).
  recording: Object.freeze({
    start: fileName => ipcRenderer.invoke('drmvyz:recording:start', fileName),
    append: (id, chunk) => ipcRenderer.invoke('drmvyz:recording:append', id, chunk),
    finish: id => ipcRenderer.invoke('drmvyz:recording:finish', id),
    abort: id => ipcRenderer.invoke('drmvyz:recording:abort', id),
  }),
  recovery: Object.freeze({
    // Main tells the renderer when the GPU process died while it was still running, so it can shed load.
    onEvent: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('drmvyz:recovery:event', listener)
      return () => ipcRenderer.removeListener('drmvyz:recovery:event', listener)
    },
  }),
  camera: Object.freeze({
    getAccessStatus: () => ipcRenderer.invoke('drmvyz:camera:get-access'),
    requestAccess: () => ipcRenderer.invoke('drmvyz:camera:request-access'),
    openSettings: () => ipcRenderer.invoke('drmvyz:camera:open-settings'),
  }),
  diagnostics: Object.freeze({
    // Fire-and-forget: logging must never block or reject on the caller.
    log: entry => { ipcRenderer.send('drmvyz:diagnostics:log', entry) },
    readMainLog: () => ipcRenderer.invoke('drmvyz:diagnostics:read-main-log'),
    watchMainLog: callback => {
      const listener = (_event, chunk) => callback(chunk)
      ipcRenderer.on('drmvyz:diagnostics:main-log-appended', listener)
      mainLogSubscriberCount += 1
      if (mainLogSubscriberCount === 1) ipcRenderer.send('drmvyz:diagnostics:watch-main-log')
      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        ipcRenderer.removeListener('drmvyz:diagnostics:main-log-appended', listener)
        mainLogSubscriberCount -= 1
        if (mainLogSubscriberCount === 0) ipcRenderer.send('drmvyz:diagnostics:unwatch-main-log')
      }
    },
  }),
}))
