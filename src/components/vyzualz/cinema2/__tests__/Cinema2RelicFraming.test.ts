import { describe, expect, it } from 'vitest'
import { ARTIFACT_SPECS } from '../modules/artifactSculptures/ArtifactSpecs'
import { cross, defaults, norm, SIGNALS, sub, type ArtifactState, type Point } from '../modules/artifactSculptures/ArtifactDomain'

const spec = ARTIFACT_SPECS.find(candidate => candidate.id === 'relic')!
const target: Point = [0, .05, 0]
const dot = (a: Point, b: Point) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2]

function projection(position: Point, fov: number, aspect: number) {
  const forward = norm(sub(target, position))
  const right = norm(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  // Match the authored shared camera's 16:9 minimum aspect and 150-degree cap.
  const verticalTan = Math.min(Math.tan(75*Math.PI/180), Math.tan(fov*Math.PI/360)*Math.max(1, (16/9)/aspect))
  return (point: Point, radius: number) => {
    const relative = sub(point, position)
    const depth = dot(relative, forward) - radius
    if (depth <= .12) return Infinity
    // A sphere at each end conservatively encloses the rendered rod.
    return Math.max((Math.abs(dot(relative, right)) + radius)/(depth*verticalTan*aspect),
      (Math.abs(dot(relative, up)) + radius)/(depth*verticalTan))
  }
}

describe('Relic full-assembly camera framing', () => {
  it('keeps containment rails and inset channels in Wide Hold and Cinematic Reveal keyframes', () => {
    const positions = [spec.camera.wide, ...spec.camera.path]
    for (const active of [false, true]) {
      const values = defaults(spec)
      if (active) {
        for (const key of Object.keys(SIGNALS)) values[key] = key === 'vocalPresence' ? 0 : 1
        for (const control of spec.controls) values[control.key] = control.max
      }
      // 39 is the shared camera's safety minimum, including musical punch
      // when the existing 42-degree user FOV control is at its lower bound.
      const fov = active ? 39 : spec.camera.fov
      const projectors = positions.flatMap(position => [16/9, 4/3, 9/16].map(aspect => projection(position, fov, aspect)))
      for (const pattern of spec.patterns) for (let phase = 0; phase < 6.3; phase += .6) {
        const state: ArtifactState = { values, pattern, previous: pattern, transition: 1, phase, motion: active ? 1 : .8, flash: active ? 1 : .28, silence: 0, projectionPhase: 0, extraEnabled: true, palette: spec.palette }
        let maxExtent = 0
        let structural = 0
        spec.geometry(state, (a, b, radius, role) => {
          if (role === 0) structural++
          for (const project of projectors) maxExtent = Math.max(maxExtent, project(a, radius), project(b, radius))
        }, 'high')
        expect(structural).toBeGreaterThan(0)
        expect(maxExtent, `${pattern} phase=${phase} active=${active}`).toBeLessThan(1)
      }
    }
  })

  it('preserves the original orbit and Close Detail framing and authored scale control', () => {
    expect(spec.camera.orbitRadius ?? Math.hypot(...spec.camera.wide)).toBe(Math.hypot(0,-.6,11))
    expect(spec.camera.macro).toEqual([[0,-.6,11],[1.2,.6,9.5],[0,-1.9,9.7],[-2,.5,10],[0,-.6,11]])
    expect(spec.camera.fov).toBe(46)
    const scale = spec.controls.find(control => control.key === 'skullScale')!
    expect([scale.min, scale.value, scale.max, scale.step]).toEqual([.7,1,1.2,.01])
  })
})
