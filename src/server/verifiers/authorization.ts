import { Errors, Receipt } from 'mppx'
import { getAddress, type PublicClient, parseEventLogs, type WalletClient } from 'viem'
import { verifyTypedData } from 'viem/actions'
import { EIP3009_ABI, ERC20_ABI } from '../../constants.js'
import {
  eip3009Domain,
  eip3009Message,
  eip3009Nonce,
  eip3009Types,
} from '../../internal/typedData.js'
import type { AuthorizationPayload } from '../../types.js'
import { authorizationKey, type ChargeStore, markUsed, releaseUse } from '../replay.js'

export async function verifyAuthorization(parameters: {
  payload: AuthorizationPayload
  request: {
    amount: string
    currency: string
    recipient?: string | undefined
    externalId?: string | undefined
    methodDetails?:
      | { tokenName?: string | undefined; tokenVersion?: string | undefined }
      | undefined
  }
  challenge: { id: string }
  publicClient: PublicClient
  walletClient: WalletClient
  store: ChargeStore
  chainId: number
  confirmations: number
}): Promise<Receipt.Receipt> {
  const { payload, request, challenge, publicClient, walletClient, store, chainId, confirmations } =
    parameters
  const { amount, currency, recipient, externalId } = request

  if (!recipient) {
    throw new Errors.VerificationFailedError({ reason: 'Missing recipient in challenge' })
  }
  if (!walletClient.account) {
    throw new Errors.VerificationFailedError({ reason: 'Submitter walletClient has no account' })
  }

  const expectedNonce = eip3009Nonce(challenge.id)
  if (payload.nonce.toLowerCase() !== expectedNonce.toLowerCase()) {
    throw new Errors.VerificationFailedError({ reason: 'Authorization nonce mismatch' })
  }

  const tokenAddress = getAddress(currency)
  const expectedRecipient = getAddress(recipient)
  const expectedAmount = BigInt(amount)

  const now = Math.floor(Date.now() / 1000)
  if (payload.validAfter > now) {
    throw new Errors.VerificationFailedError({ reason: 'Authorization not yet valid' })
  }
  if (payload.validBefore <= now) {
    throw new Errors.VerificationFailedError({ reason: 'Authorization expired' })
  }

  const key = authorizationKey(chainId, tokenAddress, payload.nonce)
  if (!(await markUsed(store, key))) {
    throw new Errors.VerificationFailedError({ reason: 'Authorization has already been used' })
  }

  try {
    const tokenName = request.methodDetails?.tokenName
    const tokenVersion = request.methodDetails?.tokenVersion
    if (!tokenName || !tokenVersion) {
      throw new Errors.VerificationFailedError({
        reason: 'Missing token EIP-712 domain (tokenName/tokenVersion) in challenge',
      })
    }

    const domain = eip3009Domain({ tokenName, tokenVersion, chainId, tokenAddress })
    const message = eip3009Message({
      from: payload.from,
      to: expectedRecipient,
      value: amount,
      validAfter: payload.validAfter,
      validBefore: payload.validBefore,
      nonce: payload.nonce,
    })

    const signatureValid = await verifyTypedData(publicClient, {
      address: payload.from,
      domain,
      types: eip3009Types,
      primaryType: 'TransferWithAuthorization',
      message,
      signature: payload.signature,
      mode: 'eoa',
    })
    if (!signatureValid) {
      throw new Errors.VerificationFailedError({ reason: 'Invalid EIP-3009 signature' })
    }

    const balance = (await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [payload.from],
    })) as bigint
    if (balance < expectedAmount) {
      throw new Errors.VerificationFailedError({ reason: 'Insufficient payer balance' })
    }

    const { request: simulatedRequest } = await publicClient.simulateContract({
      account: walletClient.account,
      address: tokenAddress,
      abi: EIP3009_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        payload.from,
        expectedRecipient,
        expectedAmount,
        BigInt(payload.validAfter),
        BigInt(payload.validBefore),
        payload.nonce,
        payload.signature,
      ],
    })

    const txHash = await walletClient.writeContract(simulatedRequest)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations })

    if (receipt.status !== 'success') {
      throw new Errors.VerificationFailedError({ reason: 'Authorization transfer reverted' })
    }

    const transferLogs = parseEventLogs({
      abi: ERC20_ABI,
      eventName: 'Transfer',
      logs: receipt.logs,
    })
    const matched = transferLogs.find(
      (log) =>
        getAddress(log.address) === tokenAddress &&
        getAddress(log.args.from) === getAddress(payload.from) &&
        getAddress(log.args.to) === expectedRecipient &&
        log.args.value === expectedAmount,
    )
    if (!matched) {
      throw new Errors.VerificationFailedError({
        reason: 'No matching Transfer event in authorization receipt',
      })
    }

    return Receipt.from({
      method: 'evm',
      status: 'success',
      reference: txHash,
      timestamp: new Date().toISOString(),
      ...(externalId ? { externalId } : {}),
    })
  } catch (error) {
    await releaseUse(store, key)
    throw error
  }
}
