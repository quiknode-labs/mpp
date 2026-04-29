import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NATIVE_TOKEN_ADDRESS } from '../constants.js'
import { charge } from './Charge.js'

const RECIPIENT = '0x1111111111111111111111111111111111111111'
const RPC = 'https://example.com/rpc'
const SUBMITTER = '0x0000000000000000000000000000000000000000000000000000000000000001' as const
const DAI_MAINNET = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as const

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

test('charge() throws when both `token` and `customToken` are set', () => {
  assert.throws(
    () =>
      charge({
        recipient: RECIPIENT,
        chain: 'ethereum',
        rpcUrl: RPC,
        token: 'USDC',
        customToken: { address: DAI_MAINNET, decimals: 18 },
        credentialTypes: ['hash'],
      }),
    /either `token` or `customToken`/i,
  )
})

test('charge() throws when native customToken accepts non-hash credentials', () => {
  assert.throws(
    () =>
      charge({
        recipient: RECIPIENT,
        chain: 'base',
        rpcUrl: RPC,
        submitter: { privateKey: SUBMITTER },
        customToken: {
          address: NATIVE_TOKEN_ADDRESS,
          decimals: 18,
          credentialTypes: ['permit2', 'hash'],
        },
      }),
    /native.*hash/i,
  )
})

test('charge() with native customToken defaults to [hash] credential', () => {
  const method = charge({
    recipient: RECIPIENT,
    chain: 'base',
    rpcUrl: RPC,
    customToken: { address: NATIVE_TOKEN_ADDRESS, decimals: 18, symbol: 'ETH' },
  })
  assert.equal(method.name, 'evm')
  assert.equal(method.intent, 'charge')
})

test('charge() with custom ERC-20 customToken defaults to [permit2, hash] credentials', () => {
  const method = charge({
    recipient: RECIPIENT,
    chain: 'ethereum',
    rpcUrl: RPC,
    submitter: { privateKey: SUBMITTER },
    customToken: { address: DAI_MAINNET, decimals: 18, symbol: 'DAI' },
  })
  assert.equal(method.name, 'evm')
  assert.equal(method.intent, 'charge')
})

test('charge() rejects authorization on a custom ERC-20 by default', () => {
  assert.throws(
    () =>
      charge({
        recipient: RECIPIENT,
        chain: 'ethereum',
        rpcUrl: RPC,
        submitter: { privateKey: SUBMITTER },
        customToken: { address: DAI_MAINNET, decimals: 18, symbol: 'DAI' },
        credentialTypes: ['authorization'],
      }),
    /does not support credential types: authorization/i,
  )
})

test('charge() throws when customToken.name is set without version', () => {
  assert.throws(
    () =>
      charge({
        recipient: RECIPIENT,
        chain: 'ethereum',
        rpcUrl: RPC,
        submitter: { privateKey: SUBMITTER },
        customToken: {
          address: DAI_MAINNET,
          decimals: 18,
          name: 'Dai Stablecoin',
        },
      }),
    /name and customToken\.version must be provided together/i,
  )
})

test('charge() throws when customToken.version is set without name', () => {
  assert.throws(
    () =>
      charge({
        recipient: RECIPIENT,
        chain: 'ethereum',
        rpcUrl: RPC,
        submitter: { privateKey: SUBMITTER },
        customToken: {
          address: DAI_MAINNET,
          decimals: 18,
          version: '1',
        },
      }),
    /name and customToken\.version must be provided together/i,
  )
})

test('charge() honors custom credentialTypes on a custom ERC-20 (opt-in authorization)', () => {
  const method = charge({
    recipient: RECIPIENT,
    chain: 'ethereum',
    rpcUrl: RPC,
    submitter: { privateKey: SUBMITTER },
    customToken: {
      address: DAI_MAINNET,
      decimals: 18,
      symbol: 'DAI',
      credentialTypes: ['authorization', 'permit2', 'hash'],
      name: 'Dai Stablecoin',
      version: '1',
    },
    credentialTypes: ['authorization'],
  })
  assert.equal(method.name, 'evm')
})
