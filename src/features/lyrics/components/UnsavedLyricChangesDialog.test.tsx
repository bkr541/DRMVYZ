// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UnsavedLyricChangesDialog } from './UnsavedLyricChangesDialog'
import { ConfirmLyricActivationDialog } from './ConfirmLyricActivationDialog'
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { container=document.createElement('div');document.body.append(container);root=createRoot(container) })
afterEach(async () => { await act(async () => root.unmount());container.remove() })
it('uses the canonical hierarchy and preserves Save, Discard and Cancel decisions', async () => {
  const onSave=vi.fn(),onDiscard=vi.fn(),onCancel=vi.fn()
  await act(async () => root.render(<UnsavedLyricChangesDialog open onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} />))
  const dialog=container.querySelector('.dv-confirm-dialog')!
  expect([...dialog.children].map(el=>el.tagName)).toEqual(['SPAN','H2','P','DIV'])
  expect(dialog.querySelector('.dv-confirm-icon--neutral')).not.toBeNull()
  expect(dialog.getAttribute('aria-describedby')).toBe(dialog.querySelector('p')?.id)
  const buttons=[...dialog.querySelectorAll<HTMLButtonElement>('button')]
  expect(buttons.map(el=>el.textContent)).toEqual(['Cancel','Discard','Save'])
  for(const button of buttons) await act(async () => button.click())
  expect(onSave).toHaveBeenCalledOnce();expect(onDiscard).toHaveBeenCalledOnce();expect(onCancel).toHaveBeenCalledOnce()
  await act(async () => root.render(<UnsavedLyricChangesDialog open busy onSave={onSave} onDiscard={onDiscard} onCancel={onCancel} />))
  expect([...dialog.querySelectorAll('button')].every(button=>button.disabled)).toBe(true)
  expect(dialog.textContent).toContain('Saving…')
})
it('keeps activation contextual, busy-safe and explicitly dismissible only by its actions', async () => {
  const onCancel=vi.fn(),onConfirm=vi.fn()
  await act(async () => root.render(<ConfirmLyricActivationDialog targetTitle="New lyrics" currentTitle="Current lyrics" busy={false} onCancel={onCancel} onConfirm={onConfirm} />))
  const dialog=container.querySelector('.dv-confirm-dialog')!
  expect(dialog.textContent).toContain('replace “Current lyrics”')
  await act(async () => container.querySelector('.dv-confirm-backdrop')!.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})))
  expect(onCancel).not.toHaveBeenCalled()
  await act(async () => [...dialog.querySelectorAll('button')].find(el=>el.textContent==='Make Active')!.click())
  expect(onConfirm).toHaveBeenCalledOnce()
})
