import { parseAbi } from 'viem'

export type SupportedChain = 'base' | 'ethereum' | 'arbitrum' | 'polygon' | 'base-sepolia'

export const CHAIN_IDS: Record<SupportedChain, number> = {
  base: 8453,
  ethereum: 1,
  arbitrum: 42161,
  polygon: 137,
  'base-sepolia': 84532,
}

export const USDC_CONTRACTS: Record<SupportedChain, `0x${string}`> = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

export const DEFAULT_CONFIRMATIONS: Record<SupportedChain, number> = {
  base: 1,
  ethereum: 12,
  arbitrum: 1,
  polygon: 5,
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
