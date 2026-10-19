/** Neutral tuple shared by Cinema 2.0 and older world renderers. */
export type CinemaSpatialVector3 = readonly [number, number, number]
export type CinemaSpatialColor = readonly [number, number, number, number]

export type CinemaWorld3DObjectNormalization =
  | Readonly<{ mode: 'none' }>
  | Readonly<{ mode: 'fit-max-dimension'; size: number }>

export interface CinemaWorld3DObjectAnchor {
  id: string
  visible?: boolean
  transform?: Readonly<{
    position?: CinemaSpatialVector3
    rotation?: CinemaSpatialVector3
    scale?: CinemaSpatialVector3
  }>
  normalization?: CinemaWorld3DObjectNormalization
  materialDefaults?: Readonly<{
    frontColor?: CinemaSpatialColor
    sideColor?: CinemaSpatialColor
    emissiveIntensity?: number
    ambientIntensity?: number
    lightDirection?: CinemaSpatialVector3
  }>
  /** Anchor-local point used for camera focus. Bounds center is used when omitted. */
  focusAnchor?: CinemaSpatialVector3
  framingPadding?: number
}
