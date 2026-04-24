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
import { defaultTransport } from '../internal/transport.js'

export function getPublicClient(parameters: {
  chain: SupportedChain
  rpcUrl: string
  useDefaultTransport: boolean
}): PublicClient {
  const transport = parameters.useDefaultTransport
    ? defaultTransport(parameters.rpcUrl, parameters.chain)
    : http(parameters.rpcUrl)
  return createPublicClient({
    chain: getViemChain(parameters.chain),
    transport,
  })
}

export function getWalletClient(parameters: {
  chain: SupportedChain
  rpcUrl: string
  account: Account
  useDefaultTransport: boolean
}): WalletClient {
  const transport = parameters.useDefaultTransport
    ? defaultTransport(parameters.rpcUrl, parameters.chain)
    : http(parameters.rpcUrl)
  return createWalletClient({
    chain: getViemChain(parameters.chain),
    transport,
    account: parameters.account,
  })
}
