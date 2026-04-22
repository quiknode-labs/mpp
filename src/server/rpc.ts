import {
  type Account,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem'
import type { SupportedChain } from '../constants.js'
import { getViemChain } from '../internal/chain.js'

export function getPublicClient(parameters: {
  chain: SupportedChain
  rpcUrl: string
}): PublicClient {
  return createPublicClient({
    chain: getViemChain(parameters.chain),
    transport: http(parameters.rpcUrl),
  })
}

export function getWalletClient(parameters: {
  chain: SupportedChain
  rpcUrl: string
  account: Account
}): WalletClient {
  return createWalletClient({
    chain: getViemChain(parameters.chain),
    transport: http(parameters.rpcUrl),
    account: parameters.account,
  })
}
