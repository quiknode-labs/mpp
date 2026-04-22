import type { Account, Hex } from 'viem'
import {
  isoToUnix,
  permit2Domain,
  permit2Message,
  permit2Nonce,
  permit2Types,
} from '../internal/typedData.js'
import type { Permit2Payload } from '../types.js'

export async function createPermit2Credential(parameters: {
  account: Account
  chainId: number
  tokenAddress: Hex
  spender: Hex
  amount: bigint
  challengeId: string
  realm: string
  expires: string
}): Promise<Permit2Payload> {
  const { account, chainId, tokenAddress, spender, amount, challengeId, realm, expires } =
    parameters
  if (!account.signTypedData) {
    throw new Error('Account does not support signTypedData')
  }

  const nonce = permit2Nonce(challengeId)
  const deadline = isoToUnix(expires)

  const domain = permit2Domain(chainId)
  const message = permit2Message({
    challengeId,
    realm,
    spender,
    token: tokenAddress,
    amount: amount.toString(),
    nonce,
    deadline,
  })

  const signature = await account.signTypedData({
    domain,
    types: permit2Types,
    primaryType: 'PermitBatchWitnessTransferFrom',
    message,
  })

  return {
    type: 'permit2',
    from: account.address,
    signature,
    deadline,
    nonce,
    permitted: [{ token: tokenAddress, amount: amount.toString() }],
  }
}
