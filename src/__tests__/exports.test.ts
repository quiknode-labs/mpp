import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as client from '../client/index.js'
import * as root from '../index.js'
import * as server from '../server/index.js'

test('QuicknodeRateLimitError exported from root', () => {
  assert.equal(typeof root.QuicknodeRateLimitError, 'function')
})

test('QuicknodeRateLimitError exported from server', () => {
  assert.equal(typeof server.QuicknodeRateLimitError, 'function')
})

test('QuicknodeRateLimitError exported from client', () => {
  assert.equal(typeof client.QuicknodeRateLimitError, 'function')
})
