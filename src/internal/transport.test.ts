import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPublicClient } from 'viem'
import { QuickNodeRateLimitError } from '../errors.js'
import { getViemChain } from './chain.js'
import { defaultTransport, logDefaultTransportOnce, resetDefaultTransportLog } from './transport.js'

type FetchFn = typeof globalThis.fetch

let originalFetch: FetchFn
let fetchCalls: Array<{ url: string; init: RequestInit | undefined }>

function mockFetch(response: Response) {
  return (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    fetchCalls.push({ url, init })
    return response.clone()
  }) as FetchFn
}

beforeEach(() => {
  originalFetch = globalThis.fetch
  fetchCalls = []
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('defaultTransport attaches telemetry headers on every request', async () => {
  globalThis.fetch = mockFetch(
    new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x2105' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )

  const client = createPublicClient({
    chain: getViemChain('base'),
    transport: defaultTransport('https://example/rpc', 'base'),
  })
  await client.getChainId()

  assert.equal(fetchCalls.length, 1)
  const headers = new Headers(fetchCalls[0]?.init?.headers)
  assert.match(headers.get('x-qn-client') ?? '', /^@quicknode\/mpp\//)
  assert.equal(headers.get('x-qn-client-chain'), 'base')
})

test('defaultTransport converts 429 into QuickNodeRateLimitError', async () => {
  globalThis.fetch = mockFetch(
    new Response('Too Many Requests', {
      status: 429,
      headers: { 'retry-after': '42' },
    }),
  )

  const client = createPublicClient({
    chain: getViemChain('optimism'),
    transport: defaultTransport('https://example/rpc', 'optimism'),
  })

  await assert.rejects(
    () => client.getChainId(),
    (err: unknown) => {
      assert.ok(err instanceof QuickNodeRateLimitError)
      assert.equal(err.chain, 'optimism')
      assert.equal(err.retryAfterSeconds, 42)
      return true
    },
  )
})

test('defaultTransport passes 500s through unchanged', async () => {
  globalThis.fetch = mockFetch(
    new Response('server error', {
      status: 500,
    }),
  )

  const client = createPublicClient({
    chain: getViemChain('base'),
    transport: defaultTransport('https://example/rpc', 'base'),
  })

  await assert.rejects(
    () => client.getChainId(),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      assert.ok(!(err instanceof QuickNodeRateLimitError))
      return true
    },
  )
})

test('defaultTransport handles 429 without Retry-After header', async () => {
  globalThis.fetch = mockFetch(new Response('Too Many Requests', { status: 429 }))
  const client = createPublicClient({
    chain: getViemChain('base'),
    transport: defaultTransport('https://example/rpc', 'base'),
  })

  await assert.rejects(
    () => client.getChainId(),
    (err: unknown) => {
      assert.ok(err instanceof QuickNodeRateLimitError)
      assert.equal(err.retryAfterSeconds, undefined)
      return true
    },
  )
})

test('logDefaultTransportOnce logs once per chain per process', (t) => {
  resetDefaultTransportLog()
  const calls: string[] = []
  const originalInfo = console.info
  console.info = ((...args: unknown[]) => {
    calls.push(args.map(String).join(' '))
  }) as typeof console.info
  t.after(() => {
    console.info = originalInfo
  })

  logDefaultTransportOnce('base')
  logDefaultTransportOnce('base')
  logDefaultTransportOnce('optimism')

  assert.equal(calls.length, 2, 'one log per distinct chain')
  assert.ok(calls[0]?.includes('base'))
  assert.ok(calls[1]?.includes('optimism'))
  assert.ok(calls.every((c) => c.includes('quicknode.com')))
})
