# @quicknode/mpp

First-party MPP payment method for EVM-settled payments, verified via QuickNode RPC.

Implements IETF [`draft-evm-charge-00`](https://github.com/tempoxyz/mpp-specs/blob/main/specs/methods/evm/draft-evm-charge-00.md)
with all three non-trivial credential types:

| Type | Binding | Gas | UX |
|---|---|---|---|
| `permit2` (RECOMMENDED) | Strong (EIP-712 witness) | Server pays | One signature, any ERC-20 |
| `authorization` | Strong (on-chain nonce) | Server pays | One signature, USDC / EIP-3009 tokens |
| `hash` | Weakest (post-hoc receipt match) | Client pays | Client broadcasts + waits |

## Install

```bash
npm install @quicknode/mpp mppx viem
```

## Server — accept payments

```ts
import { Mppx, evm } from '@quicknode/mpp/server'

const mppx = Mppx.create({
  methods: [
    evm.charge({
      recipient: '0xMerchantWallet',
      chain: 'base',
      submitter: { privateKey: process.env.SUBMITTER_PK! },
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY!,
})

// mppx.evm.charge({ amount: '0.01', decimals: 6 })(request) → 402 challenge or verified receipt
```

No `rpcUrl`? The SDK uses QuickNode's shared public endpoint for the chosen chain. Good for local dev and low-volume workloads. When you start seeing `QuickNodeRateLimitError`, upgrade at [quicknode.com](https://www.quicknode.com/?utm_source=mpp-sdk) and pass your dedicated endpoint via `rpcUrl`.

Scope accepted types per-server:

```ts
evm.charge({
  recipient,
  chain: 'base',
  rpcUrl, // optional override; omit to use public endpoint
  credentialTypes: ['permit2', 'authorization'], // drop 'hash' if you don't want client-paid flows
  submitter: { privateKey: SUBMITTER_PK },
})
```

## Client — pay for content

```ts
import { Mppx, evm } from '@quicknode/mpp/client'
import { privateKeyToAccount } from 'viem/accounts'

const { fetch } = Mppx.create({
  methods: [
    evm.charge({
      account: privateKeyToAccount(process.env.AGENT_PK! as `0x${string}`),
      // rpcUrl only needed if you want to allow the 'hash' credential path
    }),
  ],
})

// Auto-handles 402 → pay → retry
const res = await fetch('https://api.merchant.com/premium')
```

Set client preference order:

```ts
evm.charge({
  account,
  prefer: ['authorization', 'permit2'], // skip 'hash' entirely
})
```

## Rate limits

The default public RPC is rate-limited per IP. When the limit is exceeded, the SDK throws `QuickNodeRateLimitError`:

```ts
import { QuickNodeRateLimitError } from '@quicknode/mpp/server'

try {
  await mppx.evm.charge(/* ... */)
} catch (err) {
  if (err instanceof QuickNodeRateLimitError) {
    console.error(`Rate limited on ${err.chain}. Upgrade: ${err.upgradeUrl}`)
  }
}
```

To avoid the limit entirely, pass your own `rpcUrl` from any QuickNode plan.

## Configuration

### `evm.charge` (server)

| Option | Required | Default | Notes |
|---|---|---|---|
| `recipient` | ✓ | — | Merchant wallet (receives USDC) |
| `chain` | ✓ | — | `'base' \| 'ethereum' \| 'arbitrum' \| 'polygon' \| 'optimism' \| 'avalanche' \| 'linea' \| 'unichain' \| 'base-sepolia'` |
| `rpcUrl` | — | — | Defaults to QuickNode public endpoint for the chain. Rate-limited per IP. |
| `submitter` | when `credentialTypes` contains `permit2`/`authorization` | — | `{ privateKey }` or `{ account }` |
| `credentialTypes` | | `['permit2','authorization','hash']` | Draft-ordered preference list |
| `token` | | `'USDC'` | Only USDC supported in v0.1 |
| `confirmations` | | per-chain default | Block-depth check for `hash` credential |
| `store` | | `Store.memory()` | Any mppx `AtomicStore` (Cloudflare KV, Redis, Upstash) |

### `evm.charge` (client)

| Option | Required | Notes |
|---|---|---|
| `account` / `privateKey` | one of | Viem `Account` or raw `0x...` hex |
| `rpcUrl` | only if `hash` is chosen | Used to broadcast the ERC-20 transfer |
| `prefer` | | `['permit2','authorization','hash']` by default |

### Permit2 one-time approval

Before the agent can use `permit2`, it must approve Permit2 on each token:

```ts
// One-time, from the agent's wallet:
await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: parseAbi(['function approve(address,uint256)']),
  functionName: 'approve',
  args: ['0x000000000022D473030F116dDEE9F6B43aC78BA3', 2n ** 256n - 1n],
})
```

## Live testing on Base Sepolia

```bash
export RPC_URL=https://base-sepolia.quiknode.pro/<key>
export PAYER_PK=0x...             # funded with Base Sepolia USDC
export SUBMITTER_PK=0x...         # funded with Base Sepolia ETH (for permit2/authorization)
export RECIPIENT=0x...

npx tsx scripts/live-sepolia.ts --type hash
npx tsx scripts/live-sepolia.ts --type authorization
npx tsx scripts/live-sepolia.ts --type permit2

# Or use the zero-config path (no RPC_URL env needed):
npx tsx scripts/live-sepolia.ts --type hash --use-default-rpc
```

### Integration tests (opt-in)

A read-only sanity check against the default public endpoint is gated behind an env var:

```bash
MPP_INTEGRATION=1 npm test -- --test-name-pattern "public rpc"
```

Runs one `getChainId` call per supported chain. Requires real `PUBLIC_RPC_PREFIX`/`PUBLIC_RPC_TOKEN` values in `src/constants.ts`.

## License

MIT
