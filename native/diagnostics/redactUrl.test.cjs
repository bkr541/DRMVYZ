'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { redactUrlForLog } = require('./redactUrl.cjs')

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtZWRpYS1pdGVtcy9hLnBuZyJ9.c2lnbmF0dXJl'

test('drops the signed token from a Supabase Storage URL but keeps where the request went', () => {
  const url = `https://abc.supabase.co/storage/v1/object/sign/media-items/u1/uploads/x/original.png?token=${TOKEN}`
  const result = redactUrlForLog(url)
  assert.equal(result, 'https://abc.supabase.co/storage/v1/object/sign/media-items/u1/uploads/x/original.png?[redacted]')
  assert.ok(!result.includes(TOKEN))
  assert.ok(!result.includes('token='))
})

test('drops every query parameter and any fragment, not only "token"', () => {
  const result = redactUrlForLog('https://abc.supabase.co/auth/v1/verify?apikey=SECRET&access_token=SECRET2&type=signup#access_token=SECRET3')
  assert.equal(result, 'https://abc.supabase.co/auth/v1/verify?[redacted]')
  assert.ok(!/SECRET/.test(result))
})

test('leaves a URL without a query unchanged', () => {
  assert.equal(redactUrlForLog('https://abc.supabase.co/rest/v1/brand_kits'), 'https://abc.supabase.co/rest/v1/brand_kits')
})

test('never returns the input for something that is not a parseable URL', () => {
  assert.equal(redactUrlForLog('not a url?token=SECRET'), '[unparseable url]')
  assert.equal(redactUrlForLog(undefined), '[unparseable url]')
  assert.equal(redactUrlForLog(''), '[unparseable url]')
})
