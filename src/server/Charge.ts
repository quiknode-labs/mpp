import { Errors, Expires, Method, Store } from 'mppx'
import type { Address, Hash, Hex } from 'viem'
import { getAddress } from 'viem'
import {
  CHAIN_IDS,
  DEFAULT_CONFIRMATIONS,
  defaultRpcUrl,
  ERC20_ABI,
  NATIVE_TOKEN_ADDRESS,
  PERMIT2_ADDRESS,
  type SupportedToken,
  TOKEN_CONTRACTS,
  TOKEN_CREDENTIAL_TYPES,
  TOKEN_DECIMALS,
} from '../constants.js'
import { resolveSigner } from '../internal/account.js'
import { logDefaultTransportOnce } from '../internal/transport.js'
import { charge as chargeMethod } from '../Methods.js'
import type {
  AuthorizationPayload,
  CredentialType,
  HashPayload,
  Permit2Payload,
  ServerParameters,
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
    customToken,
  } = parameters

  if (parameters.token && customToken) {
    throw new Error('evm.charge: pass either `token` or `customToken`, not both.')
  }

  let tokenAddress: Address
  let tokenDecimals: number
  let tokenLabel: string
  let allowedTypes: readonly CredentialType[]
  let isNative: boolean
  let nameOverride: string | undefined
  let versionOverride: string | undefined

  if (customToken) {
    tokenAddress = getAddress(customToken.address)
    tokenDecimals = customToken.decimals
    tokenLabel = customToken.symbol ?? tokenAddress
    isNative = tokenAddress === getAddress(NATIVE_TOKEN_ADDRESS)
    const defaults: readonly CredentialType[] = isNative ? ['hash'] : ['permit2', 'hash']
    allowedTypes = customToken.credentialTypes ?? defaults
    if (isNative && allowedTypes.some((t) => t !== 'hash')) {
      throw new Error(
        "Native token (zero address) only supports the 'hash' credential. " +
          'Remove non-hash entries from credentialTypes.',
      )
    }
    nameOverride = customToken.name
    versionOverride = customToken.version
  } else {
    const tokenSymbol: SupportedToken = parameters.token ?? 'USDC'
    const curatedAddress = TOKEN_CONTRACTS[tokenSymbol]?.[chain]
    if (!curatedAddress) {
      const supportedOnChain = (Object.keys(TOKEN_CONTRACTS) as SupportedToken[])
        .filter((t) => TOKEN_CONTRACTS[t][chain])
        .join(', ')
      throw new Error(
        `${tokenSymbol} is not deployed on ${chain}. Supported tokens for this chain: ${
          supportedOnChain || '(none)'
        }`,
      )
    }
    tokenAddress = getAddress(curatedAddress)
    tokenDecimals = TOKEN_DECIMALS[tokenSymbol]
    tokenLabel = tokenSymbol
    allowedTypes = TOKEN_CREDENTIAL_TYPES[tokenSymbol]
    isNative = false
  }

  // When the caller omits `credentialTypes`, default to the per-token allowed
  // set rather than the universal one. Otherwise tokens like WETH and USDT —
  // which lack EIP-3009 — would throw on every zero-config construction
  // because the universal default includes 'authorization'.
  const acceptedTypes: readonly CredentialType[] = acceptedTypesInput ?? allowedTypes
  const invalidTypes = acceptedTypes.filter((t) => !allowedTypes.includes(t))
  if (invalidTypes.length) {
    throw new Error(
      `${tokenLabel} does not support credential types: ${invalidTypes.join(', ')}. ` +
        `Supported on ${tokenLabel}: ${allowedTypes.join(', ')}.`,
    )
  }
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

  // Native cannot use authorization (no EIP-3009 for native value transfers),
  // and we already rejected non-hash credentialTypes for native above. Skip
  // the on-chain metadata probe entirely for native — there is no contract.
  const needsMetadata = !isNative && acceptedTypes.includes('authorization')

  return Method.toServer(chargeMethod, {
    defaults: {
      currency: tokenAddress,
      decimals: tokenDecimals,
      recipient,
    },
    async request({ request }) {
      // Caller-supplied overrides win over on-chain reads. Useful for tokens
      // whose `name()`/`version()` reverts or whose EIP-712 domain values
      // differ from their ERC-20 metadata.
      const probeMetadata =
        needsMetadata && !(nameOverride && versionOverride)
          ? await getTokenMetadata().catch(() => undefined)
          : undefined
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
        tokenName: request.tokenName ?? nameOverride ?? probeMetadata?.name,
        tokenVersion: request.tokenVersion ?? versionOverride ?? probeMetadata?.version,
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
