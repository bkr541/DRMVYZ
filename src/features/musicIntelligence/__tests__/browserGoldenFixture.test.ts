import { describe, expect, it } from 'vitest'
import { canonicalStringifyBrowserAudioGolden } from '../browserGoldenFixture'

describe('browser audio golden canonicalization', () => {
  it('sorts object keys, preserves array order, normalizes typed arrays, and adds one newline', () => {
    const value = {
      z: new Float32Array([0.25, -0]),
      a: {
        second: 2,
        first: 1,
        omitted: undefined,
      },
      list: [{ b: true, a: false }, null],
    }

    expect(canonicalStringifyBrowserAudioGolden(value)).toBe([
      '{',
      '  "a": {',
      '    "first": 1,',
      '    "second": 2',
      '  },',
      '  "list": [',
      '    {',
      '      "a": false,',
      '      "b": true',
      '    },',
      '    null',
      '  ],',
      '  "z": [',
      '    0.25,',
      '    0',
      '  ]',
      '}',
      '',
    ].join('\n'))
  })

  it('rejects non-finite numeric output instead of silently changing analyzer data', () => {
    expect(() => canonicalStringifyBrowserAudioGolden({ invalid: Number.NaN }))
      .toThrow('Golden fixture cannot serialize non-finite number')
  })
})
