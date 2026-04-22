import assert from 'node:assert/strict'
import { test } from 'node:test'
import { charge } from './Charge.js'

const RECIPIENT = '0x1111111111111111111111111111111111111111'
const RPC = 'https://example.com/rpc'

test('charge() throws when submitter is missing and permit2 is accepted', () => {
  assert.throws(
    () =>
      charge({
        recipient: RECIPIENT,
        chain: 'base-sepolia',
        rpcUrl: RPC,
        credentialTypes: ['permit2', 'hash'],
      }),
    /submitter.*required/i,
  )
})

test('charge() throws when submitter is missing and authorization is accepted', () => {
  assert.throws(
    () =>
      charge({
        recipient: RECIPIENT,
        chain: 'base-sepolia',
        rpcUrl: RPC,
        credentialTypes: ['authorization'],
      }),
    /submitter.*required/i,
  )
})

test('charge() with only hash credential type requires no submitter', () => {
  const method = charge({
    recipient: RECIPIENT,
    chain: 'base-sepolia',
    rpcUrl: RPC,
    credentialTypes: ['hash'],
  })
  assert.equal(method.name, 'evm')
  assert.equal(method.intent, 'charge')
})
