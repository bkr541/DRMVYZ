// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PresetBlueprintImage } from './PresetBlueprintImage'

const capture = vi.hoisted(() => vi.fn())
vi.mock('./captureCinema2PresetArtwork', () => ({ captureCinema2PresetArtwork: capture }))

const renderedImage = 'data:image/webp;base64,frame'
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  capture.mockReset().mockResolvedValue(renderedImage)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('missing native preset artwork', () => {
  it('prefers a shipped file and shares a native capture after missing-file errors', async () => {
    const id = 'drmvyz.cinema2.monolith'
    await act(async () => root.render(<><PresetBlueprintImage presetId={id} /><PresetBlueprintImage presetId={id} /></>))
    const images = [...host.querySelectorAll('img')]
    expect(images[0].src).toContain(`${id}.webp`)
    expect(capture).not.toHaveBeenCalled()
    await act(async () => { images.forEach(img => img.dispatchEvent(new Event('error'))) })
    await act(async () => { await vi.waitFor(() => expect(capture).toHaveBeenCalledTimes(1)) })
    expect(capture).toHaveBeenCalledWith(id)
    await vi.waitFor(() => expect(images.every(img => img.getAttribute('src') === renderedImage && !img.hidden)).toBe(true))
  })

  it('does not invoke the Cinema renderer for non-Cinema assets', async () => {
    await act(async () => root.render(<PresetBlueprintImage presetId="canvas-example" />))
    const image = host.querySelector('img')!
    await act(async () => image.dispatchEvent(new Event('error')))
    expect(image.hidden).toBe(true)
    expect(capture).not.toHaveBeenCalled()
  })
})
