import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { QuicknodeRateLimitError } from '../errors.js'
import { getPublicClient } from './rpc.js'

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

test('user-supplied rpcUrl: 429 surfaces as viem HttpRequestError, NOT QuicknodeRateLimitError', async () => {
  globalThis.fetch = mockFetch(new Response('Too Many Requests', { status: 429 }))

  const client = getPublicClient({
    chain: 'base',
    rpcUrl: 'https://user.example/rpc',
    useDefaultTransport: false,
  })

  await assert.rejects(
    () => client.getChainId(),
    (err: unknown) => {
      assert.ok(err instanceof Error, 'is an Error')
      assert.ok(!(err instanceof QuicknodeRateLimitError), 'is NOT QuicknodeRateLimitError')
      return true
    },
  )
})

test('user-supplied rpcUrl: no x-qn-client telemetry headers are injected', async () => {
  globalThis.fetch = mockFetch(
    new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x2105' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )

  const client = getPublicClient({
    chain: 'base',
    rpcUrl: 'https://user.example/rpc',
    useDefaultTransport: false,
  })
  await client.getChainId()

  assert.equal(fetchCalls.length, 1)
  const headers = new Headers(fetchCalls[0]?.init?.headers)
  assert.equal(headers.get('x-qn-client'), null, 'no x-qn-client header leaked')
  assert.equal(headers.get('x-qn-client-chain'), null, 'no x-qn-client-chain header leaked')
  assert.equal(headers.get('user-agent'), null, 'no User-Agent override leaked')
})
