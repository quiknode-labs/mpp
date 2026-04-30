import type { Account, Address, Hash, Hex } from 'viem'
import type { SupportedChain, SupportedToken } from './constants.js'

export const credentialTypes = ['permit2', 'authorization', 'hash'] as const

export type CredentialType = (typeof credentialTypes)[number]

export type Permit2Payload = {
  type: 'permit2'
  from: Address
  signature: Hex
  deadline: number
  nonce: string
  permitted: { token: Address; amount: string }[]
}

export type AuthorizationPayload = {
  type: 'authorization'
  signature: Hex
  from: Address
  validAfter: number
  validBefore: number
  nonce: Hash
}

export type HashPayload = {
  type: 'hash'
  txHash: Hash
  chainId: number
}

export type ChargeCredential = Permit2Payload | AuthorizationPayload | HashPayload

export type Signer = { privateKey: Hex; account?: never } | { account: Account; privateKey?: never }

export type ChargeReplayItemMap = {
  [key: `mpp:evm:charge:${string}`]: number
}

/**
 * Caller-supplied token configuration for `evm.charge`. Pass as `customToken`
 * on the server to settle in any ERC-20 outside the curated `SupportedToken`
 * set, or in the chain's native coin (ETH / MATIC / AVAX …) by setting
 * `address` to `NATIVE_TOKEN_ADDRESS` (zero address).
 *
 * Mutually exclusive with the `token` field on `ServerParameters`.
 */
export type CustomTokenConfig = {
  /**
   * ERC-20 contract address. Use `NATIVE_TOKEN_ADDRESS` (zero address) to
   * signal native chain coin settlement.
   */
  address: Address
  /** Token decimals. 18 for native ETH / MATIC / AVAX. */
  decimals: number
  /** Display-only symbol (e.g. 'ETH', 'DAI'). Not validated. */
  symbol?: string
  /**
   * EIP-712 token name. Forwarded to clients in the challenge for the
   * `authorization` credential. Overrides the on-chain `name()` read.
   */
  name?: string
  /**
   * EIP-712 token version. Forwarded to clients in the challenge for the
   * `authorization` credential. Overrides the on-chain `version()` read.
   */
  version?: string
  /**
   * Accepted credential types. Defaults to `['permit2','hash']` for ERC-20
   * tokens and `['hash']` for native. EIP-3009 (`authorization`) is opt-in
   * for custom tokens — only enable it if the token implements EIP-3009
   * correctly. Native settlement only supports `hash`.
   */
  credentialTypes?: readonly CredentialType[]
}

export type ServerParameters = {
  /** Merchant wallet that receives the USDC transfer. */
  recipient: Address
  /**
   * RPC endpoint URL. If omitted, defaults to Quicknode's public shared endpoint
   * for the given `chain`. The shared endpoint is rate-limited per IP; upgrade
   * at https://www.quicknode.com for a dedicated endpoint.
   */
  rpcUrl?: string
  /** Target chain for settlement. */
  chain: SupportedChain
  /**
   * Curated ERC-20 token symbol — resolves to a contract address via
   * TOKEN_CONTRACTS. Testnet token availability is sparse outside USDC:
   * EURC ships only on ethereum-sepolia, WETH on a subset of testnets.
   * Authorization (EIP-3009) is supported only by Circle's FiatToken family
   * (USDC, EURC); WETH is permit2 + hash only.
   *
   * Mutually exclusive with `customToken`. To settle in a non-curated ERC-20
   * or in the chain's native coin, use `customToken` instead.
   * @default 'USDC' (only when `customToken` is also unset)
   */
  token?: SupportedToken
  /**
   * Caller-supplied token configuration. Use this instead of `token` to
   * settle in any ERC-20 (by address) or in the chain's native coin
   * (by setting `address` to `NATIVE_TOKEN_ADDRESS`). Mutually exclusive
   * with `token`.
   */
  customToken?: CustomTokenConfig
  /**
   * Accepted credential types, advertised in the challenge. Ordered from most to
   * least preferred (draft-evm-charge-00 §3). @default ['permit2','authorization','hash']
   */
  credentialTypes?: readonly CredentialType[]
  /**
   * Signer that broadcasts on-chain transactions for permit2 / authorization credentials.
   * Required when either type is in `credentialTypes`.
   */
  submitter?: Signer
  /** Replay-protection store. @default Store.memory() */
  store?: import('mppx').Store.AtomicStore<ChargeReplayItemMap>
  /** Block confirmations required for the hash credential. @default per-chain value in DEFAULT_CONFIRMATIONS */
  confirmations?: number
}

export type ClientParameters = {
  /** viem Account. Required unless `privateKey` is set. */
  account?: Account
  /** Raw private key (hex). Required unless `account` is set. */
  privateKey?: Hex
  /** RPC endpoint. Required only when the hash credential is selected (client broadcasts its own tx). */
  rpcUrl?: string
  /**
   * Client-side preference order. The first type that the server also accepts is chosen.
   * @default ['permit2','authorization','hash']
   */
  prefer?: readonly CredentialType[]
}
