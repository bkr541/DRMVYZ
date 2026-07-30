import {
  SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID,
  soundDrawingPerformanceShowUsesGenerator,
} from './SoundDrawingPerformanceShows'
import type { SoundDrawingPerformanceSettings } from './SoundDrawingPerformanceTypes'

export type SoundDrawingOwnershipKind = 'manual' | 'program' | 'locked' | 'mixed' | 'unavailable'
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
  label: 'Manual' | 'Program' | 'Locked' | 'Mixed' | 'Unavailable'
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
    : owner === 'locked'
      ? 'Locked'
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

function hasAnyLock(settings: SoundDrawingPerformanceSettings, keys: readonly (keyof SoundDrawingPerformanceSettings['locks'])[]) {
  return keys.some(key => settings.locks[key])
}

export function resolveSoundDrawingOwnership(
  settings: SoundDrawingPerformanceSettings,
): SoundDrawingOwnershipState {
  const show = SOUND_DRAWING_PERFORMANCE_SHOW_BY_ID[settings.selectedShowId]
  const showUsesScope = soundDrawingPerformanceShowUsesGenerator(settings.selectedShowId, 'professionalScope')
  if (!settings.autoPerformance) {
    const manual = domain('manual', true, 'The manual control value is the resolved runtime input.')
    return {
      owner: 'manual',
      showName: show.name,
      showRunning: false,
      professionalScopeOwner: 'manual',
      manualScopeControlsDisabled: false,
      status: `${show.name} is selected but not running. Manual Sound Drawing controls own the output.`,
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

  const sourceSelectionActive = settings.performanceSource !== 'generatedVisual'
  const sourceSelectionLocked = settings.locks.sourceSelection
  const scaleLocked = settings.locks.scale || settings.locks.transform
  const glowLocked = settings.locks.glow || settings.locks.ribbonGlow
  const reactionLocked = hasAnyLock(settings, ['reaction', 'contourReactivity', 'ribbonReaction'])
  const trailLocked = settings.locks.trail || settings.locks.trailBehavior || settings.locks.ribbonTrail

  const scope = showUsesScope
    ? domain('program', false, `${show.name} supplies the live Pro Scope layer, so manual scope edits cannot affect output.`)
    : domain('unavailable', false, `${show.name} has no Pro Scope layer in the current authored composition.`)
  const trails = trailLocked
    ? domain(
        'locked',
        true,
        settings.trailLockContract.mode === 'legacyRecipe'
          ? 'A versioned legacy recipe lock is active. Manual Trail Decay remains an authored-mix input rather than the protected final value.'
          : 'The captured manual Trail Decay is protected at final trail composition. Ribbon Trails and feedback remain separately owned.',
      )
    : domain('mixed', true, 'Manual Trail Decay participates in the authored persistence equation with program trail intensity, source trails and feedback.')

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
    domains: {
      source: !sourceSelectionActive
        ? domain('unavailable', false, 'Performance Source is Generated Show Visuals, so changing the manual source selector cannot affect the current composition.')
        : sourceSelectionLocked
          ? domain('locked', true, 'The selected manual source is protected and remains an input to the authored composition.')
          : domain('mixed', true, 'The manual source supplies artwork or signal input while the authored show controls its role and treatment.'),
      geometry: scaleLocked
        ? domain('locked', true, 'Manual Visual Size is protected by the Scale or Transform lock and remains the resolved base scale.')
        : domain('mixed', true, 'Manual Visual Size remains the base scale while the authored layer contributes its own scale and topology factors.'),
      motion: domain('mixed', true, 'Manual Motion scales authored movement and remains live during Auto Performance.'),
      topology: settings.locks.topology
        ? domain('locked', true, 'Manual Render Mode and mirror symmetry are protected by the Topology lock.')
        : domain('program', false, 'The authored layer resolves Render Mode and symmetry. Enable the Topology lock to use those manual controls.'),
      echo: settings.locks.topology || settings.locks.echoBehavior
        ? domain('locked', true, 'Manual Duplicate Traces is protected by the Topology or Echo Behavior lock.')
        : domain('program', false, 'The authored layer resolves trace count. Enable Topology or Echo Behavior lock to use Duplicate Traces.'),
      glow: glowLocked
        ? domain('locked', true, 'Manual glow is protected for the relevant authored layer.')
        : domain('mixed', true, 'Manual master Glow combines with authored layer glow and bloom.'),
      trails,
      reaction: reactionLocked
        ? domain('locked', true, 'Manual reaction depth is protected for the relevant authored layer.')
        : domain('mixed', true, 'Manual reaction masters scale authored modulation rather than replacing it.'),
      scope,
      performanceIntensity: domain('mixed', true, 'Manual intensity controls scale the authored program and remain live.'),
      presentation: domain('program', false, 'The authored program resolves rotation, camera, and presentation values for the active layer.'),
    },
  }
}

export function soundDrawingOwnershipTooltip(ownership: SoundDrawingDomainOwnership): string {
  return `${ownership.label}: ${ownership.reason}`
}
