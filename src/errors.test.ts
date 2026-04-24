import assert from 'node:assert/strict'
import { test } from 'node:test'
import { QuickNodeRateLimitError } from './errors.js'

test('QuickNodeRateLimitError has canonical code and chain', () => {
  const err = new QuickNodeRateLimitError('base')
  assert.equal(err.code, 'QUICKNODE_RATE_LIMITED')
  assert.equal(err.chain, 'base')
  assert.equal(err.name, 'QuickNodeRateLimitError')
})

test('QuickNodeRateLimitError exposes upgrade URL with UTM', () => {
  const err = new QuickNodeRateLimitError('optimism')
  assert.match(err.upgradeUrl, /^https:\/\/www\.quicknode\.com/)
  assert.match(err.upgradeUrl, /utm_source=mpp-sdk/)
  assert.match(err.message, /optimism/)
  assert.match(err.message, /quicknode\.com/)
})

test('QuickNodeRateLimitError records retryAfter when provided', () => {
  const err = new QuickNodeRateLimitError('base', 30)
  assert.equal(err.retryAfterSeconds, 30)
  assert.match(err.message, /retry after 30s/)
})

test('QuickNodeRateLimitError omits retryAfter clause when unset', () => {
  const err = new QuickNodeRateLimitError('base')
  assert.equal(err.retryAfterSeconds, undefined)
  assert.doesNotMatch(err.message, /retry after/)
})

test('QuickNodeRateLimitError is an instance of Error', () => {
  const err = new QuickNodeRateLimitError('base')
  assert.ok(err instanceof Error)
  assert.ok(err instanceof QuickNodeRateLimitError)
})
