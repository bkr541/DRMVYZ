import type { MainLogEntry } from '../../../../lib/mainLogParser'
import type { RekordboxIndexStatus } from '../../../../features/rekordboxImport/nativeBridge'

// Placeholder data for Layout Lab's Settings pop-up: a signed-in profile, a synced Rekordbox index, and a main.log with
// every level and component so the Developer tab's table, filters and expandable rows have something to show.

export const ST_PROFILE = { email: 'kody@drmvyz.com', displayName: 'Kody Robinson', artistName: 'DVYDRM' }

export const ST_REKORDBOX_STATUS: RekordboxIndexStatus = {
  available: true,
  selectedRootPath: '/Volumes/DJ-USB/PIONEER',
  selectedRootName: 'PIONEER',
  hasIndex: true,
  syncedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  parserMode: 'native',
  trackCount: 2418,
  detectedPdbFiles: 1,
  detectedAnlzFiles: 2391,
  warningCount: 0,
}

const entry = (index: number, level: MainLogEntry['level'], component: MainLogEntry['component'], scope: string, message: string): MainLogEntry => ({
  id: `st-log-${index}`,
  timestamp: Date.UTC(2026, 9, 25, 18, 4, 11, 120) + index * 1_840,
  timestampRaw: new Date(Date.UTC(2026, 9, 25, 18, 4, 11, 120) + index * 1_840).toISOString().replace('T', ' ').replace('Z', ''),
  level,
  component,
  scope,
  message,
})

export const ST_LOG_ENTRIES: MainLogEntry[] = [
  entry(1, 'info', 'system', 'system:main', 'DRMVYZ 1.8.4 started (darwin arm64, Electron 33)'),
  entry(2, 'info', 'auth', 'auth:session', 'Session restored for kody@drmvyz.com'),
  entry(3, 'debug', 'react', 'react:WebGL2Renderer', 'Context created: 3840×2160, MSAA 4×, quality High'),
  entry(4, 'info', 'rekordbox', 'rekordbox:index', 'Index loaded: 2,418 tracks, 2,391 ANLZ files'),
  entry(5, 'warn', 'output', 'output:cast', 'Display "LG HDR 4K" reported 59.94 Hz; locking output to 60 Hz'),
  entry(6, 'info', 'music-intelligence', 'music-intelligence:engine', 'Analysis complete for "Neon Cathedral" in 6.2 s (129 BPM, 8A)'),
  entry(7, 'verbose', 'lyrics', 'lyrics:playback', 'Cue 12 active at 51.000 s'),
  entry(8, 'info', 'brand-kit', 'brand-kit:sync', 'Active kit "DVYDRM Brand Kit" synced'),
  entry(9, 'error', 'show-manager', 'show-manager:director', 'Failed to compile scene "Prismatic Impact"\nError: shader link failed\n    at compileScene (director.ts:218:11)\n    at runDirector (director.ts:87:5)'),
  entry(10, 'debug', 'settings', 'settings:appearance', 'Theme set to dark (synced)'),
  entry(11, 'silly', 'react', 'react:AudioFeatureBus', 'frame 48211 energy=0.71 bass=0.64'),
  entry(12, 'warn', 'rekordbox', 'rekordbox:anlz', '14 tracks have no beat grid; falling back to detected beats'),
  entry(13, 'info', 'output', 'output:window', 'Output window opened on display 2 (1920×1080)'),
  entry(14, 'error', 'auth', 'auth:token', 'Token refresh failed (network offline); retrying in 30 s'),
]
