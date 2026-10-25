// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LayoutLabDesignWorkbench } from '../LayoutLabDesignWorkbench'
import { LAYOUT_LAB_DESIGNS } from '../layoutLabDesignCatalog'
import { useLyricsStore } from '../../../../../stores/lyricsStore'
import { useAudioStore } from '../../../../../stores/audioStore'
let root: ReturnType<typeof createRoot>, container: HTMLDivElement
beforeEach(()=>{container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null)})
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks()})
async function render(){await act(async()=>root.render(<LayoutLabDesignWorkbench initialWorkspace="lyrics" reference={<div>Reference studies</div>} />));await vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20))});expect(container.querySelector('.lmv-track-browser')).toBeTruthy()})}
async function select(label:string,text:string){const trigger=document.querySelector<HTMLButtonElement>(`[role="combobox"][aria-label="${label}"]`)!;await act(async()=>trigger.click());const option=[...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(button=>button.textContent?.includes(text))!;await act(async()=>option.click())}
describe('full workspace design previews',()=>{
  it('provides five honest design slots and mounts production lyric groups',async()=>{
    await render()
    expect(LAYOUT_LAB_DESIGNS.filter(option=>option.value.startsWith('design-'))).toHaveLength(5)
    expect(LAYOUT_LAB_DESIGNS.slice(2).every(option=>'disabled' in option && option.disabled)).toBe(true)
    expect(container.querySelector('.ll-template-audio-theme')).toBeTruthy()
    expect(container.querySelector('.lmv-track-browser')).toBeTruthy()
    expect(container.querySelector('.lmv-inspector')).toBeTruthy()
    expect(container.querySelector('.lyric-cue-timeline__scroll')).toBeTruthy()
  })
  it('preserves edited cue values and component identity across design changes without updating saved stores',async()=>{
    const lyricsBefore=useLyricsStore.getState(),audioBefore=useAudioStore.getState()
    await render()
    const input=container.querySelector<HTMLTextAreaElement>('textarea')!
    expect(input).toBeTruthy()
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'My local preview lyric');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})
    await select('Layout Lab design','Current app')
    expect(container.querySelector('.ll-template-audio-theme')).toBeNull()
    expect(container.querySelector('textarea')).toBe(input)
    expect(input.value).toBe('My local preview lyric')
    await select('Layout Lab design','Design 01')
    expect(container.querySelector('textarea')).toBe(input)
    expect(input.value).toBe('My local preview lyric')
    expect(useLyricsStore.getState()).toBe(lyricsBefore)
    expect(useAudioStore.getState()).toBe(audioBefore)
  })
})
