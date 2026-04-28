import type { Chain } from 'viem'
import {
  arbitrum,
  arbitrumSepolia,
  avalanche,
  base,
  baseSepolia,
  linea,
  lineaSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  scrollSepolia,
  sepolia,
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
  'ethereum-sepolia': sepolia,
  'arbitrum-sepolia': arbitrumSepolia,
  'optimism-sepolia': optimismSepolia,
  'polygon-amoy': polygonAmoy,
  'scroll-sepolia': scrollSepolia,
  'linea-sepolia': lineaSepolia,
}

export function getViemChain(chain: SupportedChain): Chain {
  return chains[chain]
}

export function getViemChainById(chainId: number): Chain | undefined {
  return Object.values(chains).find((c) => c.id === chainId)
}
