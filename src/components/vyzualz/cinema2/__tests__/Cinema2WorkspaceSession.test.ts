import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID,
  CINEMA2_ELECTRIC_STORM_PRESET_ID,
  CINEMA2_REACTOR_CORE_SIZE_ID,
  CINEMA2_REACTOR_PRESET_ID,
  CINEMA2_REACTOR_USER_MEDIA_SLOT_ID,
  Cinema2Runtime,
  Cinema2WorkspaceSessionStore,
  captureCinema2WorkspacePresetState,
  restoreCinema2WorkspaceMedia,
  type Cinema2LoadedMedia,
  type Cinema2MediaLoader,
} from '..'

class FakeCanvas extends EventTarget {
  width = 640
  height = 360
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext) {
    super()
    this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null)
  }
}

const mediaLoader: Cinema2MediaLoader = {
  async load(): Promise<Cinema2LoadedMedia> {
    return {
      pixelSource: {} as TexImageSource,
      width: 1920,
      height: 1080,
      dynamic: false,
      dispose: vi.fn(),
    }
  },
}

function getRuntimeFields(store: object): unknown[] {
  return Object.values(store)
}

function createRuntime(serializedParameterState?: string, presetId = CINEMA2_REACTOR_PRESET_ID) {
  const gl = createCinemaMockWebGL()
  const canvas = new FakeCanvas(gl)
  const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
    presetId,
    serializedParameterState,
    mediaLoader,
  })
  expect(result.error).toBeNull()
  expect(result.runtime).not.toBeNull()
  return result.runtime!
}

describe('Cinema 2.0 workspace re-entry state', () => {
  it('captures only persistent parameter/media descriptors and reconstructs them through canonical runtime owners', async () => {
    const first = createRuntime()
    expect(first.getParameterState().setPersistentValue(CINEMA2_REACTOR_CORE_SIZE_ID, 1.37).ok).toBe(true)
    await first.getMediaSlotRuntime().replace(CINEMA2_REACTOR_USER_MEDIA_SLOT_ID, {
      id: 'workspace-media',
      revision: 7,
      label: 'Workspace Media',
      kind: 'image',
      url: 'blob:workspace-media',
      mimeType: 'image/png',
    })

    const saved = captureCinema2WorkspacePresetState(first)
    expect(saved.presetId).toBe(CINEMA2_REACTOR_PRESET_ID)
    expect(saved.mediaSlots).toHaveLength(1)
    expect(saved.mediaSlots[0]?.source.id).toBe('workspace-media')
    first.dispose()

    const second = createRuntime(saved.serializedParameterState)
    await restoreCinema2WorkspaceMedia(second, saved)

    expect(second.getParameterState().getValue(CINEMA2_REACTOR_CORE_SIZE_ID)).toBe(1.37)
    expect(second.getMediaSlotRuntime().getSlotSnapshot(CINEMA2_REACTOR_USER_MEDIA_SLOT_ID)).toMatchObject({
      status: 'ready',
      source: { id: 'workspace-media', revision: 7 },
    })
    expect(second.getResourceManagerSnapshot().disposed).toBe(false)
    second.dispose()
  })


  it('round-trips Electric Storm production effect state while leaving transient thunder state runtime-owned', () => {
    const first = createRuntime(undefined, CINEMA2_ELECTRIC_STORM_PRESET_ID)
    expect(first.getParameterState().setPersistentValue(CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID, 0.27).ok).toBe(true)
    const saved = captureCinema2WorkspacePresetState(first)
    expect(saved.presetId).toBe(CINEMA2_ELECTRIC_STORM_PRESET_ID)
    first.dispose()

    const second = createRuntime(saved.serializedParameterState, CINEMA2_ELECTRIC_STORM_PRESET_ID)
    expect(second.getParameterState().getValue(CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID)).toBe(0.27)
    expect(second.getModuleRuntimeSnapshot()).toMatchObject({ failedModuleCount: 0 })
    second.dispose()
  })


  it('keeps the selected preset and inactive snapshots in an explicit session owner without retaining the runtime', () => {
    const runtime = createRuntime()
    const store = new Cinema2WorkspaceSessionStore()
    store.selectPreset(CINEMA2_REACTOR_PRESET_ID)
    const state = store.captureRuntime(runtime)
    runtime.dispose()

    expect(store.getActivePresetId()).toBe(CINEMA2_REACTOR_PRESET_ID)
    expect(store.getPresetState(CINEMA2_REACTOR_PRESET_ID)).toEqual(state)
    expect(getRuntimeFields(store)).not.toContain(runtime)

    store.reset()
    expect(store.getActivePresetId()).toBeNull()
    expect(store.getPresetState(CINEMA2_REACTOR_PRESET_ID)).toBeNull()
  })

  it('ignores restore state for a different active preset rather than mutating it', async () => {
    const first = createRuntime()
    const saved = captureCinema2WorkspacePresetState(first)
    first.dispose()

    const foundation = Cinema2Runtime.create(new FakeCanvas(createCinemaMockWebGL()) as unknown as HTMLCanvasElement, {
      mediaLoader,
    }).runtime!
    await restoreCinema2WorkspaceMedia(foundation, saved)
    expect(foundation.getMediaSlotRuntimeSnapshot().slotCount).toBe(0)
    foundation.dispose()
  })
})
