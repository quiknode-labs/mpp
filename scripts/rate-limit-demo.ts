/**
 * Fires requests in a loop against the SDK's default public RPC until
 * it hits a 429, then prints the resulting QuickNodeRateLimitError to
 * validate the upgrade CTA copy.
 *
 * Usage: npx tsx scripts/rate-limit-demo.ts [chain]
 * Default chain: base
 *
 * Requires PUBLIC_RPC_PREFIX/TOKEN to be set to real values in src/constants.ts.
 */

import { createPublicClient } from 'viem'
import { type SupportedChain, defaultRpcUrl } from '../src/constants.js'
import { QuickNodeRateLimitError } from '../src/errors.js'
import { getViemChain } from '../src/internal/chain.js'
import { defaultTransport } from '../src/internal/transport.js'

const chain = (process.argv[2] as SupportedChain | undefined) ?? 'base'

const client = createPublicClient({
  chain: getViemChain(chain),
  transport: defaultTransport(defaultRpcUrl(chain), chain),
})

console.log(`▶ Firing requests against ${chain} default RPC until 429…`)
let i = 0
const start = Date.now()
while (true) {
  i += 1
  try {
    await client.getChainId()
  } catch (err) {
    if (err instanceof QuickNodeRateLimitError) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`\n✖ Rate-limited after ${i} requests in ${elapsed}s\n`)
      console.log('Error:', err.message)
      console.log('Code:', err.code)
      console.log('Chain:', err.chain)
      console.log('Upgrade:', err.upgradeUrl)
      console.log('Retry after:', err.retryAfterSeconds, 's')
      process.exit(0)
    }
    throw err
  }
  if (i % 25 === 0) process.stdout.write('.')
}
