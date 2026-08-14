import type {
  LaserDmxLaunchSettings,
  LaserDmxMatrixBeam,
  LaserDmxModulationRoute,
  LaserDmxReactionGroup,
} from './ReactTypes'

function assignedGroup(
  beam: Pick<LaserDmxMatrixBeam, 'groupId'>,
  groups: readonly LaserDmxReactionGroup[],
): LaserDmxReactionGroup | null {
  if (!beam.groupId) return null
  return groups.find(group => group.id === beam.groupId) ?? null
}

/**
 * Beam ordering is only read by the compiler when the assigned reaction group
 * has sequencing enabled. Keep the saved index intact while the control is
 * hidden so enabling sequencing restores the authored value.
 */
export function laserDmxBeamConsumesSequenceIndex(
  beam: Pick<LaserDmxMatrixBeam, 'groupId'>,
  groups: readonly LaserDmxReactionGroup[],
): boolean {
  return assignedGroup(beam, groups)?.sequence?.enabled === true
}

/**
 * Retrigger policy is consulted only when an audio-launch event can fire for
 * the beam's assigned group. A disabled/muted group still owns this capability
 * because re-enabling it must not change which settings are authorable.
 */
export function laserDmxBeamConsumesRetrigger(
  beam: Pick<LaserDmxMatrixBeam, 'groupId'> & { motion?: LaserDmxMatrixBeam['motion'] },
  groups: readonly LaserDmxReactionGroup[],
): boolean {
  if (((beam.motion?.mode as string | undefined) ?? 'static') === 'static') return false
  const group = assignedGroup(beam, groups)
  return group?.launch?.trigger != null && group.launch.trigger !== 'none'
}

/** Threshold is only read for strength-bearing launch sources. */
export function laserDmxLaunchConsumesThreshold(
  launch: Pick<LaserDmxLaunchSettings, 'trigger'>,
): boolean {
  return launch.trigger === 'kick' || launch.trigger === 'snare' || launch.trigger === 'dropImpact'
}

/** Bar cooldown takes precedence over the legacy beat cooldown in the compiler. */
export function laserDmxLaunchConsumesCooldownBeats(
  launch: Pick<LaserDmxLaunchSettings, 'trigger' | 'cooldownBars'>,
): boolean {
  return launch.trigger !== 'none' && !(typeof launch.cooldownBars === 'number' && launch.cooldownBars > 0)
}

/** Trigger routes intentionally bypass curve shaping to preserve the event peak. */
export function laserDmxRouteConsumesCurve(
  route: Pick<LaserDmxModulationRoute, 'mode'>,
): boolean {
  return route.mode !== 'trigger'
}

/** Trigger routes use attack/hold/release envelopes, not continuous smoothing. */
export function laserDmxRouteConsumesSmoothing(
  route: Pick<LaserDmxModulationRoute, 'mode'>,
): boolean {
  return route.mode !== 'trigger'
}
