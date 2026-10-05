// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { buildHeadlinerCameraOptions, describeHeadlinerCameraDevices, listHeadlinerCameras } from './HeadlinerCameraDevices'

function installDevices(devices: Array<Partial<MediaDeviceInfo>>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { enumerateDevices: async () => devices },
  })
}

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
})

describe('Headliner camera devices', () => {
  it('lists only real video inputs and names unlabelled ones by position', async () => {
    installDevices([
      { kind: 'audioinput', deviceId: 'mic', label: 'Mic' },
      { kind: 'videoinput', deviceId: 'a', label: 'FaceTime HD Camera' },
      { kind: 'videoinput', deviceId: 'b', label: '' },
      { kind: 'videoinput', deviceId: '', label: '' },
    ])

    expect(await listHeadlinerCameras()).toEqual([
      { id: 'a', label: 'FaceTime HD Camera' },
      { id: 'b', label: 'Camera 2' },
    ])
  })

  it('returns an empty list when enumeration is unavailable or throws', async () => {
    expect(await listHeadlinerCameras()).toEqual([])
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: async () => { throw new Error('nope') } },
    })
    expect(await listHeadlinerCameras()).toEqual([])
  })

  it('summarises devices for the log, flagging that labels are still hidden', async () => {
    installDevices([{ kind: 'videoinput', deviceId: 'a', label: '' }])
    expect(await describeHeadlinerCameraDevices()).toEqual({ count: 1, labels: ['(unlabelled)'], labelled: false })
  })

  it('builds dropdown options with the default first and keeps an unplugged saved camera selectable', () => {
    const devices = [{ id: 'a', label: 'FaceTime HD Camera' }]
    expect(buildHeadlinerCameraOptions(devices, 'default-front-camera')).toEqual([
      { value: 'default-front-camera', label: 'Default Front Camera' },
      { value: 'a', label: 'FaceTime HD Camera' },
    ])
    expect(buildHeadlinerCameraOptions(devices, 'default-front-camera', 'FaceTime HD Camera')[0].label)
      .toBe('Default Front Camera (FaceTime HD Camera)')
    expect(buildHeadlinerCameraOptions(devices, 'a', 'FaceTime HD Camera')[0].label).toBe('Default Front Camera')
    expect(buildHeadlinerCameraOptions(devices, 'gone')[2]).toEqual({ value: 'gone', label: 'Saved camera (not connected)' })
  })
})
