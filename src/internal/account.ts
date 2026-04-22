import type { Account } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Signer } from '../types.js'

export function resolveSigner(signer: Signer): Account {
  if (signer.account) return signer.account
  if (signer.privateKey) return privateKeyToAccount(signer.privateKey)
  throw new Error('Signer requires either `account` or `privateKey`.')
}
