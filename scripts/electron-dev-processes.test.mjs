import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findDrmvyzProcesses } from './electron-dev-processes.mjs'
const options = { cacheRoot: '/repo/node_modules/.cache/drmvyz-electron', stockElectronBinary: '/repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron', currentPid: 99 }

test('finds isolated development, packaged and helper processes regardless of installed location', () => {
  const result = findDrmvyzProcesses(`
  11 /repo/node_modules/.cache/drmvyz-electron/43/DRMVYZ Dev.app/Contents/MacOS/Electron
  12 /Applications/DRMVYZ.app/Contents/MacOS/DRMVYZ
  13 /Users/a/My Apps/DRMVYZ.app/Contents/Frameworks/DRMVYZ Helper.app/Contents/MacOS/DRMVYZ Helper
  14 /another checkout/DRMVYZ Dev.app/Contents/MacOS/Electron
`, options)
  assert.deepEqual(result.map(p => p.pid), [11,12,13,14])
})
test('leaves unrelated Electron apps, similarly named folders and the current process alone', () => {
  const result = findDrmvyzProcesses(`
  21 /Applications/Codex.app/Contents/MacOS/Codex
  22 /Applications/Other.app/Contents/MacOS/Electron
  23 /repo/node_modules/.cache/drmvyz-electron-other/Electron
  24 /Applications/DRMVYZ Tools.app/Contents/MacOS/Tools
  25 /repo/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
  99 /Applications/DRMVYZ.app/Contents/MacOS/DRMVYZ
`, options)
  assert.deepEqual(result, [])
})
test('only closes a stock Electron shell when its working directory identifies this repository', () => {
  const listing = `31 ${options.stockElectronBinary}\n32 ${options.stockElectronBinary}`
  const result = findDrmvyzProcesses(listing, { ...options, isRepoStockElectron: pid => pid === 31 })
  assert.deepEqual(result.map(p => p.pid), [31])
})
test('tolerates empty or exited-process rows', () => {
  assert.deepEqual(findDrmvyzProcesses('\nnot a process\n  45\n', options), [])
})
