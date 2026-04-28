import { parseAbi } from 'viem'
import type { CredentialType } from './types.js'

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
  | 'ethereum-sepolia'
  | 'arbitrum-sepolia'
  | 'optimism-sepolia'
  | 'polygon-amoy'
  | 'scroll-sepolia'
  | 'linea-sepolia'

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
  'ethereum-sepolia': 11155111,
  'arbitrum-sepolia': 421614,
  'optimism-sepolia': 11155420,
  'polygon-amoy': 80002,
  'scroll-sepolia': 534351,
  'linea-sepolia': 59141,
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
  'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'arbitrum-sepolia': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  'optimism-sepolia': '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  'polygon-amoy': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
  'scroll-sepolia': '0x4d7ff95a5e86b0aaade01df5adadded72c54a698',
  'linea-sepolia': '0xFEce4462D57bD51A6A552365A011b95f0E16d9B7',
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
  'ethereum-sepolia': 0,
  'arbitrum-sepolia': 0,
  'optimism-sepolia': 0,
  'polygon-amoy': 0,
  'scroll-sepolia': 0,
  'linea-sepolia': 0,
}

export type SupportedToken = 'USDC' | 'EURC' | 'WETH' | 'USDT'

// `Partial` because not every token is deployed on every chain. Admin layer
// must reject creating a payment option for a (chain, token) pair that
// resolves to undefined.
//
// Provenance rule (see agent-proxy/docs/decisions.md): every entry must be
// either issuer-deployed (Circle for USDC/EURC, Tether for mainnet USDT,
// chain team for canonical WETH wrappers) or verified on-chain against a
// known audited bytecode hash. Community-deployed tokens are not first-class.
//
// WETH carve-out: only canonical native ETH wrappers are listed. Polygon
// (native MATIC) and Avalanche (native AVAX) carry "WETH" only as bridged
// assets, which is a different trust model — those entries are intentionally
// absent.
export const TOKEN_CONTRACTS: Record<
  SupportedToken,
  Partial<Record<SupportedChain, `0x${string}`>>
> = {
  USDC: { ...USDC_CONTRACTS },
  EURC: {
    ethereum: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
    base: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    avalanche: '0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD',
    'ethereum-sepolia': '0x08210f9170f89ab7658f0b5e3ff39b0e03c594d4',
  },
  WETH: {
    ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    base: '0x4200000000000000000000000000000000000006',
    optimism: '0x4200000000000000000000000000000000000006',
    arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    linea: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
    unichain: '0x4200000000000000000000000000000000000006',
    'ethereum-sepolia': '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
    'arbitrum-sepolia': '0x2836ae2ea2c013acd38028fd0c77b92cccfa2ee4',
    'polygon-amoy': '0x52ef3d68bab452a294342dc3e5f464d7f610f72e',
    'scroll-sepolia': '0x5300000000000000000000000000000000000004',
  },
  // Mainnet only — Tether issues these. Testnet USDT is intentionally absent
  // because the candidates are community deployments without provenance.
  USDT: {
    ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    optimism: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    avalanche: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  },
}

export const TOKEN_DECIMALS: Record<SupportedToken, number> = {
  USDC: 6,
  EURC: 6,
  WETH: 18,
  USDT: 6,
}

// Per-token credential-type compatibility. EIP-3009 transferWithAuthorization
// is implemented by Circle's FiatToken family (USDC, EURC). WETH and USDT
// lack it (USDT mainnet uses its own non-standard approve/transferFrom),
// so those tokens accept Permit2 + on-chain hash only.
export const TOKEN_CREDENTIAL_TYPES: Record<SupportedToken, readonly CredentialType[]> = {
  USDC: ['permit2', 'authorization', 'hash'],
  EURC: ['permit2', 'authorization', 'hash'],
  WETH: ['permit2', 'hash'],
  USDT: ['permit2', 'hash'],
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
  'ethereum-sepolia': 'ethereum-sepolia',
  'arbitrum-sepolia': 'arbitrum-sepolia',
  'optimism-sepolia': 'optimism-sepolia',
  'polygon-amoy': 'matic-amoy',
  'scroll-sepolia': 'scroll-sepolia',
  'linea-sepolia': 'linea-sepolia',
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
