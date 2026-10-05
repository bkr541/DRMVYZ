import { useCallback, useEffect, useState } from 'react'
import { HEADLINER_DEFAULT_CAMERA_SOURCE_ID } from './HeadlinerSettings'

export interface HeadlinerCameraDevice {
  /** The browser `deviceId` — what a persisted camera choice is keyed on. */
  id: string
  label: string
}

/** Cameras the system reports right now. Labels (and ids) stay blank until camera access has been granted once. */
export async function listHeadlinerCameras(): Promise<HeadlinerCameraDevice[]> {
  const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
  if (!mediaDevices?.enumerateDevices) return []
  try {
    const devices = await mediaDevices.enumerateDevices()
    return devices
      .filter(device => device.kind === 'videoinput' && device.deviceId)
      .map((device, index) => ({ id: device.deviceId, label: device.label || `Camera ${index + 1}` }))
  } catch {
    return []
  }
}

/** Log-safe summary: includes cameras that are visible but not yet labelled, which is itself a permission clue. */
export async function describeHeadlinerCameraDevices(): Promise<{ count: number; labels: string[]; labelled: boolean } | null> {
  const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
  if (!mediaDevices?.enumerateDevices) return null
  try {
    const cameras = (await mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput')
    return {
      count: cameras.length,
      labels: cameras.map(camera => camera.label || '(unlabelled)'),
      labelled: cameras.some(camera => camera.label),
    }
  } catch {
    return null
  }
}

/**
 * Live list of connected cameras. Re-reads on hotplug and whenever `refreshKey` changes — pass something that
 * flips when camera access is granted, since only then does the browser reveal device names.
 */
export function useHeadlinerCameraDevices(refreshKey: unknown): { devices: HeadlinerCameraDevice[]; refresh: () => void } {
  const [devices, setDevices] = useState<HeadlinerCameraDevice[]>([])
  const [manualRefresh, setManualRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    const read = () => {
      void listHeadlinerCameras().then(next => {
        if (!cancelled) setDevices(previous => sameDevices(previous, next) ? previous : next)
      })
    }
    read()
    const mediaDevices = navigator.mediaDevices
    mediaDevices?.addEventListener?.('devicechange', read)
    return () => {
      cancelled = true
      mediaDevices?.removeEventListener?.('devicechange', read)
    }
  }, [refreshKey, manualRefresh])

  const refresh = useCallback(() => setManualRefresh(value => value + 1), [])
  return { devices, refresh }
}

function sameDevices(a: readonly HeadlinerCameraDevice[], b: readonly HeadlinerCameraDevice[]): boolean {
  return a.length === b.length && a.every((device, index) => device.id === b[index].id && device.label === b[index].label)
}

export interface HeadlinerCameraOption {
  value: string
  label: string
}

/**
 * Dropdown options: the default, every detected camera, and a placeholder when the saved camera is unplugged.
 * `liveDefaultLabel` is the camera the default currently resolves to, so "Default" says which device it is.
 */
export function buildHeadlinerCameraOptions(
  devices: readonly HeadlinerCameraDevice[],
  selectedId: string,
  liveDefaultLabel: string | null = null,
): HeadlinerCameraOption[] {
  const options: HeadlinerCameraOption[] = [
    {
      value: HEADLINER_DEFAULT_CAMERA_SOURCE_ID,
      label: liveDefaultLabel && selectedId === HEADLINER_DEFAULT_CAMERA_SOURCE_ID
        ? `Default Front Camera (${liveDefaultLabel})`
        : 'Default Front Camera',
    },
    ...devices.map(device => ({ value: device.id, label: device.label })),
  ]
  if (selectedId !== HEADLINER_DEFAULT_CAMERA_SOURCE_ID && !devices.some(device => device.id === selectedId)) {
    options.push({ value: selectedId, label: 'Saved camera (not connected)' })
  }
  return options
}
