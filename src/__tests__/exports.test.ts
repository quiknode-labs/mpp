import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as client from '../client/index.js'
import * as root from '../index.js'
import * as server from '../server/index.js'

test('QuickNodeRateLimitError exported from root', () => {
  assert.equal(typeof root.QuickNodeRateLimitError, 'function')
})

test('QuickNodeRateLimitError exported from server', () => {
  assert.equal(typeof server.QuickNodeRateLimitError, 'function')
})

test('QuickNodeRateLimitError exported from client', () => {
  assert.equal(typeof client.QuickNodeRateLimitError, 'function')
})
