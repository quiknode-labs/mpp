import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { privateKeyToAccount } from 'viem/accounts'
import { createHashCredential } from './hash.js'

type FetchFn = typeof globalThis.fetch
let originalFetch: FetchFn
let seenUrls: string[]

beforeEach(() => {
  originalFetch = globalThis.fetch
  seenUrls = []
  globalThis.fetch = (async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    seenUrls.push(url)
    // Respond with a minimal JSON-RPC that satisfies eth_sendRawTransaction + waitForTransactionReceipt.
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: '0x0000000000000000000000000000000000000000000000000000000000000001',
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as FetchFn
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

const TEST_ACCOUNT = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
)

test('createHashCredential falls back to defaultRpcUrl when rpcUrl omitted', async () => {
  try {
    await createHashCredential({
      account: TEST_ACCOUNT,
      chainId: 8453, // base
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: '0x1111111111111111111111111111111111111111',
      amount: 1n,
    })
  } catch {
    // Expected — the mock doesn't simulate the full tx flow.
  }

  assert.ok(
    seenUrls.some((u) => u.includes('base-mainnet.quiknode.pro')),
    `expected at least one request to base-mainnet.quiknode.pro, got: ${seenUrls.join(', ')}`,
  )
})

test('createHashCredential uses explicit rpcUrl when provided', async () => {
  try {
    await createHashCredential({
      account: TEST_ACCOUNT,
      rpcUrl: 'https://custom.example/rpc',
      chainId: 8453,
      tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: '0x1111111111111111111111111111111111111111',
      amount: 1n,
    })
  } catch {
    // Expected.
  }

  assert.ok(
    seenUrls.every((u) => u.startsWith('https://custom.example')),
    `expected only requests to custom.example, got: ${seenUrls.join(', ')}`,
  )
})
