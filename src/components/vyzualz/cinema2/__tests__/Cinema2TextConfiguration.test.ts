import { describe, expect, it, vi } from 'vitest'
import type { Cinema2ParameterId, Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_TEXT_FIELDS, applySavedText, createTextDraft, textContentError, textParameters, validateTextParameters, type Cinema2SavedText, type Cinema2TextPresetId } from '../text/Cinema2TextConfiguration'
import type { Cinema2Runtime } from '../runtime/Cinema2Runtime'

export function textFixture(presetId: Cinema2TextPresetId = 'drmvyz.cinema2.say-it'): Cinema2SavedText {
  const draft = createTextDraft(presetId)
  const textId = CINEMA2_TEXT_FIELDS[presetId].find(id => draft.getDefinition(id as Cinema2ParameterId)?.type === 'string')!
  draft.setPersistentValue(textId as Cinema2ParameterId, 'HELLO')
  return { id: crypto.randomUUID(), name: 'Welcome', schemaVersion: 1, presetId, parameters: textParameters(presetId, draft), createdAt: new Date().toISOString() }
}

describe('Cinema 2.0 saved text configuration', () => {
  it.each(Object.keys(CINEMA2_TEXT_FIELDS) as Cinema2TextPresetId[])('captures and recalls %s without changing performance settings', presetId => {
    const plan = cinema2NativePresetRegistry.compile(presetId as Cinema2PresetId)
    if (!plan.ok) throw new Error('Expected compiled text preset')
    const state = new Cinema2ParameterState(plan.plan.parameters)
    const record = textFixture(presetId)
    const unrelated = plan.plan.parameters.definitions.find(definition => definition.type === 'boolean' && !(CINEMA2_TEXT_FIELDS[presetId] as readonly string[]).includes(definition.id))!
    state.setPersistentValue(unrelated.id, false)
    const callback = vi.fn()
    state.subscribe(callback)
    applySavedText({ getCompiledPresetPlan: () => plan.plan, getParameterState: () => state } as Cinema2Runtime, record)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(state.getValue(unrelated.id)).toBe(false)
    expect(textParameters(presetId, createTextDraft(presetId, state))).toEqual(validateTextParameters(presetId, record.parameters))
    const blankDraft = createTextDraft(presetId)
    expect(textContentError(presetId, textParameters(presetId, blankDraft))).toBe('Enter at least one text message.')
  })

  it('rejects mixed valid/invalid patches without publishing partial changes', () => {
    const state = createTextDraft('drmvyz.cinema2.say-it')
    const callback = vi.fn()
    state.subscribe(callback)
    const before = state.serialize()
    const result = state.setPersistentValues({ 'say-it-text': 'NEW', 'say-it-alignment': 'invalid-option' })
    expect(result.ok).toBe(false)
    expect(state.serialize()).toBe(before)
    expect(callback).not.toHaveBeenCalled()
    expect(() => validateTextParameters('drmvyz.cinema2.say-it', { ...textFixture().parameters, 'say-it-motion': 0 })).toThrow('fields do not match')
  })

  it('rejects unsupported and overlong text before saving, including empty SAY IT fallback', () => {
    const record = textFixture()
    expect(textContentError(record.presetId, { ...record.parameters, 'say-it-text': '🚀' })).toContain('Basic Latin')
    expect(textContentError(record.presetId, { ...record.parameters, 'say-it-text': '1234567890123' })).toContain('12 characters')
    const marquee = textFixture('drmvyz.cinema2.marquee')
    expect(textContentError(marquee.presetId, { ...marquee.parameters, 'marquee-front-text': 'A'.repeat(49) })).toContain('48 characters')
    const nightshift = textFixture('drmvyz.cinema2.nightshift')
    expect(textContentError(nightshift.presetId, { ...nightshift.parameters, 'nightshift-sign-text': 'A'.repeat(65) })).toContain('64 characters')
  })

  it('rejects recall into another preset', () => {
    expect(() => applySavedText({ getCompiledPresetPlan: () => ({ presetId: 'drmvyz.cinema2.nightshift' }) } as Cinema2Runtime, textFixture())).toThrow('matching')
  })
})
