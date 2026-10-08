import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAINFRAME_CANVAS,
  MAINFRAME_EXPECTED_COUNTS,
  MAINFRAME_SOURCE_SHA256,
  assertMainframeSourceContract,
  createMainframeSourceAudit,
  loadMainframeSourceContract,
  validateMainframeSourceContract,
} from './mainframe-source-contract.mjs'

const contract = loadMainframeSourceContract()

test('the owner-supplied Mainframe masters retain their immutable source hashes', () => {
  assert.deepEqual(contract.hashes, MAINFRAME_SOURCE_SHA256)
})

test('the Mainframe source contract validates every pass as one 1920 by 1080 layout', () => {
  assert.equal(assertMainframeSourceContract(contract), contract)
  assert.deepEqual(validateMainframeSourceContract(contract), [])
  assert.deepEqual(contract.pass1Manifest.canvas, MAINFRAME_CANVAS)
  assert.deepEqual(contract.pass2Manifest.canvas, MAINFRAME_CANVAS)
  assert.deepEqual(contract.pass3Reactivity.asset.canvas, MAINFRAME_CANVAS)
  assert.deepEqual(contract.bounds.authored, { minX: 0, minY: 0, maxX: 1920, maxY: 1080 })
})

test('all 60 routes preserve coordinates and complete bank/region/signal metadata', () => {
  assert.equal(contract.routes.length, MAINFRAME_EXPECTED_COUNTS.routes)
  assert.deepEqual(Object.fromEntries(Object.entries(contract.banks).map(([id, group]) => [id, group.ids.length])), { A: 16, B: 16, C: 20, D: 8 })
  assert.deepEqual(Object.fromEntries(Object.entries(contract.regions).map(([id, group]) => [id, group.ids.length])), {
    'bottom-center': 6,
    'left-branch': 8,
    'left-major': 10,
    'left-minor': 6,
    'right-branch': 8,
    'right-major': 10,
    'right-minor': 6,
    'top-center': 6,
  })
  for (const route of contract.routes) {
    assert.deepEqual(route.svg.pass1, route.points, `${route.id} Pass 1 geometry`)
    assert.deepEqual(route.svg.pass2, route.points, `${route.id} Pass 2 geometry`)
    assert.deepEqual(route.svg.pass3, route.points, `${route.id} Pass 3 geometry`)
    assert.deepEqual(route.svg.logoMaster, route.points, `${route.id} logo-master geometry`)
    assert.equal(route.pass3.route, route.id)
    assert.equal(route.pass3.bank, route.bank)
    assert.equal(route.pass3.region, route.region)
    assert.ok(route.signal)
  }
})

test('component counts and the exact three-part logo geometry remain production inputs', () => {
  assert.equal(contract.pass1Manifest.terminals.length, MAINFRAME_EXPECTED_COUNTS.terminals)
  assert.equal(contract.pass1Manifest.radar_components.length, MAINFRAME_EXPECTED_COUNTS.radars)
  assert.equal(contract.pass1Manifest.computer_chips.length, MAINFRAME_EXPECTED_COUNTS.chips)
  assert.equal(contract.pass3Reactivity.components.vias.length, MAINFRAME_EXPECTED_COUNTS.viaElements)
  assert.equal(contract.components.vias.length, MAINFRAME_EXPECTED_COUNTS.vias)
  assert.ok(contract.components.vias.every(via => Number.isFinite(via.cx) && Number.isFinite(via.cy) && Number.isFinite(via.radius)))
  for (const paths of Object.values(contract.logo.paths)) {
    assert.ok(paths.pass1.length > 0)
    assert.equal(paths.pass2, paths.pass1)
    assert.equal(paths.pass3, paths.pass1)
  }
  assert.deepEqual(contract.logo.bounds, { minX: 529.8, minY: 269.64, maxX: 1390.2, maxY: 810.36 })
  assert.equal(contract.logo.master.outerRail, contract.logo.master.outerHousing)
  assert.equal(contract.logo.master.bodyRail, contract.logo.master.bodyHousing)
  assert.equal(contract.logo.master.star, contract.logo.paths.star.pass1)
})

test('the owner-supplied 2x master preserves the centre and exposes authored outer hardware', () => {
  assert.deepEqual(contract.extension.canvas, { x: -960, y: -540, width: 3840, height: 2160, aspect: '16:9' })
  assert.equal(contract.extension.routes.length, MAINFRAME_EXPECTED_COUNTS.extensionRoutes)
  assert.equal(contract.extension.plates.length, MAINFRAME_EXPECTED_COUNTS.extensionPlates)
  assert.equal(contract.extension.radars.length, MAINFRAME_EXPECTED_COUNTS.extensionRadars)
  assert.equal(contract.extension.chips.length, MAINFRAME_EXPECTED_COUNTS.extensionChips)
  assert.equal(contract.extension.terminals.length, MAINFRAME_EXPECTED_COUNTS.extensionTerminals)
  assert.deepEqual(contract.extension.bounds, { minX: -964, minY: -540, maxX: 2884, maxY: 1620 })
  assert.deepEqual([...new Set(contract.extension.routes.map(route => route.bank))].sort(), ['A', 'B', 'C'])
  assert.ok(contract.extension.routes.every(route => route.points.length >= 2 && route.coreWidth > 0 && route.housingWidth > route.coreWidth))
})

test('the Stage 1 audit exposes deterministic IDs, bounds, banks, regions, and logo hashes', () => {
  const audit = createMainframeSourceAudit(contract)
  assert.deepEqual(audit.counts, {
    routes: 60, terminals: 46, radars: 4, chips: 2, vias: 36, logoParts: 3,
    extensionRoutes: 356, extensionPlates: 30, extensionRadars: 16, extensionChips: 8, extensionTerminals: 584,
  })
  assert.equal(audit.routeIds[0], 'B01')
  assert.equal(audit.routeIds.at(-1), 'T06')
  assert.equal(audit.banks.A.count, 16)
  assert.equal(audit.regions['left-major'].count, 10)
  assert.deepEqual(audit.bounds.routes, { minX: 0, minY: 0, maxX: 1920, maxY: 1080 })
  assert.deepEqual(Object.keys(audit.logo.pathSha256), ['outer', 'body', 'star'])
  assert.deepEqual(Object.keys(audit.logo.masterPathSha256), ['outerHousing', 'outerRail', 'bodyHousing', 'bodyRail', 'star'])
})
