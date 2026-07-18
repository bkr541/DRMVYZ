import { describe, expect, it } from 'vitest'
import {
  LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE,
  LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS,
  missingLaserDmxWebGLReferenceScenes,
} from './LaserDmxWebGLVisualReferenceManifest'

describe('LaserDMX WebGL physical reference manifest', () => {
  it('keeps every required physical and musical reference scene unique', () => {
    expect(LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS).toHaveLength(67)
    expect(new Set(LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS)).toHaveLength(67)
  })

  it('reports supported-platform coverage gaps explicitly', () => {
    const covered = LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS.slice(0, -2)
    expect(missingLaserDmxWebGLReferenceScenes(covered)).toEqual(
      LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS.slice(-2),
    )
    expect(missingLaserDmxWebGLReferenceScenes(LASER_DMX_WEBGL_REQUIRED_REFERENCE_SCENE_IDS)).toEqual([])
  })

  it('uses a nontrivial perceptual envelope instead of accepting any non-black pixel', () => {
    expect(LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE.minimumLitPixelRatio).toBeGreaterThan(0)
    expect(LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE.minimumConnectedLitRatio).toBeGreaterThan(0.5)
    expect(LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE.maximumHighlightRatio).toBeLessThan(0.5)
    expect(LASER_DMX_WEBGL_REFERENCE_METRIC_ENVELOPE.maximumWashedBrightRatio).toBeLessThan(0.25)
  })
})
