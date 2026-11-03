import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReactPresetCard } from '../ReactPresetCard'
import { PRESET_BLUEPRINT_MOTIFS, type AuthoredBlueprintPresetId } from '../PresetBlueprintArtwork'
import { ENGINE_BLUEPRINT_STROKE_WIDTH, PRESET_BLUEPRINT_STROKE_WIDTH } from '../blueprintDrawing'

describe('composed preset blueprint artwork', () => {
  it.each(Object.keys(PRESET_BLUEPRINT_MOTIFS) as AuthoredBlueprintPresetId[])('%s has four primary motifs and bypasses frame tracing', id => {
    const motifs = PRESET_BLUEPRINT_MOTIFS[id]
    expect(motifs).toHaveLength(4)
    expect(new Set(motifs).size).toBe(4)
    const markup = renderToStaticMarkup(<ReactPresetCard id={id} title="Preset" description="" activateLabel="Load preset" onActivate={() => {}} />)
    for (const motif of motifs) expect(markup).toContain(`data-art-motif="${motif}"`)
    expect(markup.match(/data-art-motif=/g)).toHaveLength(4)
    expect(markup).toContain('data-thumbnail-kind="authored-blueprint"')
    expect(markup).toContain(`stroke-width="${PRESET_BLUEPRINT_STROKE_WIDTH}"`)
    expect(markup).not.toContain('<img')
    expect(markup).not.toContain('feConvolveMatrix')
    expect(markup).not.toContain('filter:url')
  })

  it('retains the Engine dropdown drawing weight at its standard display scale', () => {
    expect(ENGINE_BLUEPRINT_STROKE_WIDTH).toBe(.8)
    expect(PRESET_BLUEPRINT_STROKE_WIDTH).toBeCloseTo(.8 * 170 / 150)
  })
})
