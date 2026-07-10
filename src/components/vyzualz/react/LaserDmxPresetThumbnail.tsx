import { useMemo } from 'react'
import type {
  LaserDmxBeamMatrixPreset,
  LaserDmxMatrixBeamColor,
  LaserDmxShowDirectorFixtureKind,
} from './ReactTypes'
import type { LaserDmxShowDirectorTemplate } from './laserDmxShowDirectorTemplates'

const MATRIX_COLUMNS = 15
const MATRIX_ROWS = 10

function beamColorToCss(color: LaserDmxMatrixBeamColor): string {
  const white = Math.max(0, Math.min(255, color.white))
  const red = Math.max(0, Math.min(255, color.red + white))
  const green = Math.max(0, Math.min(255, color.green + white))
  const blue = Math.max(0, Math.min(255, color.blue + white))
  return `rgb(${red}, ${green}, ${blue})`
}

function matrixCoordinate(column: number, row: number): { x: number; y: number } {
  return {
    x: 7 + ((column - 1) / (MATRIX_COLUMNS - 1)) * 98,
    y: 8 + ((row - 1) / (MATRIX_ROWS - 1)) * 108,
  }
}

function stageCoordinate(x: number, y: number): { x: number; y: number } {
  return {
    x: 7 + Math.max(0, Math.min(1, x)) * 98,
    y: 8 + Math.max(0, Math.min(1, y)) * 108,
  }
}

export function getBeamMatrixPresetPalette(preset: LaserDmxBeamMatrixPreset): string[] {
  const settings = preset.createSettings()
  const colors = [
    ...settings.groups.filter(group => group.colorOverrideEnabled).map(group => beamColorToCss(group.color)),
    ...settings.beams.filter(beam => !beam.useGroupColor).map(beam => beamColorToCss(beam.color)),
  ]
  return Array.from(new Set(colors)).slice(0, 5)
}

export function BeamMatrixPresetThumbnail({ preset }: { preset: LaserDmxBeamMatrixPreset }) {
  const settings = useMemo(() => preset.createSettings(), [preset])
  const groupsById = useMemo(() => new Map(settings.groups.map(group => [group.id, group])), [settings.groups])

  return (
    <div className="rv-preset-thumb rv-laser-dmx-preset-thumb" aria-hidden="true" data-thumbnail-kind="beam-matrix">
      <svg className="rv-laser-dmx-preset-thumb-svg" viewBox="0 0 112 124" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`beam-thumb-bg-${preset.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#020508" />
            <stop offset="1" stopColor="#07151b" />
          </linearGradient>
        </defs>
        <rect width="112" height="124" fill={`url(#beam-thumb-bg-${preset.id})`} />
        {Array.from({ length: 5 }, (_, index) => (
          <line key={`v-${index}`} x1={7 + index * 24.5} y1="8" x2={7 + index * 24.5} y2="116" className="rv-laser-dmx-preset-thumb-grid" />
        ))}
        {Array.from({ length: 4 }, (_, index) => (
          <line key={`h-${index}`} x1="7" y1={8 + index * 36} x2="105" y2={8 + index * 36} className="rv-laser-dmx-preset-thumb-grid" />
        ))}
        {settings.beams.slice(0, 36).map((beam, index) => {
          const origin = matrixCoordinate(beam.origin.column, beam.origin.row)
          const target = beam.target.kind === 'grid'
            ? matrixCoordinate(beam.target.column, beam.target.row)
            : stageCoordinate(beam.target.x, beam.target.y)
          const group = beam.groupId ? groupsById.get(beam.groupId) : null
          const color = beam.useGroupColor && group ? beamColorToCss(group.color) : beamColorToCss(beam.color)
          const isCone = beam.appearance.geometry === 'volumetricCone'
          return (
            <g key={beam.id || index}>
              {isCone && (
                <line
                  x1={origin.x}
                  y1={origin.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={color}
                  strokeWidth={Math.max(4, beam.appearance.width * 2.2)}
                  strokeOpacity="0.12"
                  strokeLinecap="round"
                />
              )}
              <line
                x1={origin.x}
                y1={origin.y}
                x2={target.x}
                y2={target.y}
                stroke={color}
                strokeWidth={isCone ? 1.8 : 1.15}
                strokeOpacity={Math.max(0.4, beam.appearance.dimmer)}
                strokeLinecap="round"
              />
              <circle cx={origin.x} cy={origin.y} r="1.5" fill={color} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const FIXTURE_SHAPES: Record<LaserDmxShowDirectorFixtureKind, 'circle' | 'square' | 'bar' | 'diamond'> = {
  laser: 'diamond',
  movingHead: 'circle',
  ledBar: 'bar',
  ledTube: 'bar',
  strobe: 'square',
  blinder: 'square',
  parWash: 'circle',
  haze: 'circle',
  co2Jet: 'diamond',
  videoWall: 'square',
}

export function getShowDirectorTemplatePalette(template: LaserDmxShowDirectorTemplate): string[] {
  return Array.from(new Set(template.fixtures.map(fixture => fixture.color).filter((color): color is string => typeof color === 'string'))).slice(0, 5)
}

export function ShowDirectorTemplateThumbnail({ template }: { template: LaserDmxShowDirectorTemplate }) {
  const columns = Math.max(1, template.settings?.gridSize?.columns ?? MATRIX_COLUMNS)
  const rows = Math.max(1, template.settings?.gridSize?.rows ?? MATRIX_ROWS)
  const point = (x: number, y: number) => ({
    x: 7 + (Math.max(0, Math.min(columns - 1, x)) / Math.max(1, columns - 1)) * 98,
    y: 8 + (Math.max(0, Math.min(rows - 1, y)) / Math.max(1, rows - 1)) * 108,
  })

  return (
    <div className="rv-preset-thumb rv-laser-dmx-preset-thumb" aria-hidden="true" data-thumbnail-kind="show-director">
      <svg className="rv-laser-dmx-preset-thumb-svg" viewBox="0 0 112 124" preserveAspectRatio="none">
        <rect width="112" height="124" fill="#020508" />
        <path d="M7 116 L56 10 L105 116 Z" fill="rgba(74,199,219,.035)" stroke="rgba(74,199,219,.12)" strokeWidth="0.8" />
        {template.fixtures.slice(0, 36).map((fixture, index) => {
          const location = point(fixture.x ?? 0, fixture.y ?? 0)
          const target = point(fixture.beam?.targetX ?? fixture.x ?? 0, fixture.beam?.targetY ?? Math.max(0, (fixture.y ?? 0) - 2))
          const color = fixture.color ?? '#4ac7db'
          const shape = FIXTURE_SHAPES[fixture.kind]
          const rendersBeam = fixture.kind === 'laser' || fixture.kind === 'movingHead' || fixture.kind === 'parWash'
          return (
            <g key={`${template.id}-${index}`}>
              {rendersBeam && (
                <line
                  x1={location.x}
                  y1={location.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={color}
                  strokeOpacity="0.42"
                  strokeWidth={fixture.kind === 'parWash' ? 4 : 1.2}
                  strokeLinecap="round"
                />
              )}
              {shape === 'circle' && <circle cx={location.x} cy={location.y} r="2.8" fill={color} />}
              {shape === 'square' && <rect x={location.x - 2.5} y={location.y - 2.5} width="5" height="5" rx="0.8" fill={color} />}
              {shape === 'bar' && <rect x={location.x - 4} y={location.y - 1.5} width="8" height="3" rx="1" fill={color} />}
              {shape === 'diamond' && <path d={`M${location.x} ${location.y - 3.3} L${location.x + 3.3} ${location.y} L${location.x} ${location.y + 3.3} L${location.x - 3.3} ${location.y} Z`} fill={color} />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
