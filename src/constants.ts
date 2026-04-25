import { parseAbi } from 'viem'

export type SupportedChain =
  | 'base'
  | 'ethereum'
  | 'arbitrum'
  | 'polygon'
  | 'optimism'
  | 'avalanche'
  | 'linea'
  | 'unichain'
  | 'base-sepolia'

export const CHAIN_IDS: Record<SupportedChain, number> = {
  base: 8453,
  ethereum: 1,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  avalanche: 43114,
  linea: 59144,
  unichain: 130,
  'base-sepolia': 84532,
}

export const USDC_CONTRACTS: Record<SupportedChain, `0x${string}`> = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  linea: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
  unichain: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

export const DEFAULT_CONFIRMATIONS: Record<SupportedChain, number> = {
  base: 1,
  ethereum: 12,
  arbitrum: 1,
  polygon: 5,
  optimism: 1,
  avalanche: 1,
  linea: 1,
  unichain: 1,
  'base-sepolia': 1,
}

export const PERMIT2_ADDRESS: `0x${string}` = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

export const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function version() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

export const EIP3009_ABI = parseAbi([
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature)',
  'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
])

export const PERMIT2_ABI = parseAbi([
  'struct TokenPermissions { address token; uint256 amount; }',
  'struct PermitBatchTransferFrom { TokenPermissions[] permitted; uint256 nonce; uint256 deadline; }',
  'struct SignatureTransferDetails { address to; uint256 requestedAmount; }',
  'function permitWitnessTransferFrom(PermitBatchTransferFrom permit, SignatureTransferDetails[] transferDetails, address owner, bytes32 witness, string witnessTypeString, bytes signature)',
])

export const TRANSFER_EVENT_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const

/**
 * Pre-provisioned QuickNode endpoint used when the SDK is configured without
 * an explicit rpcUrl. Rate-limited per IP. See README for upgrade path.
 */
export const PUBLIC_RPC_PREFIX = 'dimensional-red-surf'
export const PUBLIC_RPC_TOKEN = 'f72fb3263bae017a655271c55d739246dbae40c8'

export const CHAIN_SLUGS: Record<SupportedChain, string | null> = {
  ethereum: null,
  base: 'base-mainnet',
  arbitrum: 'arbitrum-mainnet',
  polygon: 'matic',
  optimism: 'optimism',
  avalanche: 'avalanche-mainnet',
  linea: 'linea-mainnet',
  unichain: 'unichain-mainnet',
  'base-sepolia': 'base-sepolia',
}

/**
 * Chain-specific path suffix appended after the token. Most chains expose
 * EVM JSON-RPC at the token root; Avalanche is an AvalancheGo node where
 * C-Chain (the EVM) lives at /ext/bc/C/rpc.
 */
export const CHAIN_PATH_SUFFIXES: Partial<Record<SupportedChain, string>> = {
  avalanche: '/ext/bc/C/rpc',
}

/**
 * Known QuickNode path suffixes for chains not yet in `SupportedChain`.
 * Keep these wired up so adding the chain later is a one-line change in
 * `CHAIN_PATH_SUFFIXES`. Not referenced by runtime code today.
 */
export const HYPE_SUFFIX = '/evm'
export const TRON_SUFFIX = '/jsonrpc'
export const FUEL_SUFFIX = '/v1/graphql'

export function defaultRpcUrl(chain: SupportedChain): string {
  const slug = CHAIN_SLUGS[chain]
  const host = slug
    ? `${PUBLIC_RPC_PREFIX}.${slug}.quiknode.pro`
    : `${PUBLIC_RPC_PREFIX}.quiknode.pro`
  const pathSuffix = CHAIN_PATH_SUFFIXES[chain] ?? ''
  return `https://${host}/${PUBLIC_RPC_TOKEN}${pathSuffix}`
}
