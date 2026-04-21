import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SupportedChain } from '../constants.js'

test('SupportedChain union accepts known chains', () => {
  const chain: SupportedChain = 'base'
  assert.equal(chain, 'base')
})
