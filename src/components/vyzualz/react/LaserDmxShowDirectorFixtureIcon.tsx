import type { CSSProperties } from 'react'
import type { LaserDmxShowDirectorFixtureKind } from './ReactTypes'

interface LaserDmxShowDirectorFixtureIconProps {
  kind: LaserDmxShowDirectorFixtureKind
  color?: string
  className?: string
  style?: CSSProperties
}

function iconStyle(color: string | undefined, style: CSSProperties | undefined): CSSProperties | undefined {
  if (!color) return style
  return {
    '--fixture-color': color,
    color,
    ...style,
  } as CSSProperties
}

function iconClass(kindClass: string, className?: string): string {
  return ['rv-show-director-fixture-icon', kindClass, className].filter(Boolean).join(' ')
}

export function LaserDmxShowDirectorFixtureIcon({ kind, color, className, style }: LaserDmxShowDirectorFixtureIconProps) {
  const resolvedStyle = iconStyle(color, style)

  switch (kind) {
    case 'laser':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--laser', className)} style={resolvedStyle} aria-hidden="true">
          <span className="rv-show-director-fixture-icon__fan" />
          <span className="rv-show-director-fixture-icon__body" />
          <span className="rv-show-director-fixture-icon__lens" />
        </span>
      )
    case 'movingHead':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--moving-head', className)} style={resolvedStyle} aria-hidden="true">
          <span className="rv-show-director-fixture-icon__cone" />
          <span className="rv-show-director-fixture-icon__yoke" />
          <span className="rv-show-director-fixture-icon__head" />
          <span className="rv-show-director-fixture-icon__base" />
        </span>
      )
    case 'ledBar':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--led-bar', className)} style={resolvedStyle} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </span>
      )
    case 'ledTube':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--led-tube', className)} style={resolvedStyle} aria-hidden="true">
          <span />
        </span>
      )
    case 'strobe':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--strobe', className)} style={resolvedStyle} aria-hidden="true">
          <span className="rv-show-director-fixture-icon__burst" />
          <span className="rv-show-director-fixture-icon__plate" />
        </span>
      )
    case 'blinder':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--blinder', className)} style={resolvedStyle} aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
        </span>
      )
    case 'parWash':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--par-wash', className)} style={resolvedStyle} aria-hidden="true">
          <span className="rv-show-director-fixture-icon__wash" />
          <span className="rv-show-director-fixture-icon__can" />
        </span>
      )
    case 'videoWall':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--video-wall', className)} style={resolvedStyle} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </span>
      )
    case 'haze':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--haze', className)} style={resolvedStyle} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )
    case 'co2Jet':
      return (
        <span className={iconClass('rv-show-director-fixture-icon--co2', className)} style={resolvedStyle} aria-hidden="true">
          <span className="rv-show-director-fixture-icon__plume" />
          <span className="rv-show-director-fixture-icon__jet" />
        </span>
      )
    default:
      return null
  }
}
