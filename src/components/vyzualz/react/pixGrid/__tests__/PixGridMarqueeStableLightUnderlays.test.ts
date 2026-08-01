import { describe, expect, it } from 'vitest'
import { samplePixGridBuiltInAsset } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import {
  getPixGridNeonMarqueeFrames,
  PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT,
  PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT,
  PIX_GRID_NEON_MARQUEE_FRAME_WIDTH,
} from '../PixGridNeonMarqueeFrames'
import {
  PIX_GRID_NEON_MARQUEE_STABLE_UNDERLAY_COMPONENT_IDS,
  PIX_GRID_NEON_MARQUEE_STABLE_UNDERLAY_DIM_SCALE_BY_COMPONENT,
  type PixGridNeonMarqueeStableUnderlayComponentId,
  pixGridNeonMarqueeComponentContainsCell,
  pixGridNeonMarqueeStableUnderlayContainsCell,
  samplePixGridNeonMarqueeComponent,
  samplePixGridNeonMarqueeStableUnderlay,
} from '../PixGridNeonMarqueeMasks'
import { PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION, PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { migratePixGridState } from '../PixGridStateMigration'
import {
  PIX_GRID_MARQUEE_LETTER_LAYER_IDS,
  PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES,
  createPixGridMarqueeStableUnderlayFixtureFrame,
  createPixGridMarqueeStableUnderlayFixtureState,
  fnv1aPixGridLogicalFrame,
} from './__fixtures__/PixGridMarqueeStableUnderlayFixture'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
const LETTER_COMPONENTS = ['letter-a', 'letter-b', 'letter-c'] as const

function sourceColor(frameIndex: number, x: number, y: number): readonly [number, number, number] {
  const rgb = getPixGridNeonMarqueeFrames()[frameIndex]
  const offset = (y * PIX_GRID_NEON_MARQUEE_FRAME_WIDTH + x) * 3
  return [rgb[offset], rgb[offset + 1], rgb[offset + 2]]
}

function dimmed(
  color: readonly [number, number, number],
  component: PixGridNeonMarqueeStableUnderlayComponentId,
): readonly [number, number, number] {
  const scale = PIX_GRID_NEON_MARQUEE_STABLE_UNDERLAY_DIM_SCALE_BY_COMPONENT[component]
  return [
    Math.round(color[0] * scale),
    Math.round(color[1] * scale),
    Math.round(color[2] * scale),
  ]
}

function logicalColor(pixels: Uint8Array, x: number, y: number): readonly [number, number, number, number] {
  const offset = (y * PIX_GRID_NEON_MARQUEE_FRAME_WIDTH + x) * 4
  return [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]]
}

function firstCell(component: Parameters<typeof pixGridNeonMarqueeComponentContainsCell>[0], frameIndex: number): readonly [number, number] | null {
  for (let y = 0; y < PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < PIX_GRID_NEON_MARQUEE_FRAME_WIDTH; x += 1) {
      if (pixGridNeonMarqueeComponentContainsCell(component, frameIndex, x, y)) return [x, y]
    }
  }
  return null
}

describe('Marquee stable structural underlays', () => {
  it('preserves the exclusive structure asset for compatibility and uses the overlapping asset in the canonical preset', () => {
    expect(PRESET.pixGridSettings?.layers?.find(layer => layer.id === 'marquee-structure')?.assetId)
      .toBe('pix-neon-marquee-stable-underlay')

    let compatibilityMismatches = 0
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      for (let y = 0; y < PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT; y += 1) {
        for (let x = 0; x < PIX_GRID_NEON_MARQUEE_FRAME_WIDTH; x += 1) {
          const u = (x + 0.5) / PIX_GRID_NEON_MARQUEE_FRAME_WIDTH
          const v = (y + 0.5) / PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT
          const compatibility = samplePixGridBuiltInAsset('pix-neon-marquee-structure', u, v, frameIndex)
          const exclusive = samplePixGridNeonMarqueeComponent('structure', u, v, frameIndex)
          compatibilityMismatches += Number(
            compatibility.alpha !== exclusive.alpha
            || compatibility.role !== exclusive.role
            || compatibility.color?.some((channel, index) => channel !== exclusive.color[index]),
          )
        }
      }
    }
    expect(compatibilityMismatches).toBe(0)
  })

  it('migrates stale canonical structure layers from the exclusive compatibility asset to the stable underlay', () => {
    const fixture = PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES.find(candidate => candidate.id === 'drop-scene')!
    const stale = createPixGridMarqueeStableUnderlayFixtureState(PRESET, fixture, 'pix-neon-marquee-structure')
    stale.configuration.presetConfigurationVersion = PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION - 1

    const migrated = migratePixGridState(stale)
    expect(migrated.layers.find(layer => layer.id === 'marquee-structure')?.assetId)
      .toBe('pix-neon-marquee-stable-underlay')
    expect(migrated.configuration.presetConfigurationVersion).toBe(PIX_GRID_NEON_MARQUEE_CONFIGURATION_VERSION)
  })

  it('uses sparse alpha for every semantic layer and overlaps a dim source-derived physical emitter bed', () => {
    let membershipMismatches = 0
    let colorMismatches = 0
    let nonMemberOpaqueCells = 0
    let underlayCellCount = 0
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      for (let y = 0; y < PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT; y += 1) {
        for (let x = 0; x < PIX_GRID_NEON_MARQUEE_FRAME_WIDTH; x += 1) {
          const u = (x + 0.5) / PIX_GRID_NEON_MARQUEE_FRAME_WIDTH
          const v = (y + 0.5) / PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT
          const stable = samplePixGridNeonMarqueeStableUnderlay(u, v, frameIndex)
          const authoredStructure = pixGridNeonMarqueeComponentContainsCell('structure', frameIndex, x, y)
          const underlayComponent = PIX_GRID_NEON_MARQUEE_STABLE_UNDERLAY_COMPONENT_IDS.find(component => (
            pixGridNeonMarqueeComponentContainsCell(component, frameIndex, x, y)
          ))
          const expectedMembership = pixGridNeonMarqueeStableUnderlayContainsCell(frameIndex, x, y)
          membershipMismatches += Number((stable.alpha > 0) !== expectedMembership)

          for (const component of PIX_GRID_NEON_MARQUEE_STABLE_UNDERLAY_COMPONENT_IDS) {
            const semantic = samplePixGridNeonMarqueeComponent(component, u, v, frameIndex)
            const member = pixGridNeonMarqueeComponentContainsCell(component, frameIndex, x, y)
            membershipMismatches += Number((semantic.alpha > 0) !== member)
            nonMemberOpaqueCells += Number(!member && semantic.alpha > 0)
          }

          if (authoredStructure) {
            const expected = sourceColor(frameIndex, x, y)
            colorMismatches += Number(stable.alpha !== 1 || stable.color.some((channel, index) => channel !== expected[index]))
          } else if (underlayComponent) {
            underlayCellCount += 1
            const expectedDim = dimmed(sourceColor(frameIndex, x, y), underlayComponent)
            const bright = samplePixGridNeonMarqueeComponent(underlayComponent, u, v, frameIndex)
            const expectedBright = sourceColor(frameIndex, x, y)
            colorMismatches += Number(
              stable.alpha !== 1
              || stable.color.some((channel, index) => channel !== expectedDim[index])
              || bright.color.some((channel, index) => channel !== expectedBright[index]),
            )
          } else {
            membershipMismatches += Number(stable.alpha !== 0)
          }
        }
      }
    }
    expect(membershipMismatches).toBe(0)
    expect(colorMismatches).toBe(0)
    expect(nonMemberOpaqueCells).toBe(0)
    expect(underlayCellCount).toBeGreaterThan(10_000)
  })

  it('keeps every authored bulb, letter, equalizer, trim, focal, and sparkle cell present in structure-only frames', () => {
    const fixture = PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES.find(candidate => candidate.id === 'only-structure-active')!
    let missingOrIncorrectCells = 0
    let checkedCells = 0
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      const logical = composePixGridLogicalFrame(
        PRESET,
        createPixGridMarqueeStableUnderlayFixtureState(PRESET, fixture, 'pix-neon-marquee-stable-underlay'),
        createPixGridMarqueeStableUnderlayFixtureFrame(fixture, frameIndex),
      )
      for (const component of PIX_GRID_NEON_MARQUEE_STABLE_UNDERLAY_COMPONENT_IDS) {
        for (let y = 0; y < PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT; y += 1) {
          for (let x = 0; x < PIX_GRID_NEON_MARQUEE_FRAME_WIDTH; x += 1) {
            if (!pixGridNeonMarqueeComponentContainsCell(component, frameIndex, x, y)) continue
            checkedCells += 1
            const pixel = logicalColor(logical.pixels, x, y)
            const expected = dimmed(sourceColor(frameIndex, x, y), component)
            missingOrIncorrectCells += Number(
              pixel[3] !== 255 || pixel.slice(0, 3).some((channel, index) => channel !== expected[index]),
            )
          }
        }
      }
    }
    expect(checkedCells).toBeGreaterThan(3_000)
    expect(missingOrIncorrectCells).toBe(0)
  })

  it('restores exact source RGB over the dim underlay when a bright letter bank is active', () => {
    const oneBank = PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES.find(candidate => candidate.id === 'one-letter-bank-active')!
    const allOff = PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES.find(candidate => candidate.id === 'all-letter-banks-off')!
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      const oneBankFrame = composePixGridLogicalFrame(
        PRESET,
        createPixGridMarqueeStableUnderlayFixtureState(PRESET, oneBank, 'pix-neon-marquee-stable-underlay'),
        createPixGridMarqueeStableUnderlayFixtureFrame(oneBank, frameIndex),
      )
      const allOffFrame = composePixGridLogicalFrame(
        PRESET,
        createPixGridMarqueeStableUnderlayFixtureState(PRESET, allOff, 'pix-neon-marquee-stable-underlay'),
        createPixGridMarqueeStableUnderlayFixtureFrame(allOff, frameIndex),
      )

      const activeCell = firstCell('letter-a', frameIndex)
      if (activeCell) {
        expect(logicalColor(oneBankFrame.pixels, ...activeCell)).toEqual([...sourceColor(frameIndex, ...activeCell), 255])
      }
      for (const component of LETTER_COMPONENTS) {
        const cell = firstCell(component, frameIndex)
        if (!cell) continue
        expect(logicalColor(allOffFrame.pixels, ...cell)).toEqual([...dimmed(sourceColor(frameIndex, ...cell), component), 255])
      }
    }
  })

  it('matches the exact source frame with every lighting layer active', () => {
    const fixture = PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES.find(candidate => candidate.id === 'all-lighting-active')!
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      const logical = composePixGridLogicalFrame(
        PRESET,
        createPixGridMarqueeStableUnderlayFixtureState(PRESET, fixture, 'pix-neon-marquee-stable-underlay'),
        createPixGridMarqueeStableUnderlayFixtureFrame(fixture, frameIndex),
      )
      const source = getPixGridNeonMarqueeFrames()[frameIndex]
      const expected = new Uint8Array(PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT * 4)
      for (let cell = 0; cell < PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT; cell += 1) {
        const sourceOffset = cell * 3
        const outputOffset = cell * 4
        expected[outputOffset] = source[sourceOffset]
        expected[outputOffset + 1] = source[sourceOffset + 1]
        expected[outputOffset + 2] = source[sourceOffset + 2]
        expected[outputOffset + 3] = source[sourceOffset] || source[sourceOffset + 1] || source[sourceOffset + 2] ? 255 : 0
      }
      expect(logical.pixels).toEqual(expected)
    }
  })

  it('locks deterministic paired before-and-after logical fixtures for every sign and scene state', () => {
    for (const fixture of PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES) {
      for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
        const frame = createPixGridMarqueeStableUnderlayFixtureFrame(fixture, frameIndex)
        const before = composePixGridLogicalFrame(
          PRESET,
          createPixGridMarqueeStableUnderlayFixtureState(PRESET, fixture, 'pix-neon-marquee-structure'),
          frame,
        )
        const after = composePixGridLogicalFrame(
          PRESET,
          createPixGridMarqueeStableUnderlayFixtureState(PRESET, fixture, 'pix-neon-marquee-stable-underlay'),
          frame,
        )
        const beforeHash = fnv1aPixGridLogicalFrame(before.pixels)
        const afterHash = fnv1aPixGridLogicalFrame(after.pixels)
        expect(beforeHash).toBe(fixture.expectedBeforeHashes[frameIndex])
        expect(afterHash).toBe(fixture.expectedAfterHashes[frameIndex])
        if (fixture.id === 'all-lighting-active') expect(afterHash).toBe(beforeHash)
        else expect(afterHash).not.toBe(beforeHash)
      }
    }
  })

  it('keeps the fixture layer vocabulary aligned with the authored letter banks', () => {
    expect(PIX_GRID_MARQUEE_LETTER_LAYER_IDS).toEqual([
      'marquee-letter-lights-a',
      'marquee-letter-lights-b',
      'marquee-letter-lights-c',
    ])
  })
})
