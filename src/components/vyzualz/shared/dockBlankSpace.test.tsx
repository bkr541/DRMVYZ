// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { isDockBlankSpace } from './dockBlankSpace'

afterEach(() => document.body.replaceChildren())

describe('audio dock empty-space detection', () => {
  it('recognizes the dock and its structural wrappers', () => {
    const dock = document.createElement('section')
    document.body.append(dock)
    expect(isDockBlankSpace(dock, dock)).toBe(true)
    for (const className of ['vz-dock-region', 'vz-dock-card', 'vz-dock-left-body', 'vz-dock-right-main', 'vz-dock-right-btns']) {
      const wrapper = document.createElement('div')
      wrapper.className = className
      dock.append(wrapper)
      expect(isDockBlankSpace(wrapper, dock)).toBe(true)
    }
  })

  it('excludes controls, content, non-elements and wrappers outside the dock', () => {
    const dock = document.createElement('section')
    document.body.append(dock)
    for (const tag of ['button', 'input', 'span', 'canvas']) {
      const content = document.createElement(tag)
      dock.append(content)
      expect(isDockBlankSpace(content, dock)).toBe(false)
    }
    const outside = document.createElement('div')
    outside.className = 'vz-dock-card'
    document.body.append(outside)
    expect(isDockBlankSpace(outside, dock)).toBe(false)
    expect(isDockBlankSpace(null, dock)).toBe(false)
    expect(isDockBlankSpace(document.createTextNode('Track title'), dock)).toBe(false)
  })
})
