/**
 * The BWC hall's lit elements, each with a level of its own: the reactor (chamber, ring and intake hood), the five energy pipes, the white
 * LED panels on both side walls (one per wall bay) and the fluorescent tubes across the ceiling (one per roof bay).
 *
 * A level is a brightness multiplier. 1 is the authored look; 0 leaves the housing dark; above 1 overdrives it for flashes. The shader finds
 * which element a surface point belongs to from its geometry (the material id, plus the bay it sits in along the hall), so a choreography
 * only has to supply these numbers. See Cinema2BwcRenderer for the geometry these indices come from.
 */

/** Wall bays along each side wall: bay k is centred on z = 3.10 k, for k = -5 .. 3. */
export const BWC_WALL_BAY_COUNT = 9
export const BWC_WALL_BAY_PITCH = 3.1
export const BWC_WALL_BAY_FIRST = -5
/** Ceiling tubes: tube j sits at z = 3.70 j - 0.64, for j = -4 .. 3. */
export const BWC_CEILING_TUBE_COUNT = 8
export const BWC_CEILING_TUBE_PITCH = 3.7
export const BWC_CEILING_TUBE_FIRST = -4
export const BWC_PIPE_COUNT = 5
/** Levels are clamped here so a runaway choreography cannot blow the frame out. */
export const BWC_LIGHT_LEVEL_MAX = 2

/** Material ids of the lit surfaces; the shader reads the pipe number and the ring's chase from them. */
export const BWC_LIT_MATERIAL = Object.freeze({
  reactorChamber: 4,
  reactorRing: 6,
  hoodFrame: 6.05,
  /** Pipe i is PIPE_FIRST + 0.1 i. */
  pipeFirst: 6.1,
  wallPanel: 7,
  ceilingTube: 7.5,
})

/** The material id of pipe `index` (0..4). */
export function bwcPipeMaterial(index: number): number { return Number((BWC_LIT_MATERIAL.pipeFirst + 0.1 * index).toFixed(1)) }
/** A material id as the shader literal the geometry tags a surface with. */
export function bwcMaterialLiteral(material: number): string { return material.toFixed(2) }

/** Where the five pipes leave the hub, in the shader's order. */
export const BWC_PIPE_HUB = Object.freeze([-0.38, 4.72, -3.52] as const)
export const BWC_PIPE_ENDS: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([-5.15, 5.15, 0.10] as const),
  Object.freeze([-5.15, 5.10, -4.55] as const),
  Object.freeze([-0.38, 6.15, -3.55] as const),
  Object.freeze([5.15, 5.10, -4.72] as const),
  Object.freeze([5.15, 5.10, -1.25] as const),
])

export interface Cinema2BwcLightingState {
  /** The green chamber inside the reactor ring. */
  reactorCore: number
  /** The thin lit ring around the chamber; with `ringChase` a pulse can run around it. */
  reactorRing: number
  /** The green LED frame at both ends of the intake hood. */
  hood: number
  /** [position 0..1 around the ring, how far the pulse stands out 0..1]; amount 0 lights the ring evenly. */
  ringChase: readonly [number, number]
  pipes: readonly number[]
  /** [position 0..1 from the hub to the wall end, how far the pulse stands out 0..1]; strength 0 lights every pipe evenly. */
  pipeFlow: readonly [number, number]
  /** Left wall, bay by bay, from the back of the hall to the front. */
  wallLeft: readonly number[]
  wallRight: readonly number[]
  /** Ceiling tubes, from the back of the hall to the front. */
  ceiling: readonly number[]
}

/** The colour of each group of lit elements. */
export interface Cinema2BwcLightColors {
  reactor: readonly [number, number, number]
  pipes: readonly [number, number, number]
  wall: readonly [number, number, number]
  ceiling: readonly [number, number, number]
}

const filled = (count: number, value: number): readonly number[] => Object.freeze(Array.from({ length: count }, () => value))

/** Every element at its authored level: the scene as it looked before it was choreographed. */
export function neutralBwcLighting(): Readonly<Cinema2BwcLightingState> {
  return Object.freeze({
    reactorCore: 1, reactorRing: 1, hood: 1, ringChase: Object.freeze([0, 0] as const),
    pipes: filled(BWC_PIPE_COUNT, 1), pipeFlow: Object.freeze([0, 0] as const),
    wallLeft: filled(BWC_WALL_BAY_COUNT, 1), wallRight: filled(BWC_WALL_BAY_COUNT, 1), ceiling: filled(BWC_CEILING_TUBE_COUNT, 1),
  })
}

/**
 * Pulls a choreographed look back toward the authored one: 1 keeps every level as the pattern set it, 0 holds the scene at its authored
 * brightness. The pulses (ring chase, pipe flow) fade out with it.
 */
export function blendBwcLightingReactivity(state: Readonly<Cinema2BwcLightingState>, reactivity: number): Readonly<Cinema2BwcLightingState> {
  const r = Number.isFinite(reactivity) ? Math.min(1, Math.max(0, reactivity)) : 1
  if (r >= 1) return state
  if (r <= 0) return neutralBwcLighting()
  const toward = (level: number): number => 1 + (level - 1) * r
  const all = (levels: readonly number[]): readonly number[] => Object.freeze(levels.map(toward))
  return Object.freeze({
    reactorCore: toward(state.reactorCore), reactorRing: toward(state.reactorRing), hood: toward(state.hood),
    ringChase: Object.freeze([state.ringChase[0], state.ringChase[1] * r] as const),
    pipes: all(state.pipes), pipeFlow: Object.freeze([state.pipeFlow[0], state.pipeFlow[1] * r] as const),
    wallLeft: all(state.wallLeft), wallRight: all(state.wallRight), ceiling: all(state.ceiling),
  })
}

export const NEUTRAL_BWC_LIGHT_COLORS: Readonly<Cinema2BwcLightColors> = Object.freeze({
  reactor: Object.freeze([0.28, 0.62, 0.18] as const),
  pipes: Object.freeze([0.28, 0.62, 0.18] as const),
  wall: Object.freeze([0.82, 0.94, 1.0] as const),
  ceiling: Object.freeze([0.82, 0.94, 1.0] as const),
})

export function clampBwcLightLevel(value: number): number {
  return Number.isFinite(value) ? Math.min(BWC_LIGHT_LEVEL_MAX, Math.max(0, value)) : 0
}

/** A list of levels as exactly `count` clamped numbers: extra entries are dropped and missing ones read as unlit. */
export function bwcLightLevels(values: readonly number[], count: number): Float32Array {
  const out = new Float32Array(count)
  for (let i = 0; i < count; i += 1) out[i] = clampBwcLightLevel(values[i] ?? 0)
  return out
}

/** The wall bay a point at depth `z` falls in, as an index into one side's levels (the shader does the same sum). */
export function bwcWallBayIndex(z: number): number {
  const bay = Math.floor((z + BWC_WALL_BAY_PITCH / 2) / BWC_WALL_BAY_PITCH)
  return Math.min(BWC_WALL_BAY_COUNT - 1, Math.max(0, bay - BWC_WALL_BAY_FIRST))
}

/** The ceiling tube nearest depth `z`, as an index into the ceiling levels. */
export function bwcCeilingTubeIndex(z: number): number {
  const tube = Math.floor((z + BWC_CEILING_TUBE_PITCH / 2) / BWC_CEILING_TUBE_PITCH)
  return Math.min(BWC_CEILING_TUBE_COUNT - 1, Math.max(0, tube - BWC_CEILING_TUBE_FIRST))
}

const f = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(Number(value.toFixed(6))))
const v3 = (value: readonly number[]): string => `vec3(${value.map(f).join(', ')})`

/** The uniforms and lookups the scene shader uses; injected ahead of the geometry so the pipe layout is shared with it. */
export function bwcLightingGlsl(): string {
  return `
uniform float u_reactorCore;
uniform float u_reactorRing;
uniform float u_hoodLight;
uniform vec2 u_ringChase;
uniform float u_pipeLevels[${BWC_PIPE_COUNT}];
uniform vec2 u_pipeFlow;
uniform float u_wallLevels[${BWC_WALL_BAY_COUNT * 2}];
uniform float u_ceilingLevels[${BWC_CEILING_TUBE_COUNT}];
uniform vec3 u_reactorColor;
uniform vec3 u_pipeColor;
uniform vec3 u_wallColor;
uniform vec3 u_ceilingColor;

const vec3 PIPE_HUB = ${v3(BWC_PIPE_HUB)};
const vec3 PIPE_END[${BWC_PIPE_COUNT}] = vec3[${BWC_PIPE_COUNT}](${BWC_PIPE_ENDS.map(v3).join(', ')});
const float WALL_BAY_PITCH = ${f(BWC_WALL_BAY_PITCH)};
const float CEILING_TUBE_PITCH = ${f(BWC_CEILING_TUBE_PITCH)};

/* Which lit element a material belongs to, and how bright that element is right now; 1 for everything that is not a light. */
float pipeIndex(float material) { return clamp(floor((material - ${f(BWC_LIT_MATERIAL.pipeFirst)}) * 10.0 + 0.5), 0.0, ${f(BWC_PIPE_COUNT - 1)}); }
bool isReactorChamber(float material) { return material > 3.5 && material < 4.5; }
bool isEnergyLight(float material) { return material > 5.95 && material < 6.95; }
bool isWhiteLight(float material) { return material > 6.95 && material < 7.95; }
float lightLevel(float material, vec3 p) {
  if (isReactorChamber(material)) return u_reactorCore;
  if (isEnergyLight(material)) {
    if (material < 6.02) {
      vec2 q = p.xy - vec2(-0.38, 2.72);
      float around = abs(fract(atan(q.y, q.x) / 6.2831853 - u_ringChase.x + 0.5) - 0.5);
      float pulse = smoothstep(0.22, 0.0, around);
      return u_reactorRing * mix(1.0, 0.25 + 1.35 * pulse, u_ringChase.y);
    }
    if (material < 6.07) return u_hoodLight;
    int pipe = int(pipeIndex(material));
    vec3 end = PIPE_END[pipe];
    float along = clamp(dot(p - PIPE_HUB, end - PIPE_HUB) / dot(end - PIPE_HUB, end - PIPE_HUB), 0.0, 1.0);
    float pulse = smoothstep(0.3, 0.0, abs(along - u_pipeFlow.x));
    return u_pipeLevels[pipe] * max(1.0 + u_pipeFlow.y * (1.3 * pulse - 0.4), 0.0);
  }
  if (isWhiteLight(material)) {
    if (material < 7.25) {
      int bay = int(clamp(floor((p.z + WALL_BAY_PITCH * 0.5) / WALL_BAY_PITCH) - (${f(BWC_WALL_BAY_FIRST)}), 0.0, ${f(BWC_WALL_BAY_COUNT - 1)}));
      return u_wallLevels[bay + (p.x < 0.0 ? 0 : ${BWC_WALL_BAY_COUNT})];
    }
    int tube = int(clamp(floor((p.z + CEILING_TUBE_PITCH * 0.5) / CEILING_TUBE_PITCH) - (${f(BWC_CEILING_TUBE_FIRST)}), 0.0, ${f(BWC_CEILING_TUBE_COUNT - 1)}));
    return u_ceilingLevels[tube];
  }
  return 1.0;
}
/* The colour of the element a lit material belongs to. */
vec3 lightColor(float material) {
  if (isReactorChamber(material) || (isEnergyLight(material) && material < 6.07)) return u_reactorColor;
  if (isEnergyLight(material)) return u_pipeColor;
  return material < 7.25 ? u_wallColor : u_ceilingColor;
}
`
}

export const BWC_LIGHTING_UNIFORMS: readonly string[] = Object.freeze([
  'u_reactorCore', 'u_reactorRing', 'u_hoodLight', 'u_ringChase', 'u_pipeLevels', 'u_pipeFlow', 'u_wallLevels', 'u_ceilingLevels',
  'u_reactorColor', 'u_pipeColor', 'u_wallColor', 'u_ceilingColor',
])
