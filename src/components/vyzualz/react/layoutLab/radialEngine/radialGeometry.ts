/** Angles are degrees clockwise from straight up, so 0° is the top of a dial. */
export const polar = (cx: number, cy: number, radius: number, angle: number) => {
  const radians = (angle * Math.PI) / 180
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) }
}

/** SVG path for a ring sector between two radii and two angles. */
export function sectorPath(cx: number, cy: number, inner: number, outer: number, from: number, to: number): string {
  const a = polar(cx, cy, outer, from), b = polar(cx, cy, outer, to), c = polar(cx, cy, inner, to), d = polar(cx, cy, inner, from)
  const large = to - from > 180 ? 1 : 0
  return `M${a.x} ${a.y}A${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y}L${c.x} ${c.y}A${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y}Z`
}

/** Wraps an index into 0..count-1. */
export const wrap = (index: number, count: number) => ((index % count) + count) % count
