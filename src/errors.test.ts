import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QuicknodeRateLimitError } from './errors.js'

test('QuicknodeRateLimitError has canonical code and chain', () => {
  const err = new QuicknodeRateLimitError('base')
  assert.equal(err.code, 'QUICKNODE_RATE_LIMITED')
  assert.equal(err.chain, 'base')
  assert.equal(err.name, 'QuicknodeRateLimitError')
})

test('QuicknodeRateLimitError exposes upgrade URL with UTM', () => {
  const err = new QuicknodeRateLimitError('optimism')
  assert.match(err.upgradeUrl, /^https:\/\/www\.quicknode\.com/)
  assert.match(err.upgradeUrl, /utm_source=mpp-sdk/)
  assert.match(err.message, /optimism/)
  assert.match(err.message, /quicknode\.com/)
})

test('QuicknodeRateLimitError records retryAfter when provided', () => {
  const err = new QuicknodeRateLimitError('base', 30)
  assert.equal(err.retryAfterSeconds, 30)
  assert.match(err.message, /retry after 30s/)
})

test('QuicknodeRateLimitError omits retryAfter clause when unset', () => {
  const err = new QuicknodeRateLimitError('base')
  assert.equal(err.retryAfterSeconds, undefined)
  assert.doesNotMatch(err.message, /retry after/)
})

test('QuicknodeRateLimitError is an instance of Error', () => {
  const err = new QuicknodeRateLimitError('base')
  assert.ok(err instanceof Error)
  assert.ok(err instanceof QuicknodeRateLimitError)
})
