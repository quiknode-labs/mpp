import type { Chain } from 'viem'
import {
  arbitrum,
  avalanche,
  base,
  baseSepolia,
  linea,
  mainnet,
  optimism,
  polygon,
  unichain,
} from 'viem/chains'
import type { SupportedChain } from '../constants.js'

const chains: Record<SupportedChain, Chain> = {
  base,
  ethereum: mainnet,
  arbitrum,
  polygon,
  optimism,
  avalanche,
  linea,
  unichain,
  'base-sepolia': baseSepolia,
}

export function getViemChain(chain: SupportedChain): Chain {
  return chains[chain]
}

export function getViemChainById(chainId: number): Chain | undefined {
  return Object.values(chains).find((c) => c.id === chainId)
}
