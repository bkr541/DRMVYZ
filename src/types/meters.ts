export interface LoudnessReading {
  momentary: number
  shortTerm: number
  integrated: number
  truePeak: number
  rms: number
  peak: number
  crestFactor: number
  dynamicRange: number
  isClipping: boolean
}

export interface StereoReading {
  phaseCorrelation: number
  stereoWidth: number
  midLevel: number
  sideLevel: number
  lLevel: number
  rLevel: number
  monoCompatibility: 'good' | 'caution' | 'warning'
}

export interface TonalBalance {
  sub: number
  bass: number
  lowMid: number
  mid: number
  highMid: number
  presence: number
  air: number
}

export type IssueSeverity = 'info' | 'warning' | 'critical'

export type IssueType =
  | 'sub'
  | 'mud'
  | 'harshness'
  | 'clipping'
  | 'phase'
  | 'dynamic'
  | 'lowStereo'
  | 'overcompressed'
  | 'resonance'
  | 'masking'

export interface MasteringIssue {
  type: IssueType
  severity: IssueSeverity
  headline: string
  detail: string
  suggestion: string
}
