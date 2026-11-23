import type { SavedAudioTrack } from '../../../../stores/audioStore'
import { PRESET_MANAGER_PRESETS } from '../../presetManager/presetManagerCatalog'

/** Local sample records shared by every Record Listing study column. */
const RECORDS = [
  { id: 'drmvyz.cinema2.reactor', name: 'Reactor' },
  { id: 'drmvyz.cinema2.glassfall', name: 'GLASSFALL' },
  { id: 'drmvyz.cinema2.chamber', name: 'CHAMBER' },
]
export const LIBRARY_PRESETS = ['Afterhours', 'Ancient Machine', 'ATL HOE', 'Crystalized'].map(name => PRESET_MANAGER_PRESETS.find(preset => preset.name === name)!).filter(Boolean)
export const TRACKS: SavedAudioTrack[] = ['Afterhours', 'Midnight Circuit', 'Signal Drift', 'Closing Time'].map((title, index) => ({
  id: 'lab-audio-' + index, dbId: 'lab-audio-' + index, title, artist: 'DVYDRM',
  fileName: title + '.wav', storagePath: null, durationSec: 240 + index * 27,
  sampleRate: 48000, channels: 2, fileSizeByte: null, mimeType: 'audio/wav',
  transcriptionAssets: null, genre: 'Electronic', bpm: 124 + index * 2,
  musicalKey: ['Am', 'Fm', 'Cm', 'Dm'][index], createdAt: '2026-01-01T00:00:00Z',
}))
export const MODELS = [RECORDS[2], { ...RECORDS[0], name: 'Reactor Assembly' }, { id: 'drmvyz.cinema2.crate-moire-orb', name: 'Moire Orb' }, { ...RECORDS[1], name: 'Glass Sculpture' }]
