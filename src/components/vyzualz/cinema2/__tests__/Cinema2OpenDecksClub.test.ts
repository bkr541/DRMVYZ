import { expect, it } from 'vitest'
import * as THREE from 'three'
import { Cinema2OpenDecksClubController } from '../modules/Cinema2OpenDecksClubModule'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'

function setup() {
  const root = new THREE.Group(), deck = new THREE.Object3D()
  deck.position.set(1, 2, 3); root.add(deck)
  const parts = Array.from({ length: 6 }, (_, index) => {
    const body = new THREE.Object3D(), arm = new THREE.Object3D()
    body.position.set(index, 12, -3)
    body.scale.set(.5, .25, 2) // Quantized GLB node scale must survive reparenting.
    body.userData = { clubActor: index, clubRow: index, clubRole: 'body', clubPivot: [index, 12, -7.16] }
    arm.position.set(index + .7, 12, -1)
    arm.userData = { clubActor: index, clubRole: 'left', clubPivot: [index + .5, 12, -2] }
    root.add(body, arm)
    return { body, arm }
  })
  root.updateMatrixWorld(true)
  const before = parts.map(({ body, arm }) => [body.matrixWorld.clone(), arm.matrixWorld.clone()])
  const controller = new Cinema2OpenDecksClubController({ THREE } as Cinema2ThreeLibrary)
  controller.attach(root); root.updateMatrixWorld(true)
  return { root, deck, parts, before, controller }
}
function frame(elapsed: number, paused = false): Cinema2ModuleUpdateContext {
  return { frame: {
    deltaTimeSec: 1 / 30, elapsedTimeSec: elapsed,
    transport: { sourcePresent: true, animationActive: !paused, paused, bpmSync: true, bpm: 120 },
    audio: { rhythm: { bpm: { available: true, value: 120 } }, features: { overallEnergy: { available: true, value: .8 } } },
  } } as unknown as Cinema2ModuleUpdateContext
}

it('preserves imported body/arm placement and scale before animating only the crowd', () => {
  const { root, deck, parts, before, controller } = setup()
  parts.forEach(({ body, arm }, i) => {
    expect(body.matrixWorld.elements).toEqual(before[i][0].elements)
    expect(arm.matrixWorld.elements).toEqual(before[i][1].elements)
    expect(body.scale.toArray()).toEqual([.5, .25, 2])
  })
  controller.update(frame(0)); controller.beforeDraw('high'); root.updateMatrixWorld(true)
  const initial = parts[0].arm.matrixWorld.clone()
  for (let i = 1; i <= 15; i++) controller.update(frame(i / 30))
  controller.beforeDraw('high'); root.updateMatrixWorld(true)
  expect(parts[0].arm.matrixWorld.elements).not.toEqual(initial.elements)
  expect(deck.position.toArray()).toEqual([1, 2, 3])
})

it('freezes crowd and beams while a real source is paused, then resumes', () => {
  const { controller, root, parts } = setup()
  controller.update(frame(0)); controller.update(frame(.033)); controller.beforeDraw('high'); root.updateMatrixWorld(true)
  const paused = parts[0].arm.matrixWorld.clone()
  for (let i = 1; i <= 30; i++) controller.update(frame(i / 30, true))
  controller.beforeDraw('high'); root.updateMatrixWorld(true)
  expect(parts[0].arm.matrixWorld.elements).toEqual(paused.elements)
  controller.update(frame(1.033)); controller.beforeDraw('high'); root.updateMatrixWorld(true)
  expect(parts[0].arm.matrixWorld.elements).not.toEqual(paused.elements)
})

it('reduces the crowd by quality and releases controller references without owning GPU assets', () => {
  const { controller, parts } = setup()
  const visible = () => parts.filter(({ body }) => body.parent!.visible).length
  controller.beforeDraw('high'); expect(visible()).toBe(6)
  controller.beforeDraw('medium'); expect(visible()).toBe(4)
  controller.beforeDraw('low'); expect(visible()).toBe(2)
  const previous = parts[0].body.parent!.rotation.clone()
  controller.dispose(); controller.update(frame(10)); controller.beforeDraw('high')
  expect(parts[0].body.parent!.rotation.toArray()).toEqual(previous.toArray())
})
