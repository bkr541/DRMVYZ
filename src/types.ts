export interface Track {
  id: string
  name: string
  displayName: string
  url: string
  duration: number
}

export type LayoutPreset = '16:9' | '9:16' | '1:1'

export type Theme = 'cyan-green' | 'cyan-blue' | 'green-gold' | 'purple-cyan'

export interface VisualizerSettings {
  displayNameOverride: string
  accentIntensity: number
  showScanlines: boolean
  showGlow: boolean
  showGrid: boolean
  showLogo: boolean
  theme: Theme
  recordingMode: boolean
}
