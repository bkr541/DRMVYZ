'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('drmvyzNative', {
  rekordbox: {
    selectUsbRootAndParse: () => ipcRenderer.invoke('drmvyz:rekordbox:select-usb-root-and-parse'),
    scanUsbRoot: rootPath => ipcRenderer.invoke('drmvyz:rekordbox:scan-usb-root', rootPath),
  },
})
