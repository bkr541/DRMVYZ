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
}))
