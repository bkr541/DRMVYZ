import type { SharedPerformanceActionReason, SharedPerformanceProgram } from '../../../../features/performanceCore'
import type { PixGridGroupFrameEffect } from './PixGridFrameEffects'
import type { PixGridResolvedTransition } from './PixGridActionCues'
import type {
  PixGridAnimationMode,
  PixGridPaletteRole,
  PixGridPerformanceProgramId,
  PixGridState,
} from './PixGridTypes'

export type PixGridPerformanceTransition = 'cut' | 'fade' | 'wipeRows' | 'wipeColumns' | 'dissolve'
export type PixGridPerformanceBackgroundState = 'preset' | 'black' | 'dim' | 'lifted'
export type PixGridPerformanceLayerOpacityMode = 'set' | 'blend'

/** PixGrid-only action intent. Renderer objects and LaserDMX fixture state are deliberately excluded. */
export type PixGridPerformanceAction =
  | { type: 'setScene'; sceneId: string }
  | { type: 'setLayerActive'; layerId: string; active: boolean }
  | { type: 'setGroupActive'; groupId: string; active: boolean }
  | { type: 'setLayerOpacity'; layerId: string; opacity: number; mode?: PixGridPerformanceLayerOpacityMode }
  | { type: 'setGroupBrightness'; groupId: string; brightness: number }
  | { type: 'setPaletteRole'; target: 'all' | { layerId: string } | { groupId: string }; from?: PixGridPaletteRole; role: PixGridPaletteRole }
  | { type: 'flashGroup'; groupId: string; amount: number; paletteRole?: PixGridPaletteRole }
  | { type: 'revealRows'; target: 'all' | { layerId: string } | { groupId: string }; progress: number; from?: 'top' | 'bottom' | 'center' }
  | { type: 'revealColumns'; target: 'all' | { layerId: string } | { groupId: string }; progress: number; from?: 'left' | 'right' | 'center' }
  | { type: 'dissolveGroup'; groupId: string; amount: number }
  | { type: 'shiftGroup'; groupId: string; x?: number; y?: number }
  | { type: 'recruitLayer'; layerId: string; opacity?: number }
  | { type: 'changeAnimation'; layerId: string; animation: PixGridAnimationMode; speed?: number; amount?: number }
  | { type: 'changeAnimationSpeed'; target: 'all' | { layerId: string } | { groupId: string }; multiplier: number }
  | { type: 'reverseDirection'; target: 'all' | { layerId: string } | { groupId: string } }
  | { type: 'triggerFrame'; target: 'all' | { layerId: string } | { groupId: string }; step?: number }
  | { type: 'freeze'; active: boolean }
  | { type: 'clear' }
  | { type: 'restore' }
  | { type: 'setTransition'; transition: PixGridPerformanceTransition; durationBeats?: number }
  | { type: 'setDensity'; density: number }
  | { type: 'setBackgroundState'; state: PixGridPerformanceBackgroundState; brightness?: number }

export type PixGridPerformanceProgram = SharedPerformanceProgram<PixGridPerformanceAction>

export interface PixGridPerformanceRuntimeSnapshot {
  active: boolean
  programId: PixGridPerformanceProgramId | null
  programName: string | null
  sceneId: string | null
  variationId: string | null
  section: string
  sectionPhase: string
  sectionOccurrence: number
  dropOccurrence: number
  fourBarStage: number
  eightBarStage: number
  sixteenBarStage: number
  recentActionReasons: readonly SharedPerformanceActionReason[]
  recentActionTypes: readonly PixGridPerformanceAction['type'][]
  manualOverrideRoutes: readonly string[]
  fallbackState: string | null
  transition: PixGridPerformanceTransition | null
  activeEventEnvelopes: readonly string[]
  activeGroupEffects: readonly string[]
  deterministicIdentity: string
}

export interface PixGridResolvedPerformanceFrame {
  state: PixGridState
  snapshot: PixGridPerformanceRuntimeSnapshot
  appliedActions: readonly PixGridPerformanceAction[]
  groupEffects: readonly PixGridGroupFrameEffect[]
  transition: PixGridResolvedTransition | null
  actionLimitDecisions: readonly string[]
}
