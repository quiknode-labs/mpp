import {
  type Account,
  createPublicClient,
  createWalletClient,
  getAddress,
  type Hex,
  http,
} from 'viem'
import {
  CHAIN_IDS,
  defaultRpcUrl,
  ERC20_ABI,
  NATIVE_TOKEN_ADDRESS,
  type SupportedChain,
} from '../constants.js'
import { getViemChainById } from '../internal/chain.js'
import { defaultTransport } from '../internal/transport.js'
import type { HashPayload } from '../types.js'

function chainIdToSupported(chainId: number): SupportedChain | undefined {
  for (const [name, id] of Object.entries(CHAIN_IDS)) {
    if (id === chainId) return name as SupportedChain
  }
  return undefined
}

export async function createHashCredential(parameters: {
  account: Account
  rpcUrl?: string
  chainId: number
  tokenAddress: Hex
  recipient: Hex
  amount: bigint
}): Promise<HashPayload> {
  const { account, rpcUrl, chainId, tokenAddress, recipient, amount } = parameters
  const chain = getViemChainById(chainId)
  if (!chain) throw new Error(`Unsupported chainId: ${chainId}`)

  const supported = chainIdToSupported(chainId)
  const useDefault = rpcUrl === undefined
  const resolvedRpcUrl = (() => {
    if (!useDefault) return rpcUrl
    if (!supported) {
      throw new Error(`Unsupported chainId ${chainId} for zero-config RPC; pass rpcUrl explicitly.`)
    }
    return defaultRpcUrl(supported)
  })()

  const transport =
    useDefault && supported ? defaultTransport(resolvedRpcUrl, supported) : http(resolvedRpcUrl)

  const walletClient = createWalletClient({ account, chain, transport })
  const publicClient = createPublicClient({ chain, transport })

  const isNative = getAddress(tokenAddress) === getAddress(NATIVE_TOKEN_ADDRESS)
  const txHash = isNative
    ? await walletClient.sendTransaction({
        to: recipient,
        value: amount,
        account,
        chain,
      })
    : await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipient, amount],
        account,
        chain,
      })
  await publicClient.waitForTransactionReceipt({ hash: txHash })
  return { type: 'hash', txHash, chainId }
}
