import type { SupportedChain } from './constants.js'

const UPGRADE_URL = 'https://www.quicknode.com/?utm_source=mpp-sdk&utm_medium=rate-limit'

/**
 * Thrown when a request to the SDK's default public RPC endpoint is rate-limited.
 *
 * Only emitted when the SDK is using its default transport — requests through a
 * user-supplied `rpcUrl` surface the underlying viem `HttpRequestError` unchanged.
 */
export class QuickNodeRateLimitError extends Error {
  readonly code = 'QUICKNODE_RATE_LIMITED' as const
  readonly upgradeUrl = UPGRADE_URL
  readonly chain: SupportedChain
  readonly retryAfterSeconds?: number

  constructor(chain: SupportedChain, retryAfterSeconds?: number) {
    const suffix = retryAfterSeconds !== undefined ? ` (retry after ${retryAfterSeconds}s)` : ''
    super(
      `QuickNode public RPC rate limit hit on ${chain}. ` +
        `Upgrade to a dedicated endpoint at ${UPGRADE_URL}${suffix}`,
    )
    this.name = 'QuickNodeRateLimitError'
    this.chain = chain
    this.retryAfterSeconds = retryAfterSeconds
  }
}
