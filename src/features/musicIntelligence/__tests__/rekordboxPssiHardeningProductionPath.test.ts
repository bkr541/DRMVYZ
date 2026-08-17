import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { createRemoteRuntimeTrack } from '../../../audio/runtimeTrack'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../../../types'
import { mapRekordboxMatchToDrmvyz } from '../../rekordboxImport/mapToDrmvyzAnalysis'
import { matchFileToRekordboxTrack } from '../../rekordboxImport/matchTrack'
import type { RekordboxLibrary } from '../../rekordboxImport/types'
import { adaptMIAnalysis } from '../../trackIntelligence/trackMapAdapter'
import { resolveAuthoritativeTimeline } from '../../trackIntelligence/authoritativeTimeline'
import { withTrackAnalysisCompatibilityDefaults } from '../analysisCompatibility'
import { CURRENT_ANALYSIS_VERSION } from '../analysisVersion'
import { AudioFeatureBus } from '../AudioFeatureBus'
import { MusicIntelligenceEngine } from '../MusicIntelligenceEngine'
import { analyzeTrackBuffer } from '../offlineTrackAnalyzer'
import { getConditionSourceValue, getMusicIntelligenceSourceValue } from '../selectors'
import { boundTrackAnalysisForStorage } from '../trackAnalysisStorage'
import type { TrackIntelligenceAnalysis } from '../types'

const require = createRequire(import.meta.url)
const { scanRekordboxUsbRoot } = require('../../../../native/rekordbox/rekordboxUsbBridge.cjs') as {
  scanRekordboxUsbRoot: (rootPath: string) => Promise<{ library: RekordboxLibrary }>
}

const PSSI_MASK_BASE = [
  0xcb, 0xe1, 0xee, 0xfa, 0xe5, 0xee, 0xad, 0xee, 0xe9, 0xd2,
  0xe9, 0xeb, 0xe1, 0xe9, 0xf3, 0xe8, 0xe9, 0xf4, 0xe1,
]

function makeTag(fourcc: string, body: Buffer, headerLen = 12): Buffer {
  const tag = Buffer.alloc(12 + body.length)
  tag.write(fourcc, 0, 'ascii')
  tag.writeUInt32BE(headerLen, 4)
  tag.writeUInt32BE(tag.length, 8)
  body.copy(tag, 12)
  return tag
}

function makePmai(tags: Buffer[]): Buffer {
  const header = Buffer.alloc(0x1c)
  header.write('PMAI', 0, 'ascii')
  header.writeUInt32BE(header.length, 4)
  const total = header.length + tags.reduce((sum, tag) => sum + tag.length, 0)
  header.writeUInt32BE(total, 8)
  return Buffer.concat([header, ...tags], total)
}

function makePqtzTag(): Buffer {
  const beatCount = 17
  const body = Buffer.alloc(12 + beatCount * 8)
  body.writeUInt32BE(0x80000, 4)
  body.writeUInt32BE(beatCount, 8)
  for (let index = 0; index < beatCount; index++) {
    const offset = 12 + index * 8
    body.writeUInt16BE((index % 4) + 1, offset)
    body.writeUInt16BE(12_000, offset + 2)
    body.writeUInt32BE(index * 500, offset + 4)
  }
  return makeTag('PQTZ', body, 0x18)
}

function utf16Be(value: string): Buffer {
  const littleEndian = Buffer.from(`${value}\0`, 'utf16le')
  const bigEndian = Buffer.alloc(littleEndian.length)
  for (let index = 0; index < littleEndian.length; index += 2) {
    bigEndian[index] = littleEndian[index + 1]!
    bigEndian[index + 1] = littleEndian[index]!
  }
  return bigEndian
}

function makePpthTag(audioPath: string): Buffer {
  const encoded = utf16Be(audioPath)
  const body = Buffer.alloc(4 + encoded.length)
  body.writeUInt32BE(encoded.length, 0)
  encoded.copy(body, 4)
  return makeTag('PPTH', body, 0x10)
}

function makeMaskedV1PssiTag(): Buffer {
  const entries = [
    { beat: 1, kind: 1, k1: 1 },
    { beat: 5, kind: 2, k2: 0, k3: 1 },
    { beat: 9, kind: 5, k1: 0 },
    { beat: 13, kind: 6, k1: 1 },
  ]
  const entryCount = entries.length
  const songBody = Buffer.alloc(14 + entryCount * 24)
  songBody.writeUInt16BE(1, 0)
  songBody.writeUInt16BE(17, 8)
  songBody.writeUInt8(3, 12)
  entries.forEach((entry, index) => {
    const offset = 14 + index * 24
    songBody.writeUInt16BE(index + 1, offset)
    songBody.writeUInt16BE(entry.beat, offset + 2)
    songBody.writeUInt16BE(entry.kind, offset + 4)
    songBody.writeUInt8(entry.k1 ?? 0, offset + 7)
    songBody.writeUInt8(entry.k2 ?? 0, offset + 9)
    songBody.writeUInt8(entry.k3 ?? 0, offset + 19)
  })
  const maskedBody = Buffer.from(songBody)
  const maskStart = 1 % PSSI_MASK_BASE.length
  for (let index = 0; index < maskedBody.length; index++) {
    maskedBody[index] ^= (PSSI_MASK_BASE[(index + maskStart) % PSSI_MASK_BASE.length]! + entryCount) & 0xff
  }
  const body = Buffer.alloc(6 + maskedBody.length)
  body.writeUInt16BE(1, 0)
  body.writeUInt16BE(24, 2)
  body.writeUInt16BE(entryCount, 4)
  maskedBody.copy(body, 6)
  return makeTag('PSSI', body, 0x20)
}

function makeAudioBuffer(durationSec = 8, sampleRate = 4_000): AudioBuffer {
  const length = Math.round(durationSec * sampleRate)
  const channel = new Float32Array(length)
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate
    channel[index] = Math.sin(2 * Math.PI * 110 * time) * (0.15 + Math.floor(time / 2) * 0.12)
  }
  return {
    duration: durationSec,
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

describe('Rekordbox PSSI hardening production path', () => {
  it('flows a native USB v1/masked PSSI through matching, seed mapping, Track Intelligence, persistence, Track Map, and runtime selectors', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'drmvyz-rb-production-path-'))
    try {
      const analysisDir = path.join(root, 'PIONEER', 'USBANLZ', 'P001', '00000000')
      await mkdir(analysisDir, { recursive: true })
      const audioPath = '/Contents/production-path.wav'
      await writeFile(path.join(analysisDir, 'ANLZ0000.DAT'), makePmai([makePpthTag(audioPath), makePqtzTag()]))
      await writeFile(path.join(analysisDir, 'ANLZ0000.EXT'), makePmai([makePpthTag(audioPath), makeMaskedV1PssiTag()]))

      const nativeImport = await scanRekordboxUsbRoot(root)
      const [nativeTrack] = nativeImport.library.tracks
      expect(nativeTrack?.pssiIntegrity).toMatchObject({
        version: 1,
        declaredEntryCount: 4,
        readableEntryCount: 4,
        complete: true,
        masked: true,
        supported: true,
      })
      expect(nativeTrack?.phrases?.map(phrase => phrase.sourceLabel)).toEqual(['Intro 1', 'Up 2', 'Chorus 1', 'Outro 1'])

      const selectedFile = new File([new Uint8Array([0])], 'production-path.wav', { type: 'audio/wav' })
      const match = matchFileToRekordboxTrack(selectedFile, nativeImport.library)
      expect(match?.track.trackId).toBe(nativeTrack?.trackId)
      const imported = mapRekordboxMatchToDrmvyz(match!, nativeImport.library)
      expect(imported.analysisSeed.rekordboxPssiIntegrity).toEqual(nativeTrack?.pssiIntegrity)

      const analyzed = await analyzeTrackBuffer(makeAudioBuffer(), {
        fftSize: 256,
        hopSize: 128,
        maxCurvePoints: 80,
        minSectionSec: 1,
        seed: imported.analysisSeed,
      })
      expect(analyzed.analysisSources).toMatchObject({ beatGrid: 'rekordbox', trackSections: 'rekordbox' })
      expect(analyzed.sections.map(section => [section.startSec, section.endSec])).toEqual([[0, 2], [2, 4], [4, 6], [6, 8]])
      expect(analyzed.analysisDiagnostics?.rekordbox).toMatchObject({
        pssiVersion: 1,
        pssiMasked: true,
        pssiComplete: true,
        pssiAccepted: true,
        nativeBeatGridFallbackUsed: false,
        nativeTrackSectionFallbackUsed: false,
      })

      const stored = boundTrackAnalysisForStorage(analyzed)
      const hydrated = withTrackAnalysisCompatibilityDefaults(JSON.parse(JSON.stringify(stored)) as TrackIntelligenceAnalysis)
      const remote = createRemoteRuntimeTrack({
        name: 'production-path.wav',
        url: 'https://example.test/production-path.wav',
        duration: 8,
        analysisRuntime: {
          ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
          status: 'complete',
          analysisVersion: CURRENT_ANALYSIS_VERSION,
          analysisKey: '',
          analysis: hydrated,
        },
      })
      expect(remote.importedAnalysisSeed?.rekordboxPssiIntegrity).toEqual(analyzed.rekordboxSourceData?.pssiIntegrity)
      expect(remote.analysisRuntime.analysis?.analysisSources?.trackSections).toBe('rekordbox')

      const timeline = resolveAuthoritativeTimeline({ analyzedSections: adaptMIAnalysis(hydrated), durationSec: 8 })
      expect(timeline.map(section => [section.startSec, section.endSec])).toEqual([[0, 2], [2, 4], [4, 6], [6, 8]])

      AudioFeatureBus.reset()
      const engine = new MusicIntelligenceEngine()
      engine.setSourceId('production-path-source', 'production-path-track')
      engine.setTrackAnalysis(hydrated)
      engine.resolveLyricsAt(6.01, 'discontinuous')
      const frame = AudioFeatureBus.getFrame()
      expect(getMusicIntelligenceSourceValue(frame, 'sectionType')).toBe(hydrated.sections[3]?.type)
      expect(getConditionSourceValue(frame, 'isOutro')).toBe(hydrated.sections[3]?.type === 'outro')
      expect(getConditionSourceValue(frame, 'isBridge')).toBe(hydrated.sections[3]?.type === 'bridge')
    } finally {
      await rm(root, { recursive: true, force: true })
      AudioFeatureBus.reset()
    }
  }, 30_000)
})
