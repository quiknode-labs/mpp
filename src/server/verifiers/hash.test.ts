import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Store } from 'mppx'
import { encodeAbiParameters, encodeEventTopics, getAddress, type PublicClient, pad } from 'viem'
import { ERC20_ABI } from '../../constants.js'
import type { ChargeStore } from '../replay.js'
import { verifyHash } from './hash.js'

const TOKEN = getAddress('0x036CbD53842c5426634e7929541eC2318f3dCF7e')
const RECIPIENT = getAddress('0x1111111111111111111111111111111111111111')
const PAYER = getAddress('0x2222222222222222222222222222222222222222')
const TX_HASH = `0x${'ab'.repeat(32)}` as const
const AMOUNT = '10000'

function buildTransferLog(parameters: {
  token?: `0x${string}`
  from?: `0x${string}`
  to?: `0x${string}`
  value?: bigint
}) {
  const { token = TOKEN, from = PAYER, to = RECIPIENT, value = BigInt(AMOUNT) } = parameters
  const topics = encodeEventTopics({
    abi: ERC20_ABI,
    eventName: 'Transfer',
    args: { from, to },
  })
  return {
    address: token,
    topics,
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
    logIndex: 0,
    transactionHash: TX_HASH,
    blockHash: pad('0x01', { size: 32 }),
    blockNumber: 100n,
    transactionIndex: 0,
    removed: false,
  }
}

function stubClient(parameters: {
  receiptStatus?: 'success' | 'reverted'
  receiptBlock?: bigint
  latestBlock?: bigint
  logs?: ReturnType<typeof buildTransferLog>[]
}): PublicClient {
  const {
    receiptStatus = 'success',
    receiptBlock = 100n,
    latestBlock = 110n,
    logs = [buildTransferLog({})],
  } = parameters
  return {
    getTransactionReceipt: async () => ({
      status: receiptStatus,
      blockNumber: receiptBlock,
      logs,
      transactionHash: TX_HASH,
    }),
    getBlockNumber: async () => latestBlock,
  } as unknown as PublicClient
}

function baseRequest() {
  return {
    amount: AMOUNT,
    currency: TOKEN,
    recipient: RECIPIENT,
    methodDetails: { chainId: 84532 },
  }
}

test('verifyHash succeeds on matching Transfer log with enough confirmations', async () => {
  const store = Store.memory() as ChargeStore
  const receipt = await verifyHash({
    payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
    request: baseRequest(),
    client: stubClient({}),
    store,
    confirmations: 1,
    expectedChainId: 84532,
  })
  assert.equal(receipt.method, 'evm')
  assert.equal(receipt.reference, TX_HASH)
  assert.equal(receipt.status, 'success')
})

test('verifyHash rejects chainId mismatch', async () => {
  const store = Store.memory() as ChargeStore
  await assert.rejects(
    verifyHash({
      payload: { type: 'hash', txHash: TX_HASH, chainId: 1 },
      request: baseRequest(),
      client: stubClient({}),
      store,
      confirmations: 1,
      expectedChainId: 84532,
    }),
    /chainId/i,
  )
})

test('verifyHash rejects reverted transaction', async () => {
  const store = Store.memory() as ChargeStore
  await assert.rejects(
    verifyHash({
      payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
      request: baseRequest(),
      client: stubClient({ receiptStatus: 'reverted' }),
      store,
      confirmations: 1,
      expectedChainId: 84532,
    }),
    /reverted/i,
  )
})

test('verifyHash rejects wrong recipient', async () => {
  const store = Store.memory() as ChargeStore
  await assert.rejects(
    verifyHash({
      payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
      request: baseRequest(),
      client: stubClient({
        logs: [buildTransferLog({ to: '0x3333333333333333333333333333333333333333' })],
      }),
      store,
      confirmations: 1,
      expectedChainId: 84532,
    }),
    /no matching Transfer/i,
  )
})

test('verifyHash rejects wrong amount', async () => {
  const store = Store.memory() as ChargeStore
  await assert.rejects(
    verifyHash({
      payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
      request: baseRequest(),
      client: stubClient({ logs: [buildTransferLog({ value: 1n })] }),
      store,
      confirmations: 1,
      expectedChainId: 84532,
    }),
    /no matching Transfer/i,
  )
})

test('verifyHash rejects insufficient confirmations', async () => {
  const store = Store.memory() as ChargeStore
  await assert.rejects(
    verifyHash({
      payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
      request: baseRequest(),
      client: stubClient({ latestBlock: 100n }),
      store,
      confirmations: 5,
      expectedChainId: 84532,
    }),
    /confirmations/i,
  )
})

test('verifyHash replay-rejects the same txHash on second call', async () => {
  const store = Store.memory() as ChargeStore
  const receipt1 = await verifyHash({
    payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
    request: baseRequest(),
    client: stubClient({}),
    store,
    confirmations: 1,
    expectedChainId: 84532,
  })
  assert.equal(receipt1.status, 'success')
  await assert.rejects(
    verifyHash({
      payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
      request: baseRequest(),
      client: stubClient({}),
      store,
      confirmations: 1,
      expectedChainId: 84532,
    }),
    /already been used/i,
  )
})

test('verifyHash releases reservation on rejection (so a later valid retry works)', async () => {
  const store = Store.memory() as ChargeStore
  await assert.rejects(
    verifyHash({
      payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
      request: baseRequest(),
      client: stubClient({ receiptStatus: 'reverted' }),
      store,
      confirmations: 1,
      expectedChainId: 84532,
    }),
  )
  const receipt = await verifyHash({
    payload: { type: 'hash', txHash: TX_HASH, chainId: 84532 },
    request: baseRequest(),
    client: stubClient({}),
    store,
    confirmations: 1,
    expectedChainId: 84532,
  })
  assert.equal(receipt.status, 'success')
})
