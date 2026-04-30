# @quicknode/mpp

> [!WARNING]
> **Beta.** Public API may change between minor versions until v1. Pin to an exact version in production.

SDK for extending the MPP protocol with EVM-settled payments, verified via Quicknode RPC. Gate any HTTP endpoint behind a stablecoin (or native-coin) payment — agents pay with one signature, the server verifies on-chain, and the request is forwarded. Built for the [Machine Payments Protocol](https://github.com/tempoxyz/mpp-specs).

Implements and expands on the [`draft-evm-charge-00`](https://github.com/tempoxyz/mpp-specs/blob/2f6bfcee6f9e448d2ded15dc350dc92967e17513/specs/methods/evm/draft-evm-charge-00.md) spec
with all three non-trivial credential types:

| Type                    | Binding                          | Gas         | UX                                    |
| ----------------------- | -------------------------------- | ----------- | ------------------------------------- |
| `permit2` (RECOMMENDED) | Strong (EIP-712 witness)         | Server pays | One signature, any ERC-20             |
| `authorization`         | Strong (on-chain nonce)          | Server pays | One signature, USDC / EIP-3009 tokens |
| `hash`                  | Weakest (post-hoc receipt match) | Client pays | Client broadcasts + waits             |

> [!CAUTION]
> The `hash` credential is **post-hoc receipt matching only** — it binds nothing to the specific challenge. Any historical Transfer to the recipient that matches the requested token + amount can be claimed as proof of payment, once each. To narrow the replay window, set `maxReceiptAgeSeconds` on the server (see [Configuration](#configuration)). Even then, concurrent third-party payments to the same recipient for the same amount within the window can still leak through. For payments where stronger binding matters, prefer `permit2` or `authorization`.

## Contents

- [Install](#install)
- [Compatibility](#compatibility)
- [Server — accept payments](#server--accept-payments)
- [Client — pay for content](#client--pay-for-content)
- [Rate limits](#rate-limits)
- [Configuration](#configuration)
- [Live testing on Base Sepolia](#live-testing-on-base-sepolia)
- [Versioning](#versioning)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Install

```bash
npm install @quicknode/mpp mppx viem
```

## Compatibility

- **Node.js** ≥ 22
- **Cloudflare Workers**, **Bun**, and other WebCrypto-capable runtimes
- **Browsers** — the client (`@quicknode/mpp/client`) runs in-browser for agent UIs. The server modules import Node-only code and are not browser-bundleable
- **TypeScript** — types ship in the package; no separate `@types/*` install needed

## Server — accept payments

```ts
import { Mppx, evm } from "@quicknode/mpp/server";

const mppx = Mppx.create({
  methods: [
    evm.charge({
      recipient: "0xMerchantWallet",
      chain: "base",
      submitter: { privateKey: process.env.SUBMITTER_PK! },
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY!,
});

// mppx.evm.charge({ amount: '0.01', decimals: 6 })(request) → 402 challenge or verified receipt
```

No `rpcUrl`? The SDK uses Quicknode's shared public endpoint for the chosen chain. Good for local dev and low-volume workloads. When you start seeing `QuicknodeRateLimitError`, upgrade at [quicknode.com](https://www.quicknode.com/?utm_source=mpp-sdk) and pass your dedicated endpoint via `rpcUrl`.

Scope accepted types per-server:

```ts
evm.charge({
  recipient,
  chain: "base",
  rpcUrl, // optional override; omit to use public endpoint
  credentialTypes: ["permit2", "authorization"], // drop 'hash' if you don't want client-paid flows
  submitter: { privateKey: SUBMITTER_PK },
});
```

## Client — pay for content

```ts
import { Mppx, evm } from "@quicknode/mpp/client";
import { privateKeyToAccount } from "viem/accounts";

const { fetch } = Mppx.create({
  methods: [
    evm.charge({
      account: privateKeyToAccount(process.env.AGENT_PK! as `0x${string}`),
      // rpcUrl only needed if you want to allow the 'hash' credential path
    }),
  ],
});

// Auto-handles 402 → pay → retry
const res = await fetch("https://api.merchant.com/premium");
```

Set client preference order:

```ts
evm.charge({
  account,
  prefer: ["authorization", "permit2"], // skip 'hash' entirely
});
```

## Rate limits

The default public RPC is rate-limited per IP. When the limit is exceeded, the SDK throws `QuicknodeRateLimitError`:

```ts
import { QuicknodeRateLimitError } from "@quicknode/mpp/server";

try {
  await mppx.evm.charge(/* ... */);
} catch (err) {
  if (err instanceof QuicknodeRateLimitError) {
    console.error(`Rate limited on ${err.chain}. Upgrade: ${err.upgradeUrl}`);
  }
}
```

To avoid the limit entirely, pass your own `rpcUrl` from any Quicknode plan.

## Configuration

### `evm.charge` (server)

| Option            | Required                                                  | Default               | Notes                                                                                                                                                        |
| ----------------- | --------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `recipient`       | ✓                                                         | —                     | Merchant wallet (receives USDC)                                                                                                                              |
| `chain`           | ✓                                                         | —                     | `'base' \| 'ethereum' \| 'arbitrum' \| 'polygon' \| 'optimism' \| 'avalanche' \| 'linea' \| 'unichain' \| 'base-sepolia'`                                    |
| `rpcUrl`          | —                                                         | —                     | Defaults to Quicknode public endpoint for the chain. Rate-limited per IP.                                                                                    |
| `submitter`       | when `credentialTypes` contains `permit2`/`authorization` | —                     | `{ privateKey }` or `{ account }`                                                                                                                            |
| `credentialTypes` |                                                           | per-token allowed set | Draft-ordered preference list                                                                                                                                |
| `token`           |                                                           | `'USDC'`              | Curated symbol: `USDC \| EURC \| WETH \| USDT`. Mutually exclusive with `customToken`.                                                                       |
| `customToken`     |                                                           | —                     | Caller-supplied `{ address, decimals, symbol?, name?, version?, credentialTypes? }`. Use for any ERC-20 by address, or for native (zero-address). See below. |
| `confirmations`   |                                                           | per-chain default     | Block-depth check for `hash` credential                                                                                                                      |
| `maxReceiptAgeSeconds` |                                                      | —                     | If set, rejects `hash` credentials whose receipt block is older than N seconds at verification time. Closes the historical-Transfer-replay class. Recommended ≥ slowest expected confirmation window (e.g. 600 for L1, 60 for fast L2). |
| `store`           |                                                           | `Store.memory()`      | Any mppx `AtomicStore` (Cloudflare KV, Redis, Upstash)                                                                                                       |

### `evm.charge` (client)

| Option                   | Required                 | Notes                                           |
| ------------------------ | ------------------------ | ----------------------------------------------- |
| `account` / `privateKey` | one of                   | Viem `Account` or raw `0x...` hex               |
| `rpcUrl`                 | only if `hash` is chosen | Used to broadcast the ERC-20 transfer           |
| `prefer`                 |                          | `['permit2','authorization','hash']` by default |

### Permit2 one-time approval

Before the agent can use `permit2`, it must approve Permit2 on each token:

```ts
// One-time, from the agent's wallet:
await walletClient.writeContract({
  address: USDC_ADDRESS,
  abi: parseAbi(["function approve(address,uint256)"]),
  functionName: "approve",
  args: ["0x000000000022D473030F116dDEE9F6B43aC78BA3", 2n ** 256n - 1n],
});
```

### Custom tokens & native settlement

Pass `customToken` instead of `token` to settle in any ERC-20 by address, or
in the chain's native coin (ETH / MATIC / AVAX / …):

```ts
// Any ERC-20 by address — e.g. DAI on mainnet
import { evm } from "@quicknode/mpp/server";

evm.charge({
  chain: "ethereum",
  recipient,
  submitter: { privateKey: SUBMITTER_PK },
  customToken: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
    decimals: 18,
    symbol: "DAI",
  },
});
```

```ts
// Native chain coin — set address to NATIVE_TOKEN_ADDRESS (zero address)
import { evm, NATIVE_TOKEN_ADDRESS } from "@quicknode/mpp/server";

evm.charge({
  chain: "base",
  recipient,
  customToken: {
    address: NATIVE_TOKEN_ADDRESS,
    decimals: 18,
    symbol: "ETH",
  },
  // No `submitter` needed — native settlement only supports the `hash`
  // credential, which the client broadcasts itself.
});
```

`customToken` fields:

| Field             | Required | Notes                                                                                                                                                         |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `address`         | ✓        | ERC-20 contract address. Use `NATIVE_TOKEN_ADDRESS` for the chain's native coin.                                                                              |
| `decimals`        | ✓        | 18 for native ETH / MATIC / AVAX.                                                                                                                             |
| `symbol`          |          | Display only.                                                                                                                                                 |
| `name`, `version` |          | EIP-712 domain values. Pass these for `authorization` (EIP-3009) when the token's on-chain `name()` / `version()` reverts or differs from its EIP-712 domain. |
| `credentialTypes` |          | Defaults: `['permit2','hash']` for ERC-20, `['hash']` for native.                                                                                             |

Defaults intentionally exclude `authorization` for custom ERC-20s: only Circle
FiatTokens (USDC, EURC) implement EIP-3009 reliably. Opt in by passing
`credentialTypes: ['authorization', ...]` if your token implements it.

Native settlement is restricted to the `hash` credential and to direct EOA
sends — `tx.input === '0x'`, `tx.to === recipient`, `tx.value === amount`.
Contract-mediated native transfers aren't accepted by the verifier.

> **Spec note**: native settlement (zero-address `currency`) is a
> non-normative extension to
> [`draft-evm-charge-00`](https://github.com/tempoxyz/mpp-specs/blob/2f6bfcee6f9e448d2ded15dc350dc92967e17513/specs/methods/evm/draft-evm-charge-00.md),
> which scopes itself to ERC-20 transfers. Custom ERC-20 addresses are
> spec-compliant — the spec defines `currency` as a 20-byte hex string.

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

## Versioning

This package follows [SemVer](https://semver.org/) with a beta caveat:

- **Until 1.0**, minor versions may include breaking changes when [`draft-evm-charge-00`](https://github.com/tempoxyz/mpp-specs/blob/2f6bfcee6f9e448d2ded15dc350dc92967e17513/specs/methods/evm/draft-evm-charge-00.md) evolves or the public API needs to change. Pin an exact version in production.
- **Public API** = everything exported from `@quicknode/mpp`, `@quicknode/mpp/server`, `@quicknode/mpp/client`, their submodules, and `@quicknode/mpp/constants`. Anything under `internal/` is private and may change without notice.

## Changelog

See [GitHub Releases](https://github.com/quiknode-labs/mpp/releases) for per-version changes.

## Contributing

Issues and PRs welcome at [quiknode-labs/mpp](https://github.com/quiknode-labs/mpp). Before opening a PR:

```bash
npm run verify   # lint + typecheck + tests + build
```

## Security

Found a vulnerability? Please email security@quicknode.com instead of opening a public issue.

## License

MIT
