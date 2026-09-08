import type { AfterhoursPattern } from '../../../CinematicWorldSettings'
import type { AfterhoursRigRole } from './AfterhoursVirtualStageRig'

export type AfterhoursSceneTopology =
  | 'mirroredFan'
  | 'splitWings'
  | 'crossCanopy'
  | 'diamondStar'
  | 'chevronRoof'
  | 'radialCrown'
  | 'sparseHero'
  | 'fullRig'

export interface AfterhoursSceneDefinition {
  readonly id: AfterhoursPattern
  readonly label: string
  readonly fixtureRoles: readonly AfterhoursRigRole[]
  readonly topology: AfterhoursSceneTopology
  readonly symmetry: 'bilateral' | 'radial'
  readonly centerAperture: Readonly<{ protected: boolean; minWidth: number }>
  readonly density: Readonly<{ minBeams: number; maxBeams: number; role: 'sparse' | 'balanced' | 'dense' }>
  readonly colorRoles: readonly ('primary' | 'accent')[]
  readonly staticPose: Readonly<{ spreadScale: number; centerBias: number; elevationBias: number }>
  readonly scanPath?: Readonly<{ kind: 'polyline'; points: readonly Readonly<{ x: number; y: number }>[] }>
}

const scene = (definition: AfterhoursSceneDefinition): AfterhoursSceneDefinition => Object.freeze({
  ...definition,
  fixtureRoles: Object.freeze([...definition.fixtureRoles]),
  colorRoles: Object.freeze([...definition.colorRoles]),
  centerAperture: Object.freeze({ ...definition.centerAperture }),
  density: Object.freeze({ ...definition.density }),
  staticPose: Object.freeze({ ...definition.staticPose }),
  scanPath: definition.scanPath ? Object.freeze({
    kind: definition.scanPath.kind,
    points: Object.freeze(definition.scanPath.points.map(point => Object.freeze({ ...point }))),
  }) : undefined,
})

export const AFTERHOURS_SCENE_CATALOG: readonly AfterhoursSceneDefinition[] = Object.freeze([
  scene({
    id: 'wideFan', label: 'Wide Fan', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'mirroredFan', symmetry: 'bilateral',
    centerAperture: { protected: true, minWidth: 0.12 }, density: { minBeams: 2, maxBeams: 16, role: 'balanced' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 1.18, centerBias: 0.16, elevationBias: 0.14 },
  }),
  scene({
    id: 'splitWings', label: 'Split Wings', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'splitWings', symmetry: 'bilateral',
    centerAperture: { protected: true, minWidth: 0.22 }, density: { minBeams: 2, maxBeams: 16, role: 'balanced' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 1.08, centerBias: 0.28, elevationBias: 0.08 },
  }),
  scene({
    id: 'crossCanopy', label: 'Cross Canopy', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'crossCanopy', symmetry: 'bilateral',
    centerAperture: { protected: false, minWidth: 0 }, density: { minBeams: 4, maxBeams: 16, role: 'balanced' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 0.96, centerBias: 0.5, elevationBias: 0.34 },
  }),
  scene({
    id: 'diamondStar', label: 'Diamond / Star', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'diamondStar', symmetry: 'bilateral',
    centerAperture: { protected: true, minWidth: 0.08 }, density: { minBeams: 4, maxBeams: 16, role: 'balanced' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 0.82, centerBias: 0.5, elevationBias: 0.5 },
    scanPath: { kind: 'polyline', points: [{ x: 0.5, y: 0.86 }, { x: 0.72, y: 0.5 }, { x: 0.5, y: 0.14 }, { x: 0.28, y: 0.5 }, { x: 0.5, y: 0.86 }] },
  }),
  scene({
    id: 'chevronRoof', label: 'Chevron / Roof', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'chevronRoof', symmetry: 'bilateral',
    centerAperture: { protected: true, minWidth: 0.1 }, density: { minBeams: 4, maxBeams: 16, role: 'balanced' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 0.92, centerBias: 0.5, elevationBias: 0.74 },
  }),
  scene({
    id: 'radialCrown', label: 'Radial Burst / Crown', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'radialCrown', symmetry: 'radial',
    centerAperture: { protected: true, minWidth: 0.08 }, density: { minBeams: 4, maxBeams: 16, role: 'dense' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 1.12, centerBias: 0.5, elevationBias: 0.68 },
  }),
  scene({
    id: 'sparseArchitecture', label: 'Sparse Architecture', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'sparseHero', symmetry: 'bilateral',
    centerAperture: { protected: true, minWidth: 0.24 }, density: { minBeams: 2, maxBeams: 4, role: 'sparse' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 1.02, centerBias: 0.38, elevationBias: 0.62 },
  }),
  scene({
    id: 'fullRig', label: 'Full Rig', fixtureRoles: ['lower', 'leftWing', 'rightWing', 'overhead'], topology: 'fullRig', symmetry: 'bilateral',
    centerAperture: { protected: true, minWidth: 0.08 }, density: { minBeams: 8, maxBeams: 16, role: 'dense' }, colorRoles: ['primary', 'accent'],
    staticPose: { spreadScale: 1, centerBias: 0.42, elevationBias: 0.42 },
  }),
])

export const AFTERHOURS_SCENE_IDS = Object.freeze(AFTERHOURS_SCENE_CATALOG.map(candidate => candidate.id)) as readonly AfterhoursPattern[]

const BY_ID = new Map(AFTERHOURS_SCENE_CATALOG.map(candidate => [candidate.id, candidate]))

export function getAfterhoursSceneDefinition(id: AfterhoursPattern): AfterhoursSceneDefinition {
  return BY_ID.get(id) ?? BY_ID.get('wideFan')!
}
