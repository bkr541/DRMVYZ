import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAINFRAME_CANVAS = Object.freeze({ width: 1920, height: 1080, aspect: '16:9' })
export const MAINFRAME_EXTENDED_CANVAS = Object.freeze({ x: -960, y: -540, width: 3840, height: 2160, aspect: '16:9' })
export const MAINFRAME_EXPECTED_COUNTS = Object.freeze({
  routes: 60,
  terminals: 46,
  radars: 4,
  chips: 2,
  vias: 36,
  viaElements: 72,
  reactiveTerminalElements: 92,
  logoParts: 3,
  extensionRoutes: 356,
  extensionPlates: 30,
  extensionRadars: 16,
  extensionChips: 8,
  extensionTerminals: 584,
})

export const MAINFRAME_SOURCE_DIRECTORY = fileURLToPath(new URL('./sources/mainframe/', import.meta.url))

export const MAINFRAME_SOURCE_FILES = Object.freeze({
  pass1Svg: 'pass1-geometry.svg',
  pass1Manifest: 'pass1-manifest.json',
  pass2Svg: 'pass2-depth.svg',
  pass2Manifest: 'pass2-manifest.json',
  pass3Svg: 'pass3-visualizer.svg',
  pass3Reactivity: 'pass3-reactivity.json',
  conceptReference: 'concept-reference.png',
  extendedSvg: 'extended-circuitboard.svg',
})

export const MAINFRAME_SOURCE_SHA256 = Object.freeze({
  pass1Svg: 'c4713bf88b929a05fc5a807c7bf56083b89a5179894a09648cc3808f7509eedf',
  pass1Manifest: '5f29d957e6fc484e19a6ed8bf7978bcb658a9c2945b556e0b5d794cf7ed2d0a9',
  pass2Svg: '03e8ca92c7b98d41f964efdb6ddd0bfc902f447a12006516db97f014f4b38766',
  pass2Manifest: 'dfc5ea99803d1087865955450e543ec8fd5abc7ef49f7fa46f69aa44cbb7be20',
  pass3Svg: '52bd56cf079950eeae65a1a7d430b4b78baa33aa83476e763ddc366ea5d5cc53',
  pass3Reactivity: 'fd569073423b87e2d8702b6627ec43ad49b5e228a6e4451c81dc9323b25e16f0',
  conceptReference: '9cca0af0f6ec0ccb32c6922ff4535019e094f7c263ba1d1c22a4606f326068eb',
  extendedSvg: 'd2842448642446133d7c25bc211964382ecdd438eb17ebaab1abcec06bc0d1fb',
})

const EXPECTED_PASS2_LAYERS = Object.freeze([
  'BOARD', 'BOARD_DETAILS', 'BOARD_PLATES', 'CIRCUIT_SHADOWS', 'CIRCUIT_HOUSINGS',
  'CIRCUIT_RECESSES', 'CIRCUIT_CORES', 'CIRCUIT_HIGHLIGHTS', 'VIA_CLUSTERS',
  'RADAR_COMPONENTS', 'COMPUTER_CHIPS', 'TERMINAL_SHADOWS', 'TERMINALS', 'LOGO_SHADOW', 'LOGO',
])
const EXPECTED_SYSTEMS = Object.freeze(['STATIC_BOARD', 'CIRCUIT_SYSTEM', 'COMPONENT_SYSTEM', 'TERMINAL_SYSTEM', 'LOGO_SYSTEM', 'FX_SYSTEM'])
const ROUTE_LAYER_SUFFIXES = Object.freeze({
  pass1: Object.freeze(['housing', 'core']),
  pass2: Object.freeze(['shadow', 'housing', 'recess', 'core', 'highlight']),
  pass3: Object.freeze(['shadow', 'housing', 'recess', 'core', 'highlight']),
})
const LOGO_IDS = Object.freeze({
  outer: Object.freeze({ pass1: 'logo-outer-housing', pass2: 'logo-outer-housing', pass3: 'logo-outer-housing' }),
  body: Object.freeze({ pass1: 'logo-body-housing', pass2: 'logo-body-housing', pass3: 'logo-body-housing' }),
  star: Object.freeze({ pass1: 'logo-star', pass2: 'logo-star-housing', pass3: 'logo-star-housing' }),
})

const sha256 = value => createHash('sha256').update(value).digest('hex')
const json = value => JSON.parse(value.toString('utf8'))
const sorted = values => [...values].sort((left, right) => left.localeCompare(right))
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const cleanNumber = value => Number(value.toFixed(9))
const selectorRouteId = selector => {
  const match = /^#(.+)-core$/.exec(selector)
  return match?.[1] ?? null
}

function element(svg, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return svg.match(new RegExp(`<[^>]+\\bid=["']${escaped}["'][^>]*>`, 'm'))?.[0] ?? null
}

function attribute(markup, name) {
  if (!markup) return null
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return markup.match(new RegExp(`\\b${escaped}=["']([^"']*)["']`))?.[1] ?? null
}

function numericAttribute(markup, name) {
  const value = Number(attribute(markup, name))
  return Number.isFinite(value) ? value : null
}

function pathData(svg, id) {
  return attribute(element(svg, id), 'd')
}

function groupContents(svg, id) {
  const start = svg.indexOf(`<g id="${id}"`)
  if (start < 0) return null
  const openEnd = svg.indexOf('>', start)
  let depth = 1
  const tags = /<\/?g\b[^>]*>/g
  tags.lastIndex = openEnd + 1
  for (let match = tags.exec(svg); match; match = tags.exec(svg)) {
    if (match[0].startsWith('</')) depth -= 1
    else depth += 1
    if (depth === 0) return svg.slice(openEnd + 1, match.index)
  }
  return null
}

function tags(markup, name) {
  return [...(markup ?? '').matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map(match => match[0])
}

function extendedComponentGroups(svg) {
  return [...svg.matchAll(/<g\b([^>]*)\bdata-component="([^"]+)"([^>]*)>([\s\S]*?)<\/g>/g)]
    .map(match => ({ markup: `<g${match[1]}data-component="${match[2]}"${match[3]}>`, type: match[2], contents: match[4] }))
    .filter(group => attribute(group.markup, 'id')?.startsWith('EXT-'))
}

function parseLinePath(value) {
  const tokens = value?.match(/[ML]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []
  const points = []
  let index = 0
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command !== 'M' && command !== 'L') throw new Error(`Unsupported route command "${command}".`)
    const x = Number(tokens[index++])
    const y = Number(tokens[index++])
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Route path contains a non-finite point.')
    points.push([x, y])
  }
  return points
}

function memberships(groups, label) {
  const reverse = new Map()
  for (const [group, selectors] of Object.entries(groups)) {
    for (const selector of selectors) {
      const routeId = selectorRouteId(selector)
      if (!routeId) throw new Error(`${label} ${group} contains unsupported selector "${selector}".`)
      if (reverse.has(routeId)) throw new Error(`Route ${routeId} appears in more than one ${label}.`)
      reverse.set(routeId, group)
    }
  }
  return reverse
}

function boundsOfPoints(points) {
  if (points.length === 0) return null
  return Object.freeze({
    minX: Math.min(...points.map(point => point[0])),
    minY: Math.min(...points.map(point => point[1])),
    maxX: Math.max(...points.map(point => point[0])),
    maxY: Math.max(...points.map(point => point[1])),
  })
}

function boundsOfBoxes(boxes) {
  return boundsOfPoints(boxes.flatMap(box => [[box.minX, box.minY], [box.maxX, box.maxY]]))
}

function routeGroups(routes, property) {
  const result = {}
  for (const route of routes) (result[route[property]] ??= []).push(route)
  return Object.fromEntries(sorted(Object.keys(result)).map(id => [id, Object.freeze({
    ids: Object.freeze(sorted(result[id].map(route => route.id))),
    bounds: boundsOfPoints(result[id].flatMap(route => route.points)),
  })]))
}

function canvasMatches(value) {
  return value?.width === MAINFRAME_CANVAS.width && value?.height === MAINFRAME_CANVAS.height && value?.aspect === MAINFRAME_CANVAS.aspect
}

function countIds(svg, expression) {
  return [...svg.matchAll(expression)].length
}

export function loadMainframeSourceContract(sourceDirectory = MAINFRAME_SOURCE_DIRECTORY) {
  const buffers = Object.fromEntries(Object.entries(MAINFRAME_SOURCE_FILES).map(([key, filename]) => [key, readFileSync(join(sourceDirectory, filename))]))
  const pass1Svg = buffers.pass1Svg.toString('utf8')
  const pass2Svg = buffers.pass2Svg.toString('utf8')
  const pass3Svg = buffers.pass3Svg.toString('utf8')
  const extendedSvg = buffers.extendedSvg.toString('utf8')
  const pass1Manifest = json(buffers.pass1Manifest)
  const pass2Manifest = json(buffers.pass2Manifest)
  const pass3Reactivity = json(buffers.pass3Reactivity)
  const bankOf = memberships(pass3Reactivity.circuit_banks, 'bank')
  const regionOf = memberships(pass3Reactivity.circuit_regions, 'region')

  const routes = Object.freeze(Object.entries(pass1Manifest.routes).map(([id, rawPoints]) => {
    const core = element(pass3Svg, `${id}-core`)
    const points = Object.freeze(rawPoints.map(point => Object.freeze([Number(point[0]), Number(point[1])])))
    return Object.freeze({
      id,
      points,
      bounds: boundsOfPoints(points),
      bank: bankOf.get(id) ?? null,
      region: regionOf.get(id) ?? null,
      signal: attribute(core, 'data-signal'),
      svg: Object.freeze({
        pass1: parseLinePath(pathData(pass1Svg, `${id}-core`)),
        pass2: parseLinePath(pathData(pass2Svg, `${id}-core`)),
        pass3: parseLinePath(pathData(pass3Svg, `${id}-core`)),
      }),
      pass3: Object.freeze({
        route: attribute(core, 'data-route'),
        bank: attribute(core, 'data-bank'),
        region: attribute(core, 'data-region'),
        reactive: attribute(core, 'data-reactive'),
        role: attribute(core, 'data-role'),
        pathLength: attribute(core, 'pathLength'),
      }),
    })
  }))

  const terminalBoxes = pass1Manifest.terminals.map(({ cx, cy, r }) => ({ minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r }))
  const radarBoxes = pass1Manifest.radar_components.map(({ cx, cy, outer_radius: radius }) => ({ minX: cx - radius, minY: cy - radius, maxX: cx + radius, maxY: cy + radius }))
  const chipBoxes = pass1Manifest.computer_chips.map(({ x, y, width, height }) => ({ minX: x, minY: y, maxX: x + width, maxY: y + height }))
  const [viewX, viewY, viewWidth, viewHeight] = pass1Manifest.logo.source_viewBox
  const transform = pass1Manifest.logo.transform.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/)?.slice(1).map(Number)
  const logoBounds = transform ? Object.freeze({
    minX: cleanNumber(transform[0] + viewX * transform[2]), minY: cleanNumber(transform[1] + viewY * transform[2]),
    maxX: cleanNumber(transform[0] + (viewX + viewWidth) * transform[2]), maxY: cleanNumber(transform[1] + (viewY + viewHeight) * transform[2]),
  }) : null
  const logoPaths = Object.fromEntries(Object.entries(LOGO_IDS).map(([part, ids]) => [part, Object.freeze({
    pass1: pathData(pass1Svg, ids.pass1), pass2: pathData(pass2Svg, ids.pass2), pass3: pathData(pass3Svg, ids.pass3),
  })]))
  const vias = Object.freeze(pass3Reactivity.components.vias.filter(selector => selector.endsWith('-ring')).map(selector => {
    const id = selector.slice(1, -'-ring'.length)
    const ring = element(pass3Svg, `${id}-ring`)
    return Object.freeze({ id, cx: numericAttribute(ring, 'cx'), cy: numericAttribute(ring, 'cy'), radius: numericAttribute(ring, 'r') })
  }))
  const extensionCore = groupContents(extendedSvg, 'EXT_CIRCUIT_CORES')
  const extensionHousing = new Map(tags(groupContents(extendedSvg, 'EXT_CIRCUIT_HOUSINGS'), 'path').map(path => [attribute(path, 'id')?.replace('housing-', ''), path]))
  const extensionRoutes = Object.freeze(tags(extensionCore, 'path').map((path, index) => {
    const suffix = attribute(path, 'id')?.replace('core-', '')
    const housing = extensionHousing.get(suffix)
    const points = Object.freeze(parseLinePath(attribute(path, 'd')).map(point => Object.freeze(point)))
    return Object.freeze({
      id: attribute(path, 'data-route'),
      points,
      bounds: boundsOfPoints(points),
      bank: attribute(path, 'data-bank'),
      region: attribute(path, 'data-region'),
      signal: attribute(path, 'data-signal'),
      trigger: attribute(path, 'data-trigger'),
      source: attribute(path, 'data-source'),
      coreWidth: numericAttribute(path, 'stroke-width'),
      housingWidth: numericAttribute(housing, 'stroke-width'),
      index,
    })
  }))
  const extensionPlates = Object.freeze(tags(groupContents(extendedSvg, 'EXT_BOARD_PLATES'), 'rect').map(rect => Object.freeze({
    x: numericAttribute(rect, 'x'), y: numericAttribute(rect, 'y'), width: numericAttribute(rect, 'width'), height: numericAttribute(rect, 'height'), radius: numericAttribute(rect, 'rx') ?? 0,
  })))
  const extensionComponents = extendedComponentGroups(extendedSvg)
  const extensionRadars = Object.freeze(extensionComponents.filter(component => component.type === 'radar').map(component => {
    const circles = tags(component.contents, 'circle')
    const face = circles[1] ?? circles[0]
    return Object.freeze({ id: attribute(component.markup, 'id'), cx: numericAttribute(face, 'cx'), cy: numericAttribute(face, 'cy'), radius: numericAttribute(face, 'r') })
  }))
  const extensionChips = Object.freeze(extensionComponents.filter(component => component.type === 'computer-chip').map(component => {
    const rectangles = tags(component.contents, 'rect')
    const face = rectangles[1] ?? rectangles[0]
    return Object.freeze({ id: attribute(component.markup, 'id'), x: numericAttribute(face, 'x'), y: numericAttribute(face, 'y'), width: numericAttribute(face, 'width'), height: numericAttribute(face, 'height') })
  }))
  const extensionTerminals = Object.freeze(extensionComponents.filter(component => !['radar', 'computer-chip'].includes(component.type)).map(component => {
    const face = tags(component.contents, 'circle')[0]
    return Object.freeze({ id: attribute(component.markup, 'id'), type: component.type, cx: numericAttribute(face, 'cx'), cy: numericAttribute(face, 'cy'), radius: numericAttribute(face, 'r') })
  }))

  return Object.freeze({
    sourceDirectory,
    hashes: Object.freeze(Object.fromEntries(Object.entries(buffers).map(([key, value]) => [key, sha256(value)]))),
    pass1Manifest,
    pass2Manifest,
    pass3Reactivity,
    svgs: Object.freeze({ pass1: pass1Svg, pass2: pass2Svg, pass3: pass3Svg, extended: extendedSvg }),
    routes,
    banks: Object.freeze(routeGroups(routes, 'bank')),
    regions: Object.freeze(routeGroups(routes, 'region')),
    components: Object.freeze({
      terminals: Object.freeze(pass1Manifest.terminals),
      radars: Object.freeze(pass1Manifest.radar_components),
      chips: Object.freeze(pass1Manifest.computer_chips),
      vias,
    }),
    extension: Object.freeze({
      canvas: MAINFRAME_EXTENDED_CANVAS,
      routes: extensionRoutes,
      plates: extensionPlates,
      radars: extensionRadars,
      chips: extensionChips,
      terminals: extensionTerminals,
      bounds: boundsOfPoints(extensionRoutes.flatMap(route => route.points)),
    }),
    logo: Object.freeze({ transform: pass1Manifest.logo.transform, bounds: logoBounds, paths: Object.freeze(logoPaths) }),
    bounds: Object.freeze({
      routes: boundsOfPoints(routes.flatMap(route => route.points)),
      terminals: boundsOfBoxes(terminalBoxes),
      radars: boundsOfBoxes(radarBoxes),
      chips: boundsOfBoxes(chipBoxes),
      logo: logoBounds,
      authored: boundsOfBoxes([boundsOfPoints(routes.flatMap(route => route.points)), boundsOfBoxes(terminalBoxes), boundsOfBoxes(radarBoxes), boundsOfBoxes(chipBoxes), logoBounds].filter(Boolean)),
    }),
  })
}

export function validateMainframeSourceContract(contract) {
  const issues = []
  const issue = message => issues.push(message)
  for (const [key, expected] of Object.entries(MAINFRAME_SOURCE_SHA256)) if (contract.hashes[key] !== expected) issue(`${MAINFRAME_SOURCE_FILES[key]} SHA-256 changed.`)
  if (!canvasMatches(contract.pass1Manifest.canvas)) issue('Pass 1 canvas must remain 1920 × 1080 (16:9).')
  if (!canvasMatches(contract.pass2Manifest.canvas)) issue('Pass 2 canvas must remain 1920 × 1080 (16:9).')
  if (!canvasMatches(contract.pass3Reactivity.asset?.canvas)) issue('Pass 3 canvas must remain 1920 × 1080 (16:9).')
  if (attribute(contract.svgs.extended.match(/<svg\b[^>]*>/)?.[0], 'viewBox') !== '-960 -540 3840 2160') issue('Extended master must remain a centered 3840 × 2160 canvas.')
  if (contract.pass3Reactivity.geometry_contract?.coordinate_system !== '0 0 1920 1080') issue('Pass 3 coordinate system changed.')
  if (!same(contract.pass2Manifest.layers, EXPECTED_PASS2_LAYERS)) issue('Pass 2 layer order changed.')
  if (contract.routes.length !== MAINFRAME_EXPECTED_COUNTS.routes) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.routes} routes; found ${contract.routes.length}.`)
  if (contract.pass1Manifest.terminals.length !== MAINFRAME_EXPECTED_COUNTS.terminals) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.terminals} terminals.`)
  if (contract.pass1Manifest.radar_components.length !== MAINFRAME_EXPECTED_COUNTS.radars) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.radars} radar modules.`)
  if (contract.pass1Manifest.computer_chips.length !== MAINFRAME_EXPECTED_COUNTS.chips) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.chips} computer chips.`)
  if (contract.components.vias.length !== MAINFRAME_EXPECTED_COUNTS.vias || contract.components.vias.some(via => via.cx == null || via.cy == null || via.radius == null)) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.vias} positioned vias.`)
  if (contract.extension.routes.length !== MAINFRAME_EXPECTED_COUNTS.extensionRoutes) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.extensionRoutes} extension routes.`)
  if (contract.extension.plates.length !== MAINFRAME_EXPECTED_COUNTS.extensionPlates) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.extensionPlates} extension plates.`)
  if (contract.extension.radars.length !== MAINFRAME_EXPECTED_COUNTS.extensionRadars) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.extensionRadars} extension radar modules.`)
  if (contract.extension.chips.length !== MAINFRAME_EXPECTED_COUNTS.extensionChips) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.extensionChips} extension computer chips.`)
  if (contract.extension.terminals.length !== MAINFRAME_EXPECTED_COUNTS.extensionTerminals) issue(`Expected ${MAINFRAME_EXPECTED_COUNTS.extensionTerminals} extension terminal elements.`)
  for (const collection of [contract.extension.routes, contract.extension.plates, contract.extension.radars, contract.extension.chips, contract.extension.terminals]) {
    if (collection.some(item => Object.values(item).some(value => typeof value === 'number' && !Number.isFinite(value)))) issue('Extended master contains non-finite geometry.')
  }

  const pass3Counts = contract.pass3Reactivity.counts
  if (pass3Counts.circuit_core_routes !== MAINFRAME_EXPECTED_COUNTS.routes) issue('Pass 3 circuit route count changed.')
  if (pass3Counts.radar_modules !== MAINFRAME_EXPECTED_COUNTS.radars) issue('Pass 3 radar count changed.')
  if (pass3Counts.computer_chips !== MAINFRAME_EXPECTED_COUNTS.chips) issue('Pass 3 chip count changed.')
  if (pass3Counts.via_vector_elements !== MAINFRAME_EXPECTED_COUNTS.viaElements) issue('Pass 3 via element count changed.')
  if (pass3Counts.reactive_terminal_elements !== MAINFRAME_EXPECTED_COUNTS.reactiveTerminalElements) issue('Pass 3 terminal element count changed.')
  if (pass3Counts.logo_reactive_parts !== MAINFRAME_EXPECTED_COUNTS.logoParts) issue('Pass 3 logo part count changed.')

  for (const route of contract.routes) {
    if (!route.bank || !route.region || !route.signal) issue(`${route.id} is missing bank, region, or signal metadata.`)
    if (!same(route.points, route.svg.pass1) || !same(route.points, route.svg.pass2) || !same(route.points, route.svg.pass3)) issue(`${route.id} coordinates differ across the manifest/SVG passes.`)
    if (route.pass3.route !== route.id || route.pass3.bank !== route.bank || route.pass3.region !== route.region) issue(`${route.id} Pass 3 identity metadata differs from the reactivity map.`)
    if (route.pass3.reactive !== 'true' || route.pass3.role !== 'circuit-core' || route.pass3.pathLength !== '1') issue(`${route.id} lost its reactive normalized core contract.`)
    for (const [pass, suffixes] of Object.entries(ROUTE_LAYER_SUFFIXES)) for (const suffix of suffixes) {
      if (!element(contract.svgs[pass], `${route.id}-${suffix}`)) issue(`${route.id}-${suffix} is missing from ${pass}.`)
    }
  }

  const routeIds = sorted(contract.routes.map(route => route.id))
  const bankIds = sorted(Object.values(contract.banks).flatMap(group => group.ids))
  const regionIds = sorted(Object.values(contract.regions).flatMap(group => group.ids))
  if (!same(routeIds, bankIds)) issue('Circuit banks do not cover every route exactly once.')
  if (!same(routeIds, regionIds)) issue('Circuit regions do not cover every route exactly once.')
  if (!same(Object.keys(contract.banks), ['A', 'B', 'C', 'D'])) issue('Expected circuit banks A, B, C, and D.')
  if (Object.keys(contract.regions).length !== 8) issue('Expected eight circuit regions.')
  for (const system of EXPECTED_SYSTEMS) if (!element(contract.svgs.pass3, system)) issue(`Pass 3 system ${system} is missing.`)
  if (/<image\b/i.test(contract.svgs.pass1) || /<image\b/i.test(contract.svgs.pass2) || /<image\b/i.test(contract.svgs.pass3)) issue('A source SVG unexpectedly embeds a raster image.')

  for (const [part, paths] of Object.entries(contract.logo.paths)) {
    if (!paths.pass1 || paths.pass1 !== paths.pass2 || paths.pass1 !== paths.pass3) issue(`Exact ${part} logo geometry differs across passes.`)
  }
  for (const route of contract.routes) if (pathData(contract.svgs.extended, `${route.id}-core`) !== pathData(contract.svgs.pass3, `${route.id}-core`)) issue(`${route.id} changed inside the extended master's preserved 1920 × 1080 centre.`)
  for (const [part, ids] of Object.entries(LOGO_IDS)) if (pathData(contract.svgs.extended, ids.pass3) !== contract.logo.paths[part].pass3) issue(`The ${part} logo changed inside the extended master.`)
  if (!contract.logo.bounds || !same(contract.bounds.authored, { minX: 0, minY: 0, maxX: 1920, maxY: 1080 })) issue('Authored geometry must retain the full 1920 × 1080 bounds.')

  for (const [pass, suffixes] of Object.entries(ROUTE_LAYER_SUFFIXES)) for (const suffix of suffixes) {
    const count = countIds(contract.svgs[pass], new RegExp(`id=["'](?:L|R|LM|RM|T|B|BL|BR)\\d{2}-${suffix}["']`, 'g'))
    if (count !== MAINFRAME_EXPECTED_COUNTS.routes) issue(`${pass} must contain ${MAINFRAME_EXPECTED_COUNTS.routes} ${suffix} route elements; found ${count}.`)
  }
  return Object.freeze(issues)
}

export function assertMainframeSourceContract(contract) {
  const issues = validateMainframeSourceContract(contract)
  if (issues.length > 0) throw new Error(`Mainframe source contract failed:\n- ${issues.join('\n- ')}`)
  return contract
}

export function createMainframeSourceAudit(contract) {
  const groupAudit = groups => Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, { count: group.ids.length, ids: group.ids, bounds: group.bounds }]))
  return Object.freeze({
    asset: 'Mainframe',
    sourceVersion: contract.pass3Reactivity.asset.version,
    canvas: MAINFRAME_CANVAS,
    hashes: contract.hashes,
    counts: Object.freeze({
      routes: contract.routes.length,
      terminals: contract.pass1Manifest.terminals.length,
      radars: contract.pass1Manifest.radar_components.length,
      chips: contract.pass1Manifest.computer_chips.length,
      vias: contract.components.vias.length,
      logoParts: Object.keys(contract.pass3Reactivity.components.logo).length,
      extensionRoutes: contract.extension.routes.length,
      extensionPlates: contract.extension.plates.length,
      extensionRadars: contract.extension.radars.length,
      extensionChips: contract.extension.chips.length,
      extensionTerminals: contract.extension.terminals.length,
    }),
    bounds: contract.bounds,
    extension: Object.freeze({ canvas: contract.extension.canvas, bounds: contract.extension.bounds }),
    routeIds: Object.freeze(sorted(contract.routes.map(route => route.id))),
    banks: Object.freeze(groupAudit(contract.banks)),
    regions: Object.freeze(groupAudit(contract.regions)),
    logo: Object.freeze({
      transform: contract.logo.transform,
      bounds: contract.logo.bounds,
      pathSha256: Object.freeze(Object.fromEntries(Object.entries(contract.logo.paths).map(([part, paths]) => [part, sha256(paths.pass1)]))),
    }),
  })
}
