import type { CSSProperties } from 'react'
import { AppIcon, type AppIconKind } from '../../shared/icons/AppIcon'
import type { LaserDmxShowDirectorFixtureKind } from './ReactTypes'

export const FIXTURE_ICON_KINDS = {
  laser: 'laser', movingHead: 'movingHead', ledBar: 'ledBar', ledTube: 'ledTube',
  strobe: 'strobe', blinder: 'blinder', parWash: 'wash', videoWall: 'videoWall', haze: 'haze', co2Jet: 'co2',
} as const satisfies Record<LaserDmxShowDirectorFixtureKind, AppIconKind>

interface LaserDmxShowDirectorFixtureIconProps {
  kind: LaserDmxShowDirectorFixtureKind
  color?: string
  className?: string
  style?: CSSProperties
}

/** Palette, inspector, and stage share the approved fixture drawings and retain fixture colors. */
export function LaserDmxShowDirectorFixtureIcon({ kind, color, className, style }: LaserDmxShowDirectorFixtureIconProps) {
  const resolvedStyle = { ...(color ? { '--fixture-color': color, color } : {}), ...style, '--app-icon-accent': 'currentColor' } as CSSProperties
  return (
    <span className={`rv-show-director-fixture-icon${className ? ` ${className}` : ''}`} style={resolvedStyle} aria-hidden="true">
      <AppIcon kind={FIXTURE_ICON_KINDS[kind]} size="100%" style={{ display: 'block', height: '100%' }} />
    </span>
  )
}
