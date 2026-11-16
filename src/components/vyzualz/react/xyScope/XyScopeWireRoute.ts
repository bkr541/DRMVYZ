// Sound Drawing XY › WIREFRAME: stroke routing. One beam has to draw every edge, and a beam cannot lift: it must travel from the end of one
// stroke to the start of the next. The guide's answer (§13.3) is to keep that travel honest: where the figure allows it, retrace edges so
// the beam never leaves the drawing, and only where it must (between separate components, such as two cubes) make a visible hop that the
// renderer can blank, dim or show.
//
// For each connected component this finds the cheapest set of edges to retrace so that every corner has an even number of edges (a cube's
// corners each have three, so four edges are retraced), then walks one continuous circuit with Hierholzer's algorithm.

export interface WireRoute {
  /** Corner each step starts from. */
  from: Uint16Array
  /** Corner each step ends at. */
  to: Uint16Array
  /** The edge a step draws, or -1 for a hop between components. */
  edge: Int16Array
  /** How many times the step's edge is drawn in all (1, or 2 when it is retraced); a step's brightness is 1 / multiplicity. */
  multiplicity: Uint8Array
  /** The number of edges this route draws more than once. */
  retraced: number
  /** The number of hops between components (counting the one that closes the loop). */
  hops: number
  get length(): number
}

interface Arc { to: number; edge: number }

function components(vertexCount: number, adjacency: Arc[][]): number[][] {
  const seen = new Uint8Array(vertexCount)
  const out: number[][] = []
  for (let start = 0; start < vertexCount; start++) {
    if (seen[start] || adjacency[start].length === 0) continue
    const members: number[] = [], stack = [start]
    seen[start] = 1
    while (stack.length > 0) {
      const v = stack.pop()!
      members.push(v)
      for (const { to } of adjacency[v]) if (!seen[to]) { seen[to] = 1; stack.push(to) }
    }
    out.push(members.sort((a, b) => a - b))
  }
  return out
}

/** Shortest path (by edge count) between two corners, as the list of edges walked. */
function shortestPath(adjacency: Arc[][], from: number, to: number): number[] {
  const previous = new Map<number, { vertex: number; edge: number }>([[from, { vertex: -1, edge: -1 }]])
  const queue = [from]
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    if (v === to) break
    for (const arc of adjacency[v]) if (!previous.has(arc.to)) { previous.set(arc.to, { vertex: v, edge: arc.edge }); queue.push(arc.to) }
  }
  const path: number[] = []
  for (let at = to; at !== from;) { const step = previous.get(at); if (!step) return []; path.push(step.edge); at = step.vertex }
  return path.reverse()
}

/**
 * Pairs up the odd corners so the edges retraced between each pair are as few as possible. Exact (a memoized search that always pairs the
 * lowest unpaired corner) up to 22 corners, which covers a dodecahedron's 20; greedy beyond that.
 */
function pairOdd(adjacency: Arc[][], odd: number[]): [number, number][] {
  const n = odd.length
  if (n === 0) return []
  const dist = odd.map(a => odd.map(b => (a === b ? 0 : shortestPath(adjacency, a, b).length)))
  if (n > 22) {
    const left = new Set(odd.keys()), pairs: [number, number][] = []
    while (left.size > 0) {
      const a = [...left][0]; left.delete(a)
      let best = -1
      for (const b of left) if (best < 0 || dist[a][b] < dist[a][best]) best = b
      left.delete(best); pairs.push([odd[a], odd[best]])
    }
    return pairs
  }
  const full = (1 << n) - 1
  const memo = new Map<number, { cost: number; pick: number }>()
  const solve = (mask: number): number => {
    if (mask === full) return 0
    const known = memo.get(mask)
    if (known) return known.cost
    let i = 0
    while (mask & (1 << i)) i++
    let best = Infinity, pick = -1
    for (let j = i + 1; j < n; j++) {
      if (mask & (1 << j)) continue
      const total = dist[i][j] + solve(mask | (1 << i) | (1 << j))
      if (total < best) { best = total; pick = j }
    }
    memo.set(mask, { cost: best, pick })
    return best
  }
  solve(0)
  const pairs: [number, number][] = []
  for (let mask = 0; mask !== full;) {
    let i = 0
    while (mask & (1 << i)) i++
    const j = memo.get(mask)!.pick
    pairs.push([odd[i], odd[j]]); mask |= (1 << i) | (1 << j)
  }
  return pairs
}

/** Routes the given edges (pairs of corner indices) into one closed, continuous beam path. */
export function routeEdges(vertexCount: number, edgeList: ArrayLike<number>): WireRoute {
  const edgeCount = Math.floor(edgeList.length / 2)
  const adjacency: Arc[][] = Array.from({ length: vertexCount }, () => [])
  for (let e = 0; e < edgeCount; e++) {
    const a = edgeList[e * 2], b = edgeList[e * 2 + 1]
    adjacency[a].push({ to: b, edge: e }); adjacency[b].push({ to: a, edge: e })
  }
  const from: number[] = [], to: number[] = [], edge: number[] = [], mult: number[] = []
  const multiplicity = new Uint8Array(edgeCount).fill(1)
  let retraced = 0, hops = 0
  const circuits: { start: number; steps: { from: number; to: number; edge: number }[] }[] = []

  for (const members of components(vertexCount, adjacency)) {
    // Every corner needs an even number of edge ends. Retrace the cheapest edges to get there.
    const extra: Arc[][] = adjacency.map(list => [...list])
    const odd = members.filter(v => adjacency[v].length % 2 === 1)
    for (const [a, b] of pairOdd(adjacency, odd)) {
      for (const e of shortestPath(adjacency, a, b)) {
        const [x, y] = [edgeList[e * 2], edgeList[e * 2 + 1]]
        extra[x].push({ to: y, edge: e }); extra[y].push({ to: x, edge: e })
        multiplicity[e]++; retraced++
      }
    }
    // Hierholzer's walk over the multigraph; each arc entry is consumed once from each end.
    const cursor = new Uint16Array(vertexCount)
    const spent = extra.map(list => new Uint8Array(list.length))
    const start = members[0]
    const vertexStack = [start], arcStack: { from: number; to: number; edge: number }[] = []
    const steps: { from: number; to: number; edge: number }[] = []
    while (vertexStack.length > 0) {
      const v = vertexStack[vertexStack.length - 1]
      let moved = false
      while (cursor[v] < extra[v].length) {
        const index = cursor[v]++
        if (spent[v][index]) continue
        const arc = extra[v][index]
        spent[v][index] = 1
        // Mark the matching entry at the far end (the same edge, not yet spent) so it is not walked back.
        const back = extra[arc.to].findIndex((other, i) => other.edge === arc.edge && other.to === v && !spent[arc.to][i])
        if (back >= 0) spent[arc.to][back] = 1
        vertexStack.push(arc.to); arcStack.push({ from: v, to: arc.to, edge: arc.edge })
        moved = true
        break
      }
      if (!moved) { vertexStack.pop(); const step = arcStack.pop(); if (step) steps.push(step) }
    }
    steps.reverse()
    circuits.push({ start, steps })
  }

  circuits.forEach((circuit, i) => {
    for (const step of circuit.steps) {
      from.push(step.from); to.push(step.to); edge.push(step.edge); mult.push(multiplicity[step.edge])
    }
    // A hop from this circuit's end to the next circuit's start (the last one hops back to the first, so the path loops).
    const next = circuits[(i + 1) % circuits.length]
    const last = circuit.steps.length > 0 ? circuit.steps[circuit.steps.length - 1].to : circuit.start
    if (circuits.length > 1 || last !== next.start) {
      from.push(last); to.push(next.start); edge.push(-1); mult.push(1); hops++
    }
  })
  return {
    from: Uint16Array.from(from), to: Uint16Array.from(to), edge: Int16Array.from(edge), multiplicity: Uint8Array.from(mult),
    retraced, hops, get length() { return from.length },
  }
}
