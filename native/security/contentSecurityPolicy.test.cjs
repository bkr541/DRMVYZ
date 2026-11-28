'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildContentSecurityPolicy } = require('./contentSecurityPolicy.cjs')

const directives = policy => Object.fromEntries(policy.split('; ').map(entry => { const [name, ...sources] = entry.split(' '); return [name, sources] }))

test('runs only the app\'s own scripts: no inline scripts, no eval, WebAssembly allowed', () => {
  const policy = directives(buildContentSecurityPolicy())
  assert.deepEqual(policy['script-src'], ["'self'", "'wasm-unsafe-eval'"])
  assert.equal(policy['object-src'][0], "'none'")
  assert.deepEqual(policy['base-uri'], ["'self'"])
})

test('connects only to the app and Supabase', () => {
  const policy = directives(buildContentSecurityPolicy())
  assert.deepEqual(policy['connect-src'], ["'self'", 'data:', 'blob:', 'https://*.supabase.co', 'wss://*.supabase.co'])
  assert.equal(policy['default-src'][0], "'self'")
})

test('adds a custom Supabase domain, for https and its websocket, and nothing for the standard one', () => {
  assert.deepEqual(directives(buildContentSecurityPolicy({ supabaseUrl: 'https://api.stageless.example' }))['connect-src'].slice(-2), ['https://api.stageless.example', 'wss://api.stageless.example'])
  assert.equal(directives(buildContentSecurityPolicy({ supabaseUrl: 'https://abc.supabase.co' }))['connect-src'].length, 5)
  assert.equal(directives(buildContentSecurityPolicy({ supabaseUrl: 'not a url' }))['connect-src'].length, 5)
})

test('forbids framing in the header, and leaves frame-ancestors out of the meta tag (browsers ignore it there)', () => {
  assert.deepEqual(directives(buildContentSecurityPolicy({ delivery: 'header' }))['frame-ancestors'], ["'none'"])
  assert.equal(directives(buildContentSecurityPolicy({ delivery: 'meta' }))['frame-ancestors'], undefined)
})
