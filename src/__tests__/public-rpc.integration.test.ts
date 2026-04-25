import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPublicClient } from 'viem'
import { CHAIN_IDS, defaultRpcUrl, type SupportedChain } from '../constants.js'
import { getViemChain } from '../internal/chain.js'
import { defaultTransport } from '../internal/transport.js'

const ENABLED = process.env.MPP_INTEGRATION === '1'

const CHAINS: SupportedChain[] = [
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

for (const chain of CHAINS) {
  test(`public rpc / ${chain} default endpoint returns correct chainId`, {
    skip: !ENABLED,
    timeout: 10_000,
  }, async () => {
    const client = createPublicClient({
      chain: getViemChain(chain),
      transport: defaultTransport(defaultRpcUrl(chain), chain),
    })
    const id = await client.getChainId()
    assert.equal(id, CHAIN_IDS[chain])
  })
}
