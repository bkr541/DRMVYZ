import { describe, expect, it } from 'vitest'
import { ARTIFACT_SPECS } from '../modules/artifactSculptures/ArtifactSpecs'
import { cross, defaults, norm, SIGNALS, sub, type ArtifactState, type Point } from '../modules/artifactSculptures/ArtifactDomain'

const spec = ARTIFACT_SPECS.find(candidate => candidate.id === 'seraph')!
// Match the shared artifact camera's target and 16:9 minimum-aspect composition.
const target: Point = [0, .05, 0]
const dot = (a: Point, b: Point) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
const aspects = [16/9, 4/3, 9/16]

function projection(position: Point, fov: number, aspect: number) {
  const forward = norm(sub(target, position))
  const right = norm(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  const verticalTan = Math.min(Math.tan(75*Math.PI/180), Math.tan(fov*Math.PI/360)*Math.max(1, (16/9)/aspect))
  return (point: Point, radius: number) => {
    const relative = sub(point, position)
    // A sphere at each rod endpoint conservatively bounds the cylinder radius.
    const depth = dot(relative, forward) - radius
    if (depth <= .12) return Infinity
    return Math.max((Math.abs(dot(relative, right)) + radius)/(depth*verticalTan*aspect),
      (Math.abs(dot(relative, up)) + radius)/(depth*verticalTan))
  }
}

describe('Seraph full-sculpture camera framing', () => {
  it('preserves the six-wing geometry inside Wide Hold and Cinematic Reveal keyframes at supported aspects', () => {
    // Do not constrain Close Detail: it is an explicitly selected close-up.
    const positions = [spec.camera.wide, ...spec.camera.path]
    for (const active of [false, true]) {
      const values = defaults(spec)
      if (active) {
        for (const key of Object.keys(SIGNALS)) values[key] = key === 'vocalPresence' ? 0 : 1
        values.span = spec.controls.find(control => control.key === 'span')!.max
      }
      // Reserve the existing maximum drop (-3 degrees) and kick (-.55 degrees) punch.
      const projectors = positions.flatMap(position => aspects.map(aspect => projection(position, spec.camera.fov - (active ? 3.55 : 0), aspect)))
      for (const pattern of spec.patterns) for (let phase = 0; phase < 6.3; phase += .6) {
        const state: ArtifactState = { values, pattern, previous: pattern, transition: 1, phase, motion: .8, flash: .28, silence: 0, projectionPhase: 0, extraEnabled: true, palette: spec.palette }
        let maxExtent = 0
        let count = 0
        spec.geometry(state, (a, b, radius) => {
          count++
          for (const project of projectors) maxExtent = Math.max(maxExtent, project(a, radius), project(b, radius))
        }, 'high')
        expect(count).toBeGreaterThan(100)
        expect(maxExtent, `${pattern} phase=${phase} active=${active}`).toBeLessThan(.98)
      }
    }
  })
})
