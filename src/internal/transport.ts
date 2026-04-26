import { HttpRequestError, type HttpTransport, http } from 'viem'
import type { SupportedChain } from '../constants.js'
import { QuickNodeRateLimitError } from '../errors.js'
import { version } from './version.js'

/**
 * Constructs a viem `http()` transport targeting the SDK's default public RPC.
 *
 * Two concerns beyond `http()` defaults:
 *   1. Telemetry headers (`x-qn-client`, `x-qn-client-chain`) so QuickNode can
 *      separate MPP SDK traffic from generic public-RPC abuse.
 *   2. 429 → `QuickNodeRateLimitError` transform with an actionable upgrade CTA.
 *
 * Do NOT use for user-supplied `rpcUrl` values — user endpoints must not receive
 * injected headers and their rate-limit semantics are opaque to us.
 */
export function defaultTransport(url: string, chain: SupportedChain): HttpTransport {
  const inner = http(url, {
    fetchOptions: {
      headers: {
        'x-qn-client': `@quicknode/mpp/${version}`,
        'x-qn-client-chain': chain,
        // Standard HTTP signal mirroring x-qn-client so any log pipeline that
        // keys off User-Agent (QuickNode default aggregation, CDN logs,
        // upstream proxies) can still identify SDK traffic even when custom
        // headers get stripped. Browser fetch silently drops this header —
        // fine; x-qn-* still carries the signal there.
        'User-Agent': `@quicknode/mpp/${version} (chain=${chain})`,
      },
    },
    // Disable viem's built-in retry (default 3 with backoff) so 429s surface
    // immediately for us to convert to QuickNodeRateLimitError before the caller
    // sees them. Side effect: transient non-429 errors (DNS, connection reset,
    // occasional 5xx) on the default transport also surface without retry.
    // Callers needing resilience should pass their own rpcUrl.
    retryCount: 0,
  })

  const transport: HttpTransport = (config) => {
    const { request: innerRequest, ...rest } = inner(config)

    const request: typeof innerRequest = async (args) => {
      try {
        return await innerRequest(args)
      } catch (err) {
        if (err instanceof HttpRequestError && err.status === 429) {
          const retryAfter = err.headers?.get('retry-after')
          const parsed = retryAfter ? Number.parseInt(retryAfter, 10) : Number.NaN
          throw new QuickNodeRateLimitError(chain, Number.isFinite(parsed) ? parsed : undefined)
        }
        throw err
      }
    }

    return { ...rest, request }
  }

  return transport
}

const loggedChains = new Set<SupportedChain>()

/**
 * Emits a one-shot `console.info` the first time the SDK uses its default
 * public RPC for a given chain. Lives at module scope — survives as long as
 * the importing process.
 */
export function logDefaultTransportOnce(chain: SupportedChain): void {
  if (loggedChains.has(chain)) return
  loggedChains.add(chain)
  console.info(
    `[@quicknode/mpp] Using QuickNode public RPC for ${chain}.\n` +
      `  Shared endpoint — rate-limited per IP.\n` +
      `  Upgrade: https://www.quicknode.com/?utm_source=mpp-sdk`,
  )
}

/** Test-only. Clears the per-process log memoization. */
export function resetDefaultTransportLog(): void {
  loggedChains.clear()
}
