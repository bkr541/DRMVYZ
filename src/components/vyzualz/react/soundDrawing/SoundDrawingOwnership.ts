import {
  SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID,
  soundDrawingPerformanceShowUsesGenerator,
} from './SoundDrawingPerformanceShows'
import type { SoundDrawingPerformanceSettings } from './SoundDrawingPerformanceTypes'

export type SoundDrawingOwnershipKind = 'manual' | 'program' | 'mixed' | 'unavailable'
export type SoundDrawingControlDomain =
  | 'source'
  | 'geometry'
  | 'motion'
  | 'topology'
  | 'echo'
  | 'glow'
  | 'trails'
  | 'reaction'
  | 'scope'
  | 'performanceIntensity'
  | 'presentation'

export interface SoundDrawingDomainOwnership {
  owner: SoundDrawingOwnershipKind
  editable: boolean
  label: 'Manual' | 'Program' | 'Mixed' | 'Unavailable'
  reason: string
  ariaDescription: string
}

export interface SoundDrawingOwnershipState {
  /** Compatibility summary retained for existing diagnostics. */
  owner: 'manual' | 'authored'
  showName: string
  showRunning: boolean
  professionalScopeOwner: 'manual' | 'authored' | 'none'
  manualScopeControlsDisabled: boolean
  status: string
  domains: Record<SoundDrawingControlDomain, SoundDrawingDomainOwnership>
}

function domain(
  owner: SoundDrawingOwnershipKind,
  editable: boolean,
  reason: string,
): SoundDrawingDomainOwnership {
  const label = owner === 'program'
    ? 'Program'
    : owner === 'mixed'
      ? 'Mixed'
      : owner === 'unavailable'
        ? 'Unavailable'
        : 'Manual'
  return {
    owner,
    editable,
    label,
    reason,
    ariaDescription: `${label} ownership. ${reason}`,
  }
}

export function resolveSoundDrawingOwnership(
  settings: SoundDrawingPerformanceSettings,
): SoundDrawingOwnershipState {
  const show = settings.selectedShowId == null
    ? null
    : SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID[settings.selectedShowId]
  const showUsesScope = settings.selectedShowId == null
    ? false
    : soundDrawingPerformanceShowUsesGenerator(settings.selectedShowId, 'professionalScope')
  if (show == null) {
    const manual = domain('manual', true, 'The manual control value is the resolved runtime input.')
    return {
      owner: 'manual',
      showName: 'No Performance Show',
      showRunning: false,
      professionalScopeOwner: 'manual',
      manualScopeControlsDisabled: false,
      status: 'No Performance Show preset is selected. The base Classic Scope, Built-in Shape, Text, or SVG source owns the output.',
      domains: {
        source: manual,
        geometry: manual,
        motion: manual,
        topology: manual,
        echo: manual,
        glow: manual,
        trails: manual,
        reaction: manual,
        scope: manual,
        performanceIntensity: manual,
        presentation: manual,
      },
    }
  }


  const program = domain(
    'program',
    false,
    settings.autoPerformance
      ? `${show.name} supplies this value as part of its authored scene choreography.`
      : `${show.name} supplies this value as part of its stable base design.`,
  )
  const mixedGeometry = domain(
    'mixed',
    true,
    'Show Size scales the complete authored composition without replacing its generators or layer structure.',
  )
  const mixedIntensity = domain(
    'mixed',
    true,
    'The control scales authored choreography while the show retains source, generator, and scene ownership.',
  )
  const scope = showUsesScope
    ? domain('program', false, `${show.name} supplies the live Pro Scope layer and its signal presentation.`)
    : domain('unavailable', false, `${show.name} does not use a Pro Scope layer.`)

  return {
    owner: 'authored',
    showName: show.name,
    showRunning: true,
    professionalScopeOwner: showUsesScope ? 'authored' : 'none',
    manualScopeControlsDisabled: true,
    status: settings.autoPerformance
      ? `${show.name} owns its source, generators, layers, and section choreography. Auto Performance is on.`
      : `${show.name} base design is active. Auto Performance is off, so section choreography is paused while the selected visual remains loaded.`,
    domains: {
      source: program,
      geometry: mixedGeometry,
      motion: mixedIntensity,
      topology: program,
      echo: program,
      glow: mixedIntensity,
      trails: mixedIntensity,
      reaction: mixedIntensity,
      scope,
      performanceIntensity: mixedIntensity,
      presentation: program,
    },
  }
}

export function soundDrawingOwnershipTooltip(ownership: SoundDrawingDomainOwnership): string {
  return `${ownership.label}: ${ownership.reason}`
}
