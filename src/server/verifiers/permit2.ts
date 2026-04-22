import { Errors, Receipt } from 'mppx'
import { getAddress, type PublicClient, parseEventLogs, type WalletClient } from 'viem'
import { verifyTypedData } from 'viem/actions'
import { ERC20_ABI, PERMIT2_ABI, PERMIT2_ADDRESS } from '../../constants.js'
import {
  permit2Domain,
  permit2Message,
  permit2Types,
  permit2WitnessHash,
  permit2WitnessTypeString,
} from '../../internal/typedData.js'
import type { Permit2Payload } from '../../types.js'
import { type ChargeStore, markUsed, permit2Key, releaseUse } from '../replay.js'

export async function verifyPermit2(parameters: {
  payload: Permit2Payload
  request: {
    amount: string
    currency: string
    recipient?: string | undefined
    externalId?: string | undefined
    methodDetails?: { permit2Address?: string | undefined } | undefined
  }
  challenge: { id: string; realm: string }
  publicClient: PublicClient
  walletClient: WalletClient
  store: ChargeStore
  chainId: number
  confirmations: number
}): Promise<Receipt.Receipt> {
  const { payload, request, challenge, publicClient, walletClient, store, chainId, confirmations } =
    parameters
  const { amount, currency, recipient, externalId } = request
  const signer = getAddress(payload.from)

  if (!recipient) {
    throw new Errors.VerificationFailedError({ reason: 'Missing recipient in challenge' })
  }
  if (!walletClient.account) {
    throw new Errors.VerificationFailedError({ reason: 'Submitter walletClient has no account' })
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.deadline <= now) {
    throw new Errors.VerificationFailedError({ reason: 'Permit2 signature expired' })
  }
  const [permit] = payload.permitted
  if (!permit || payload.permitted.length !== 1) {
    throw new Errors.VerificationFailedError({
      reason: 'Only single-token permits are supported in v0.1',
    })
  }

  const tokenAddress = getAddress(currency)
  const permitToken = getAddress(permit.token)
  if (permitToken !== tokenAddress) {
    throw new Errors.VerificationFailedError({
      reason: `Permit token ${permitToken} does not match challenge token ${tokenAddress}`,
    })
  }

  const expectedAmount = BigInt(amount)
  const permitAmount = BigInt(permit.amount)
  if (permitAmount < expectedAmount) {
    throw new Errors.VerificationFailedError({
      reason: `Permit amount ${permitAmount} is below challenge amount ${expectedAmount}`,
    })
  }

  const expectedRecipient = getAddress(recipient)
  const permit2Contract = getAddress(request.methodDetails?.permit2Address ?? PERMIT2_ADDRESS)

  const key = permit2Key(chainId, signer, payload.nonce)
  if (!(await markUsed(store, key))) {
    throw new Errors.VerificationFailedError({ reason: 'Permit2 nonce has already been used' })
  }

  try {
    const domain = permit2Domain(chainId)
    const message = permit2Message({
      challengeId: challenge.id,
      realm: challenge.realm,
      spender: walletClient.account.address,
      token: tokenAddress,
      amount: permit.amount,
      nonce: payload.nonce,
      deadline: payload.deadline,
    })

    const signatureValid = await verifyTypedData(publicClient, {
      address: signer,
      domain,
      types: permit2Types,
      primaryType: 'PermitBatchWitnessTransferFrom',
      message,
      signature: payload.signature,
      mode: 'eoa',
    })
    if (!signatureValid) {
      throw new Errors.VerificationFailedError({ reason: 'Invalid Permit2 signature' })
    }

    const balance = (await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [signer],
    })) as bigint
    if (balance < expectedAmount) {
      throw new Errors.VerificationFailedError({ reason: 'Insufficient payer balance' })
    }

    const allowance = (await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [signer, permit2Contract],
    })) as bigint
    if (allowance < expectedAmount) {
      throw new Errors.VerificationFailedError({
        reason: 'Payer has not approved Permit2 on this token',
      })
    }

    const witness = permit2WitnessHash(challenge.id, challenge.realm)

    const { request: simulatedRequest } = await publicClient.simulateContract({
      account: walletClient.account,
      address: permit2Contract,
      abi: PERMIT2_ABI,
      functionName: 'permitWitnessTransferFrom',
      args: [
        {
          permitted: [{ token: tokenAddress, amount: permitAmount }],
          nonce: BigInt(payload.nonce),
          deadline: BigInt(payload.deadline),
        },
        [{ to: expectedRecipient, requestedAmount: expectedAmount }],
        signer,
        witness,
        permit2WitnessTypeString,
        payload.signature,
      ],
    })

    const txHash = await walletClient.writeContract(simulatedRequest)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations })

    if (receipt.status !== 'success') {
      throw new Errors.VerificationFailedError({ reason: 'Permit2 transfer reverted' })
    }

    const transferLogs = parseEventLogs({
      abi: ERC20_ABI,
      eventName: 'Transfer',
      logs: receipt.logs,
    })
    const matched = transferLogs.find(
      (log) =>
        getAddress(log.address) === tokenAddress &&
        getAddress(log.args.from) === signer &&
        getAddress(log.args.to) === expectedRecipient &&
        log.args.value === expectedAmount,
    )
    if (!matched) {
      throw new Errors.VerificationFailedError({
        reason: 'No matching Transfer event in Permit2 receipt',
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
