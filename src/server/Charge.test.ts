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

test('charge() accepts zero-config with no rpcUrl when credentialTypes is [hash]', () => {
  const method = charge({
    recipient: RECIPIENT,
    chain: 'base',
    credentialTypes: ['hash'],
  })
  assert.equal(method.name, 'evm')
  assert.equal(method.intent, 'charge')
})

test('charge() accepts zero-config with no rpcUrl when submitter is provided', () => {
  const SUBMITTER = '0x0000000000000000000000000000000000000000000000000000000000000001' as const
  const method = charge({
    recipient: RECIPIENT,
    chain: 'base',
    submitter: { privateKey: SUBMITTER },
  })
  assert.equal(method.name, 'evm')
  assert.equal(method.intent, 'charge')
})

test('charge() accepts explicit rpcUrl (existing behavior preserved)', () => {
  const method = charge({
    recipient: RECIPIENT,
    chain: 'base',
    rpcUrl: 'https://custom.example/rpc',
    credentialTypes: ['hash'],
  })
  assert.equal(method.name, 'evm')
})
