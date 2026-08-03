import { describe, expect, it } from 'vitest'
import {
  HELP_CENTER,
  HELP_COMPONENT_TYPES,
  HELP_PRIORITIES,
  PRIORITY_ONE_HELP_ENTRIES,
  getHelpEntriesByEngine,
  getHelpEntriesByPriority,
  getHelpEntriesByView,
  getHelpEntry,
  hasHelpEntry,
  validateHelpRegistry,
  type HelpComponentType,
  type HelpEntry,
  type HelpPriority,
} from './HelpCenter'

const entries: readonly HelpEntry[] = PRIORITY_ONE_HELP_ENTRIES

describe('Help Center registry', () => {
  it('contains unique IDs and matching registry keys', () => {
    const ids = entries.map((entry) => entry.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(HELP_CENTER)).toHaveLength(entries.length)
    expect(Object.entries(HELP_CENTER).every(([key, entry]) => key === entry.id)).toBe(true)
  })

  it('uses valid priorities, component types, and nonempty required fields', () => {
    const priorities = new Set<number>(HELP_PRIORITIES)
    const componentTypes = new Set<string>(HELP_COMPONENT_TYPES)

    for (const entry of entries) {
      expect(priorities.has(entry.priority)).toBe(true)
      expect(componentTypes.has(entry.componentType)).toBe(true)
      expect(entry.id.trim()).not.toBe('')
      expect(entry.group.trim()).not.toBe('')
      expect(entry.title.trim()).not.toBe('')
      expect(entry.summary.trim()).not.toBe('')
    }
  })

  it('omits optional strings and arrays instead of storing empty values', () => {
    const optionalStringFields = [
      'whenToUse',
      'defaultValue',
      'range',
      'recommendedRange',
      'tip',
      'auditMismatch',
    ] as const
    const optionalArrayFields = [
      'whatItDoes',
      'affects',
      'doesNotAffect',
      'relatedHelpIds',
      'tags',
    ] as const

    for (const entry of entries) {
      for (const field of optionalStringFields) {
        const value = entry[field]
        expect(value === undefined || value.trim().length > 0).toBe(true)
      }

      for (const field of optionalArrayFields) {
        const values = entry[field]
        expect(values === undefined || values.length > 0).toBe(true)
        expect(values?.every((value) => value.trim().length > 0) ?? true).toBe(true)
      }
    }
  })

  it('resolves every related help ID without self or duplicate references', () => {
    const ids = new Set(entries.map((entry) => entry.id))

    for (const entry of entries) {
      const related = entry.relatedHelpIds ?? []
      expect(new Set(related).size).toBe(related.length)
      expect(related).not.toContain(entry.id)
      expect(related.every((helpId) => ids.has(helpId))).toBe(true)
    }
  })

  it('contains no unresolved audit mismatch markers', () => {
    for (const entry of entries) {
      expect(entry.auditMismatch).toBeUndefined()
      expect(
        entry.tags?.some(
          (tag) => tag === 'auditMismatch' || tag.startsWith('auditMismatch:'),
        ) ?? false,
      ).toBe(false)
    }
  })

  it('keeps lookup utilities aligned with the reconciled registry', () => {
    const first = entries[0]

    expect(first).toBeDefined()
    expect(hasHelpEntry(first.id)).toBe(true)
    expect(getHelpEntry(first.id)).toBe(first)
    expect(getHelpEntry('missing.help.id')).toBeUndefined()
    expect(getHelpEntriesByPriority(1)).toHaveLength(entries.length)
    expect(getHelpEntriesByPriority(2)).toHaveLength(0)
    expect(getHelpEntriesByView(first.view)).toContain(first)
    if (first.engine) expect(getHelpEntriesByEngine(first.engine)).toContain(first)
  })

  it('passes the production registry validator', () => {
    expect(validateHelpRegistry(entries, HELP_CENTER)).toEqual([])
  })

  it('documents both contextual-help regions in the React main header', () => {
    expect(getHelpEntry('react.shared.header.audioInput')).toMatchObject({
      title: 'Audio Input',
      componentType: 'select',
    })
    expect(getHelpEntry('react.shared.header.productionOutput')).toMatchObject({
      title: 'Production Output',
      componentType: 'group',
    })
  })

  it('reports malformed synthetic entries without a new validation dependency', () => {
    const base: HelpEntry = {
      id: 'test.entry',
      priority: 1,
      view: 'react',
      group: 'Test',
      title: 'Test entry',
      componentType: 'group',
      summary: 'Valid test summary.',
    }
    const malformed: HelpEntry = {
      ...base,
      priority: 9 as HelpPriority,
      componentType: 'invalid' as HelpComponentType,
      title: ' ',
      whenToUse: ' ',
      whatItDoes: [],
      relatedHelpIds: ['test.entry', 'missing.entry', 'missing.entry'],
      tags: ['auditMismatch'],
    }
    const registry = {
      'wrong.registry.key': malformed,
    }

    const codes = validateHelpRegistry([base, malformed], registry).map((issue) => issue.code)

    expect(codes).toEqual(expect.arrayContaining([
      'duplicate-id',
      'registry-key-mismatch',
      'registry-entry-missing',
      'invalid-priority',
      'invalid-component-type',
      'empty-required-string',
      'empty-optional-string',
      'empty-optional-array',
      'invalid-related-help-id',
      'self-related-help-id',
      'duplicate-related-help-id',
      'unresolved-audit-mismatch',
    ]))
  })
})
