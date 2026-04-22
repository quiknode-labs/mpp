import type { Account, Hex } from 'viem'
import {
  eip3009Domain,
  eip3009Message,
  eip3009Nonce,
  eip3009Types,
  isoToUnix,
} from '../internal/typedData.js'
import type { AuthorizationPayload } from '../types.js'

export async function createAuthorizationCredential(parameters: {
  account: Account
  chainId: number
  tokenAddress: Hex
  tokenName: string
  tokenVersion: string
  recipient: Hex
  amount: bigint
  challengeId: string
  expires: string
}): Promise<AuthorizationPayload> {
  const {
    account,
    chainId,
    tokenAddress,
    tokenName,
    tokenVersion,
    recipient,
    amount,
    challengeId,
    expires,
  } = parameters
  if (!account.signTypedData) {
    throw new Error('Account does not support signTypedData')
  }

  const nonce = eip3009Nonce(challengeId)
  const validBefore = isoToUnix(expires)
  const validAfter = 0

  const domain = eip3009Domain({ tokenName, tokenVersion, chainId, tokenAddress })
  const message = eip3009Message({
    from: account.address,
    to: recipient,
    value: amount.toString(),
    validAfter,
    validBefore,
    nonce,
  })

  const signature = await account.signTypedData({
    domain,
    types: eip3009Types,
    primaryType: 'TransferWithAuthorization',
    message,
  })

  return {
    type: 'authorization',
    signature,
    from: account.address,
    validAfter,
    validBefore,
    nonce,
  }
}
