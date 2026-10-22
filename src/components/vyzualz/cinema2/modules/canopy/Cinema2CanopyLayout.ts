import {
  CANOPY_BASE_HANG,
  CANOPY_CAP_HEIGHT,
  CANOPY_CAP_WIDTH,
  CANOPY_MAX_AXIS,
  CANOPY_MAX_HANG,
  CANOPY_MAX_RODS,
  CANOPY_MIN_HANG,
  CANOPY_MIN_TIP_Y,
  CANOPY_MOUNT_Y,
  CANOPY_PIVOT_Y,
  CANOPY_RAIL_HEIGHT,
  CANOPY_RAIL_WIDTH,
  CANOPY_ROD_RADIUS,
  CANOPY_STEM_WIDTH,
  canopyHash,
  clampCanopy,
  resolveCanopyFitScale,
  type CanopyStructure,
} from './Cinema2CanopyDomain'

/** One rod: its fixed place under the mounting plane and its own length. */
export interface CanopyFixture {
  readonly index: number
  readonly row: number
  readonly column: number
  readonly x: number
  readonly z: number
  /** Length of the luminous diffuser, after Length Variation. */
  readonly length: number
  /** Cap hang after which the tip would drop under the minimum tip height. */
  readonly maxHang: number
  /** Normalized position in -1..1 (u across columns, v from back to front). */
  readonly u: number
  readonly v: number
  /** 0 at the array centre to 1 at its corners. */
  readonly radius: number
  /** Rows counted from the front (0 = nearest the camera). */
  readonly rowFromFront: number
  /** Which of the two colour banks the rod belongs to (alternating columns). */
  readonly bank: 0 | 1
  /** Deterministic 0..1 individual offsets. */
  readonly jitter: number
}

export interface CanopyRail {
  readonly axis: 'row' | 'column'
  readonly x: number
  readonly z: number
  readonly length: number
}

export interface CanopyLayout {
  readonly structure: Readonly<CanopyStructure>
  readonly scale: number
  readonly fixtures: readonly Readonly<CanopyFixture>[]
  readonly rails: readonly Readonly<CanopyRail>[]
}

/** Instances are 12 floats: center xyz + kind, size xyz + emission, accent, bank, unlit floor, spare. */
export const CANOPY_INSTANCE_FLOATS = 12
/** The instance buffer is allocated once for the largest array: boxes (rails, stems, caps) first, then the diffusers. */
export const CANOPY_MAX_BOX_INSTANCES = CANOPY_MAX_AXIS * 2 + CANOPY_MAX_RODS * 2
export const CANOPY_MAX_INSTANCES = CANOPY_MAX_BOX_INSTANCES + CANOPY_MAX_RODS
/** Instance kinds as the shader reads them. */
export const CANOPY_KIND = Object.freeze({ rail: 0, stem: 1, cap: 2, diffuser: 3 } as const)

export function buildCanopyLayout(structure: Readonly<CanopyStructure>): Readonly<CanopyLayout> {
  const { rows, columns, rowSpacing, columnSpacing } = structure
  const fixtures: CanopyFixture[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column
      const u = columns > 1 ? (column / (columns - 1)) * 2 - 1 : 0
      const v = rows > 1 ? (row / (rows - 1)) * 2 - 1 : 0
      const length = structure.rodLength * (1 + structure.lengthVariation * (canopyHash(index, 11) - 0.5))
      fixtures.push(Object.freeze({
        index,
        row,
        column,
        x: (column - (columns - 1) / 2) * columnSpacing,
        z: (row - (rows - 1) / 2) * rowSpacing,
        length,
        maxHang: Math.max(CANOPY_MIN_HANG, Math.min(CANOPY_MAX_HANG, CANOPY_MOUNT_Y - length - CANOPY_MIN_TIP_Y)),
        u,
        v,
        radius: Math.min(1, Math.sqrt(u * u + v * v) / Math.SQRT2),
        rowFromFront: rows - 1 - row,
        bank: (column % 2) as 0 | 1,
        jitter: canopyHash(index, 29),
      }))
    }
  }
  const halfWidth = ((columns - 1) / 2) * columnSpacing + columnSpacing * 0.5
  const halfDepth = ((rows - 1) / 2) * rowSpacing + rowSpacing * 0.5
  const rails: CanopyRail[] = []
  for (let row = 0; row < rows; row += 1) rails.push(Object.freeze({ axis: 'row' as const, x: 0, z: (row - (rows - 1) / 2) * rowSpacing, length: halfWidth * 2 }))
  for (let column = 0; column < columns; column += 1) rails.push(Object.freeze({ axis: 'column' as const, x: (column - (columns - 1) / 2) * columnSpacing, z: 0, length: halfDepth * 2 }))
  return Object.freeze({ structure, scale: resolveCanopyFitScale(structure), fixtures: Object.freeze(fixtures), rails: Object.freeze(rails) })
}

export function canopyInstanceCounts(layout: Readonly<CanopyLayout>): Readonly<{ boxes: number; diffusers: number; total: number }> {
  const boxes = layout.rails.length + layout.fixtures.length * 2
  return Object.freeze({ boxes, diffusers: layout.fixtures.length, total: boxes + layout.fixtures.length })
}

/** The per-rod values the solver hands to the packer. */
export interface CanopyRodState {
  /** Cap hang below the mounting plane, already clamped. */
  readonly hang: Float32Array
  /** Emission of the diffuser, 0 upwards (1 is a fully lit rod at default intensity). */
  readonly emission: Float32Array
  /** 0..1 blend of the rod colour towards Accent Hits. */
  readonly accent: Float32Array
}

export function createCanopyRodState(count: number): CanopyRodState {
  return { hang: new Float32Array(count).fill(CANOPY_BASE_HANG), emission: new Float32Array(count), accent: new Float32Array(count) }
}

/** Writes the instance buffer: boxes (rails, stems, caps) from the start and diffusers from the fixed diffuser region, so each is one contiguous draw batch. */
export function packCanopyInstances(layout: Readonly<CanopyLayout>, state: Readonly<CanopyRodState>, out: Float32Array): void {
  const s = layout.scale
  let cursor = 0
  const write = (kind: number, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, emission: number, accent: number, bank: number, floor: number) => {
    out[cursor] = cx * s; out[cursor + 1] = CANOPY_PIVOT_Y + (cy - CANOPY_PIVOT_Y) * s; out[cursor + 2] = cz * s; out[cursor + 3] = kind
    out[cursor + 4] = sx * s; out[cursor + 5] = sy * s; out[cursor + 6] = sz * s; out[cursor + 7] = emission
    out[cursor + 8] = accent; out[cursor + 9] = bank; out[cursor + 10] = floor; out[cursor + 11] = 0
    cursor += CANOPY_INSTANCE_FLOATS
  }
  for (const rail of layout.rails) {
    const along = rail.axis === 'row'
    write(CANOPY_KIND.rail, rail.x, CANOPY_MOUNT_Y + CANOPY_RAIL_HEIGHT / 2, rail.z, along ? rail.length : CANOPY_RAIL_WIDTH, CANOPY_RAIL_HEIGHT, along ? CANOPY_RAIL_WIDTH : rail.length, 0, 0, 0, 0)
  }
  for (const fixture of layout.fixtures) {
    const hang = clampCanopy(state.hang[fixture.index]!, CANOPY_MIN_HANG, fixture.maxHang)
    const stem = Math.max(0.001, hang - CANOPY_CAP_HEIGHT)
    write(CANOPY_KIND.stem, fixture.x, CANOPY_MOUNT_Y - stem / 2, fixture.z, CANOPY_STEM_WIDTH, stem, CANOPY_STEM_WIDTH, Math.max(0, state.emission[fixture.index]!) * 0.5, clampCanopy(state.accent[fixture.index]!, 0, 1), fixture.bank, 0)
  }
  for (const fixture of layout.fixtures) {
    const hang = clampCanopy(state.hang[fixture.index]!, CANOPY_MIN_HANG, fixture.maxHang)
    write(CANOPY_KIND.cap, fixture.x, CANOPY_MOUNT_Y - hang + CANOPY_CAP_HEIGHT / 2, fixture.z, CANOPY_CAP_WIDTH, CANOPY_CAP_HEIGHT, CANOPY_CAP_WIDTH, Math.max(0, state.emission[fixture.index]!), clampCanopy(state.accent[fixture.index]!, 0, 1), fixture.bank, 0)
  }
  cursor = CANOPY_MAX_BOX_INSTANCES * CANOPY_INSTANCE_FLOATS
  for (const fixture of layout.fixtures) {
    const hang = clampCanopy(state.hang[fixture.index]!, CANOPY_MIN_HANG, fixture.maxHang)
    const top = CANOPY_MOUNT_Y - hang
    write(CANOPY_KIND.diffuser, fixture.x, top - fixture.length / 2, fixture.z, CANOPY_ROD_RADIUS * 2, fixture.length, CANOPY_ROD_RADIUS * 2, Math.max(0, state.emission[fixture.index]!), clampCanopy(state.accent[fixture.index]!, 0, 1), fixture.bank, 0)
  }
}

/** World-space bounds of everything drawn at the largest hang and length; used to assert nothing leaves the frame. */
export function resolveCanopyBounds(layout: Readonly<CanopyLayout>): Readonly<{ min: readonly [number, number, number]; max: readonly [number, number, number] }> {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity
  for (const f of layout.fixtures) {
    minX = Math.min(minX, f.x - CANOPY_CAP_WIDTH / 2); maxX = Math.max(maxX, f.x + CANOPY_CAP_WIDTH / 2)
    minZ = Math.min(minZ, f.z - CANOPY_CAP_WIDTH / 2); maxZ = Math.max(maxZ, f.z + CANOPY_CAP_WIDTH / 2)
    minY = Math.min(minY, CANOPY_MOUNT_Y - f.maxHang - f.length)
  }
  const s = layout.scale
  const y = (value: number) => CANOPY_PIVOT_Y + (value - CANOPY_PIVOT_Y) * s
  return Object.freeze({ min: [minX * s, y(minY), minZ * s] as const, max: [maxX * s, y(CANOPY_MOUNT_Y + CANOPY_RAIL_HEIGHT), maxZ * s] as const })
}
