import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CHAIN_IDS,
  CHAIN_SLUGS,
  DEFAULT_CONFIRMATIONS,
  defaultRpcUrl,
  type SupportedChain,
  USDC_CONTRACTS,
} from './constants.js'
import { getViemChain } from './internal/chain.js'

const NEW_CHAINS: SupportedChain[] = ['optimism', 'avalanche', 'linea', 'unichain']

test('new chains have chain IDs', () => {
  assert.equal(CHAIN_IDS.optimism, 10)
  assert.equal(CHAIN_IDS.avalanche, 43114)
  assert.equal(CHAIN_IDS.linea, 59144)
  assert.equal(CHAIN_IDS.unichain, 130)
})

test('new chains have native USDC addresses', () => {
  for (const chain of NEW_CHAINS) {
    const addr = USDC_CONTRACTS[chain]
    assert.match(addr, /^0x[0-9a-fA-F]{40}$/, `${chain} has a valid USDC address`)
  }
})

test('new chains have default confirmations', () => {
  for (const chain of NEW_CHAINS) {
    assert.equal(typeof DEFAULT_CONFIRMATIONS[chain], 'number')
    assert.ok(DEFAULT_CONFIRMATIONS[chain] >= 1)
  }
})

test('new chains resolve to viem chain objects', () => {
  for (const chain of NEW_CHAINS) {
    const viemChain = getViemChain(chain)
    assert.equal(viemChain.id, CHAIN_IDS[chain])
  }
})

test('ethereum mainnet has no chain slug (special case)', () => {
  assert.equal(CHAIN_SLUGS.ethereum, null)
  const url = defaultRpcUrl('ethereum')
  // Shape: https://{prefix}.quiknode.pro/{token} — no chain subdomain
  assert.match(url, /^https:\/\/[A-Za-z0-9-]+\.quiknode\.pro\/[A-Za-z0-9]+$/)
  assert.doesNotMatch(url, /\.[a-z-]+\.quiknode\.pro/)
})

test('non-ethereum chains have a slug-based subdomain', () => {
  const url = defaultRpcUrl('base')
  assert.match(url, /^https:\/\/[A-Za-z0-9-]+\.base-mainnet\.quiknode\.pro\/[A-Za-z0-9]+$/)
})

test('every SupportedChain has a slug entry', () => {
  const chains: SupportedChain[] = [
    'base',
    'ethereum',
    'arbitrum',
    'polygon',
    'optimism',
    'avalanche',
    'linea',
    'unichain',
    'base-sepolia',
  ]
  for (const chain of chains) {
    const slug = CHAIN_SLUGS[chain]
    // null is valid (ethereum); otherwise must be a non-empty string
    assert.ok(slug === null || (typeof slug === 'string' && slug.length > 0))
  }
})

test('defaultRpcUrl produces a well-formed URL for every chain', () => {
  const chains: SupportedChain[] = [
    'base',
    'ethereum',
    'arbitrum',
    'polygon',
    'optimism',
    'avalanche',
    'linea',
    'unichain',
    'base-sepolia',
  ]
  for (const chain of chains) {
    const url = defaultRpcUrl(chain)
    assert.doesNotMatch(url, /undefined|null/, `${chain} URL has no undefined/null`)
    assert.match(url, /^https:\/\//, `${chain} URL is HTTPS`)
  }
})
