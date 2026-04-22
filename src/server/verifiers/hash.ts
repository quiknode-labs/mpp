import { Errors, Receipt } from 'mppx'
import { getAddress, type PublicClient, parseEventLogs } from 'viem'
import { ERC20_ABI } from '../../constants.js'
import type { HashPayload } from '../../types.js'
import { type ChargeStore, hashKey, markUsed, releaseUse } from '../replay.js'

export async function verifyHash(parameters: {
  payload: HashPayload
  request: {
    amount: string
    currency: string
    recipient?: string | undefined
    externalId?: string | undefined
    methodDetails?: { chainId?: number | undefined } | undefined
  }
  client: PublicClient
  store: ChargeStore
  confirmations: number
  expectedChainId: number
}): Promise<Receipt.Receipt> {
  const { payload, request, client, store, confirmations, expectedChainId } = parameters
  const { txHash, chainId } = payload
  const { amount, currency, recipient, externalId } = request

  if (chainId !== expectedChainId) {
    throw new Errors.VerificationFailedError({
      reason: `Credential chainId ${chainId} does not match configured ${expectedChainId}`,
    })
  }

  if (!recipient) {
    throw new Errors.VerificationFailedError({ reason: 'Missing recipient in challenge' })
  }

  const key = hashKey(chainId, txHash)
  if (!(await markUsed(store, key))) {
    throw new Errors.VerificationFailedError({ reason: 'Transaction hash has already been used' })
  }

  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') {
      throw new Errors.VerificationFailedError({ reason: 'Transaction reverted on-chain' })
    }

    const logs = parseEventLogs({
      abi: ERC20_ABI,
      eventName: 'Transfer',
      logs: receipt.logs,
    })

    const expectedToken = getAddress(currency)
    const expectedRecipient = getAddress(recipient)
    const expectedAmount = BigInt(amount)

    const match = logs.find(
      (log) =>
        getAddress(log.address) === expectedToken &&
        getAddress(log.args.to) === expectedRecipient &&
        log.args.value === expectedAmount,
    )
    if (!match) {
      throw new Errors.VerificationFailedError({
        reason: 'No matching Transfer log in transaction',
      })
    }

    const latest = await client.getBlockNumber()
    const depth = Number(latest - receipt.blockNumber)
    if (depth < confirmations) {
      throw new Errors.VerificationFailedError({
        reason: `Insufficient confirmations: ${depth}/${confirmations}`,
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
