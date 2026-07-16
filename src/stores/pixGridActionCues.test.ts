import { beforeEach, describe, expect, it } from 'vitest'
import type { PixGridActionCue } from '../components/vyzualz/react/pixGrid/PixGridActionCues'
import { migrateReactStore, useReactStore } from './reactStore'

function makeCue(id: string, timeSec = 10): PixGridActionCue {
  return {
    version: 1,
    id,
    timeSec,
    label: id,
    enabled: true,
    engineId: 'pixGrid',
    action: { type: 'clearScreen' },
    quantization: 'beat',
    transition: 'cut',
    transitionDurationSec: 0,
    oneShotDurationSec: 0.5,
    loopBehavior: 'retrigger',
    order: 0,
  }
}

describe('PixGrid action cue persistence and editing', () => {
  beforeEach(() => useReactStore.setState({ pixGridActionCuesByTrackId: {}, presetAutomationCuesByTrackId: {} }))

  it('creates, edits, duplicates, deletes, and deterministically sorts cues', () => {
    const store = useReactStore.getState()
    store.addPixGridActionCue('track', makeCue('late', 8))
    store.addPixGridActionCue('track', makeCue('early', 2))
    store.updatePixGridActionCue('track', 'early', { label: 'Edited', enabled: false })
    const duplicatedId = store.duplicatePixGridActionCue('track', 'late')
    expect(duplicatedId).not.toBeNull()
    expect(store.getPixGridActionCuesForTrack('track').map(cue => cue.timeSec)).toEqual([2, 8, 8])
    expect(store.getPixGridActionCuesForTrack('track')[0]).toMatchObject({ label: 'Edited', enabled: false })
    store.removePixGridActionCue('track', 'early')
    expect(store.getPixGridActionCuesForTrack('track').some(cue => cue.id === 'early')).toBe(false)
  })

  it('keeps action cues isolated by track and compatible with preset automation', () => {
    const store = useReactStore.getState()
    store.addPixGridActionCue('track-a', makeCue('same'))
    store.addPixGridActionCue('track-b', makeCue('same'))
    store.addPresetAutomationCue('track-a', {
      id: 'preset', timeSec: 4, presetId: 'pix-grid-bass-beacon', label: 'Preset', enabled: true, transitionMs: 0,
    })
    store.clearPixGridActionCuesForTrack('track-a')
    expect(store.getPixGridActionCuesForTrack('track-a')).toEqual([])
    expect(store.getPixGridActionCuesForTrack('track-b')).toHaveLength(1)
    expect(store.getPresetAutomationCuesForTrack('track-a')).toHaveLength(1)
  })

  it('migrates v49 snapshots with normalized cue storage', () => {
    const migrated = migrateReactStore({
      pixGridActionCuesByTrackId: {
        track: [{ ...makeCue('cue'), timeSec: -2 }, { ...makeCue('cue'), timeSec: 4 }],
      },
    }, 49)
    expect(migrated.pixGridActionCuesByTrackId).toEqual({
      track: [expect.objectContaining({ id: 'cue', timeSec: 0, engineId: 'pixGrid' })],
    })
  })
})
