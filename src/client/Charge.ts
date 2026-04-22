import { Credential, Method } from 'mppx'
import { getAddress, type Hex } from 'viem'
import { resolveSigner } from '../internal/account.js'
import { charge as chargeMethod } from '../Methods.js'
import {
  type ClientParameters,
  type CredentialType,
  credentialTypes as defaultCredentialTypes,
} from '../types.js'
import { createAuthorizationCredential } from './authorization.js'
import { createHashCredential } from './hash.js'
import { createPermit2Credential } from './permit2.js'

/**
 * Creates an EVM charge method intent for usage on the client.
 *
 * @example
 * ```ts
 * import { Mppx, evm } from '@quicknode/mpp/client'
 *
 * const { fetch } = Mppx.create({
 *   methods: [evm.charge({ privateKey: '0x...' })],
 * })
 * ```
 */
export function charge(parameters: ClientParameters) {
  const { account: accountInput, privateKey, rpcUrl, prefer } = parameters
  const signer = accountInput ? { account: accountInput } : privateKey ? { privateKey } : undefined
  if (!signer) {
    throw new Error('evm.charge requires either `account` or `privateKey`')
  }
  const account = resolveSigner(signer)
  const preferred: readonly CredentialType[] = prefer ?? defaultCredentialTypes

  return Method.toClient(chargeMethod, {
    async createCredential({ challenge }) {
      const request = challenge.request as {
        amount: string
        currency: string
        recipient?: string
        methodDetails?: {
          chainId?: number
          credentialTypes?: readonly CredentialType[]
          permit2Address?: string
          permit2Spender?: string
          tokenName?: string
          tokenVersion?: string
        }
      }

      const accepted = request.methodDetails?.credentialTypes ?? defaultCredentialTypes
      const chosen = preferred.find((t) => accepted.includes(t))
      if (!chosen) {
        throw new Error(
          `No compatible credential type. Server accepts [${accepted.join(', ')}], client prefers [${preferred.join(', ')}].`,
        )
      }

      if (!request.recipient) throw new Error('Challenge has no recipient')
      if (!request.methodDetails?.chainId) throw new Error('Challenge has no chainId')

      const tokenAddress = getAddress(request.currency) as Hex
      const recipient = getAddress(request.recipient) as Hex
      const amount = BigInt(request.amount)
      const chainId = request.methodDetails.chainId

      const source = `did:pkh:eip155:${chainId}:${account.address}`

      if (chosen === 'hash') {
        if (!rpcUrl) {
          throw new Error('evm.charge requires `rpcUrl` when using the `hash` credential type')
        }
        const payload = await createHashCredential({
          account,
          rpcUrl,
          chainId,
          tokenAddress,
          recipient,
          amount,
        })
        return Credential.serialize(Credential.from({ challenge, payload, source }))
      }

      if (chosen === 'authorization') {
        const { tokenName, tokenVersion } = request.methodDetails
        if (!tokenName || !tokenVersion) {
          throw new Error(
            'Challenge missing tokenName/tokenVersion required for authorization credential',
          )
        }
        const payload = await createAuthorizationCredential({
          account,
          chainId,
          tokenAddress,
          tokenName,
          tokenVersion,
          recipient,
          amount,
          challengeId: challenge.id,
          expires: challenge.expires ?? new Date(Date.now() + 5 * 60_000).toISOString(),
        })
        return Credential.serialize(Credential.from({ challenge, payload, source }))
      }

      // permit2
      const spender = request.methodDetails?.permit2Spender
      if (!spender) {
        throw new Error('Challenge missing permit2Spender required for permit2 credential')
      }
      const payload = await createPermit2Credential({
        account,
        chainId,
        tokenAddress,
        spender: getAddress(spender) as Hex,
        amount,
        challengeId: challenge.id,
        realm: challenge.realm,
        expires: challenge.expires ?? new Date(Date.now() + 5 * 60_000).toISOString(),
      })
      return Credential.serialize(Credential.from({ challenge, payload, source }))
    },
  })
}
