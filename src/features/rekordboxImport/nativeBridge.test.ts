// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { getNativeFilePath, guessNativeUsbRootFromFile, isElectronRuntime } from './nativeBridge'

afterEach(() => {
  delete window.drmvyzNative
})

describe('Electron native file bridge', () => {
  it('uses the preload webUtils path bridge for modern Electron File objects', () => {
    const file = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' })
    window.drmvyzNative = {
      runtime: { isElectron: true, platform: 'darwin' },
      files: { getPathForFile: () => '/Volumes/DJ USB/Contents/track.mp3' },
    }

    expect(isElectronRuntime()).toBe(true)
    expect(getNativeFilePath(file)).toBe('/Volumes/DJ USB/Contents/track.mp3')
    expect(guessNativeUsbRootFromFile(file)).toBe('/Volumes/DJ USB')
  })

  it('keeps the legacy File.path fallback for older Electron runtimes', () => {
    const file = Object.assign(new File(['audio'], 'track.wav'), {
      path: 'E:\\Contents\\track.wav',
    })

    expect(getNativeFilePath(file)).toBe('E:/Contents/track.wav')
    expect(guessNativeUsbRootFromFile(file)).toBe('E:/')
  })
})
