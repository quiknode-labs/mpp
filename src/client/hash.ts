import { type Account, createPublicClient, createWalletClient, type Hex, http } from 'viem'
import { ERC20_ABI } from '../constants.js'
import { getViemChainById } from '../internal/chain.js'
import type { HashPayload } from '../types.js'

export async function createHashCredential(parameters: {
  account: Account
  rpcUrl: string
  chainId: number
  tokenAddress: Hex
  recipient: Hex
  amount: bigint
}): Promise<HashPayload> {
  const { account, rpcUrl, chainId, tokenAddress, recipient, amount } = parameters
  const chain = getViemChainById(chainId)
  if (!chain) throw new Error(`Unsupported chainId: ${chainId}`)

  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) })
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

  const txHash = await walletClient.writeContract({
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
