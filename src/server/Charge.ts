import { Errors, Expires, Method, Store } from 'mppx'
import type { Address, Hash, Hex } from 'viem'
import { getAddress } from 'viem'
import {
  CHAIN_IDS,
  DEFAULT_CONFIRMATIONS,
  defaultRpcUrl,
  ERC20_ABI,
  PERMIT2_ADDRESS,
  USDC_CONTRACTS,
} from '../constants.js'
import { resolveSigner } from '../internal/account.js'
import { logDefaultTransportOnce } from '../internal/transport.js'
import { charge as chargeMethod } from '../Methods.js'
import {
  type AuthorizationPayload,
  type CredentialType,
  credentialTypes,
  type HashPayload,
  type Permit2Payload,
  type ServerParameters,
} from '../types.js'
import { getPublicClient, getWalletClient } from './rpc.js'
import { verifyAuthorization } from './verifiers/authorization.js'
import { verifyHash } from './verifiers/hash.js'
import { verifyPermit2 } from './verifiers/permit2.js'

/**
 * Creates an EVM charge method intent for usage on the server.
 *
 * @example
 * ```ts
 * import { Mppx, evm } from '@quicknode/mpp/server'
 *
 * const mppx = Mppx.create({
 *   methods: [evm.charge({
 *     recipient: '0x...',
 *     chain: 'base',
 *     rpcUrl: 'https://base-mainnet.quiknode.pro/<key>',
 *     submitter: { privateKey: '0x...' },
 *   })],
 * })
 * ```
 */
export function charge(parameters: ServerParameters) {
  const {
    chain,
    recipient,
    rpcUrl,
    credentialTypes: acceptedTypesInput,
    confirmations: confirmationsInput,
    store: storeInput,
    submitter,
  } = parameters
  const acceptedTypes: readonly CredentialType[] = acceptedTypesInput ?? credentialTypes
  const tokenAddress = USDC_CONTRACTS[chain]
  const chainId = CHAIN_IDS[chain]
  const confirmations = confirmationsInput ?? DEFAULT_CONFIRMATIONS[chain]
  const store = storeInput ?? (Store.memory() as NonNullable<ServerParameters['store']>)

  const needsSubmitter = acceptedTypes.some((t) => t === 'permit2' || t === 'authorization')
  if (needsSubmitter && !submitter) {
    throw new Error(
      '`submitter` is required when credentialTypes includes `permit2` or `authorization`.',
    )
  }
  const submitterAccount = submitter ? resolveSigner(submitter) : undefined

  const resolvedRpcUrl = rpcUrl ?? defaultRpcUrl(chain)
  const useDefaultTransport = rpcUrl === undefined

  if (useDefaultTransport) {
    logDefaultTransportOnce(chain)
  }

  const publicClient = getPublicClient({
    chain,
    rpcUrl: resolvedRpcUrl,
    useDefaultTransport,
  })
  const walletClient = submitterAccount
    ? getWalletClient({
        chain,
        rpcUrl: resolvedRpcUrl,
        account: submitterAccount,
        useDefaultTransport,
      })
    : undefined

  let tokenMetadata: Promise<{ name: string; version: string }> | undefined
  const getTokenMetadata = () => {
    if (!tokenMetadata) {
      tokenMetadata = Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name',
        }) as Promise<string>,
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'version',
        }) as Promise<string>,
      ]).then(([name, version]) => ({ name, version }))
    }
    return tokenMetadata
  }

  const needsMetadata = acceptedTypes.includes('authorization')

  return Method.toServer(chargeMethod, {
    defaults: {
      currency: tokenAddress,
      decimals: 6,
      recipient,
    },
    async request({ request }) {
      const metadata = needsMetadata ? await getTokenMetadata().catch(() => undefined) : undefined
      return {
        ...request,
        chainId: request.chainId ?? chainId,
        credentialTypes: [...(request.credentialTypes ?? acceptedTypes)],
        permit2Address:
          request.permit2Address ??
          (acceptedTypes.includes('permit2') ? PERMIT2_ADDRESS : undefined),
        permit2Spender:
          request.permit2Spender ??
          (acceptedTypes.includes('permit2') && walletClient?.account?.address
            ? walletClient.account.address
            : undefined),
        tokenName: request.tokenName ?? metadata?.name,
        tokenVersion: request.tokenVersion ?? metadata?.version,
      }
    },
    async verify({ credential, request }) {
      const { challenge } = credential
      Expires.assert(challenge.expires, challenge.id)

      const resolvedRequest = (() => {
        const parsed = chargeMethod.schema.request.safeParse(request)
        if (parsed.success && parsed.data) return parsed.data
        return request as unknown as NonNullable<typeof parsed.data>
      })()

      const payload = credential.payload as HashPayload | AuthorizationPayload | Permit2Payload
      if (!acceptedTypes.includes(payload.type)) {
        throw new Errors.VerificationFailedError({
          reason: `Credential type '${payload.type}' is not accepted by this server`,
        })
      }

      const verifyRequest = {
        amount: resolvedRequest.amount,
        currency: resolvedRequest.currency,
        recipient: resolvedRequest.recipient,
        externalId: resolvedRequest.externalId,
        methodDetails: resolvedRequest.methodDetails,
      }

      if (payload.type === 'hash') {
        return verifyHash({
          payload: { type: 'hash', txHash: payload.txHash as Hash, chainId: payload.chainId },
          request: verifyRequest,
          client: publicClient,
          store,
          confirmations,
          expectedChainId: chainId,
        })
      }

      if (payload.type === 'authorization') {
        if (!walletClient) {
          throw new Errors.VerificationFailedError({
            reason: 'Server is not configured to accept authorization credentials',
          })
        }
        return verifyAuthorization({
          payload: {
            type: 'authorization',
            signature: payload.signature as Hex,
            from: getAddress(payload.from),
            validAfter: payload.validAfter,
            validBefore: payload.validBefore,
            nonce: payload.nonce as Hash,
          },
          request: verifyRequest,
          challenge: { id: challenge.id },
          publicClient,
          walletClient,
          store,
          chainId,
          confirmations,
        })
      }

      if (payload.type === 'permit2') {
        if (!walletClient) {
          throw new Errors.VerificationFailedError({
            reason: 'Server is not configured to accept permit2 credentials',
          })
        }
        return verifyPermit2({
          payload: {
            type: 'permit2',
            from: getAddress(payload.from),
            signature: payload.signature as Hex,
            deadline: payload.deadline,
            nonce: payload.nonce,
            permitted: payload.permitted.map((p) => ({
              token: getAddress(p.token) as Address,
              amount: p.amount,
            })),
          },
          request: verifyRequest,
          challenge: { id: challenge.id, realm: challenge.realm },
          publicClient,
          walletClient,
          store,
          chainId,
          confirmations,
        })
      }

      throw new Errors.VerificationFailedError({
        reason: `Unsupported credential type`,
      })
    },
  })
}
