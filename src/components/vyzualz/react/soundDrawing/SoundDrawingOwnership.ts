import {
  SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID,
  soundDrawingPerformanceShowUsesGenerator,
} from './SoundDrawingPerformanceShows'
import type { SoundDrawingPerformanceSettings } from './SoundDrawingPerformanceTypes'

export interface SoundDrawingOwnershipState {
  owner: 'manual' | 'authored'
  showName: string
  showRunning: boolean
  professionalScopeOwner: 'manual' | 'authored' | 'none'
  manualScopeControlsDisabled: boolean
  status: string
}

export function resolveSoundDrawingOwnership(
  settings: SoundDrawingPerformanceSettings,
): SoundDrawingOwnershipState {
  const show = SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID[settings.selectedShowId]
  const showUsesScope = soundDrawingPerformanceShowUsesGenerator(settings.selectedShowId, 'professionalScope')
  if (!settings.autoPerformance) {
    return {
      owner: 'manual',
      showName: show.name,
      showRunning: false,
      professionalScopeOwner: 'manual',
      manualScopeControlsDisabled: false,
      status: `${show.name} is selected but not running. Manual Sound Drawing controls own the output.`,
    }
  }
  return {
    owner: 'authored',
    showName: show.name,
    showRunning: true,
    professionalScopeOwner: showUsesScope ? 'authored' : 'none',
    manualScopeControlsDisabled: true,
    status: `${show.name} owns the authored output.${
      showUsesScope
        ? ' Genuine Pro Scope is active as a show-controlled layer; manual scope controls are read-only.'
        : ' This show has no Pro Scope layer, so manual Pro Scope is not rendered.'
    }`,
  }
}
