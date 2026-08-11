'use strict'

const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('drmvyzNative', Object.freeze({
  runtime: Object.freeze({
    isElectron: true,
    platform: process.platform,
  }),
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
  }),
  output: Object.freeze({
    listTargets: () => ipcRenderer.invoke('drmvyz:output:list-targets'),
    getTargetSnapshot: () => ipcRenderer.invoke('drmvyz:output:get-target-snapshot'),
    getSession: () => ipcRenderer.invoke('drmvyz:output:get-session'),
    performProviderAction: (providerId, actionId, payload) => ipcRenderer.invoke('drmvyz:output:perform-provider-action', providerId, actionId, payload),
    startCast: request => ipcRenderer.invoke('drmvyz:output:start-cast', request),
    stopCast: () => ipcRenderer.invoke('drmvyz:output:stop-cast'),
    publishOffer: (sessionId, offer) => ipcRenderer.invoke('drmvyz:output:publish-offer', sessionId, offer),
    waitForAnswer: sessionId => ipcRenderer.invoke('drmvyz:output:wait-for-answer', sessionId),
    failSession: (sessionId, message) => ipcRenderer.invoke('drmvyz:output:fail-session', sessionId, message),
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
}))
