import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Store } from 'mppx'
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  type PublicClient,
  pad,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ERC20_ABI } from '../../constants.js'
import {
  eip3009Domain,
  eip3009Message,
  eip3009Nonce,
  eip3009Types,
} from '../../internal/typedData.js'
import type { ChargeStore } from '../replay.js'
import { verifyAuthorization } from './authorization.js'

const ANVIL_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const SUBMITTER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const
const PAYER = privateKeyToAccount(ANVIL_0)
const SUBMITTER = privateKeyToAccount(SUBMITTER_KEY)

const TOKEN = getAddress('0x036CbD53842c5426634e7929541eC2318f3dCF7e')
const RECIPIENT = getAddress('0x1111111111111111111111111111111111111111')
const AMOUNT = '10000'
const CHAIN_ID = 84532
const CHALLENGE_ID = 'chg_test_authorization_001'
const TX_HASH = `0x${'ee'.repeat(32)}` as const

function buildTransferLog(overrides: { from?: `0x${string}`; to?: `0x${string}`; value?: bigint }) {
  const { from = PAYER.address, to = RECIPIENT, value = BigInt(AMOUNT) } = overrides
  const topics = encodeEventTopics({
    abi: ERC20_ABI,
    eventName: 'Transfer',
    args: { from, to },
  })
  return {
    address: TOKEN,
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

function stubClients(
  overrides: {
    balance?: bigint
    receiptStatus?: 'success' | 'reverted'
    logs?: ReturnType<typeof buildTransferLog>[]
  } = {},
) {
  const {
    balance = BigInt(AMOUNT),
    receiptStatus = 'success',
    logs = [buildTransferLog({})],
  } = overrides
  const publicClient = {
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'balanceOf') return balance
      throw new Error(`Unexpected readContract call: ${functionName}`)
    },
    simulateContract: async ({ args }: { args: unknown[] }) => ({ request: { args } }),
    waitForTransactionReceipt: async () => ({
      status: receiptStatus,
      transactionHash: TX_HASH,
      logs,
    }),
  } as unknown as PublicClient
  const walletClient = {
    account: SUBMITTER,
    writeContract: async () => TX_HASH,
  } as unknown as WalletClient
  return { publicClient, walletClient }
}

async function buildPayload(overrides: { nonce?: `0x${string}`; validBefore?: number } = {}) {
  const nonce = overrides.nonce ?? eip3009Nonce(CHALLENGE_ID)
  const validAfter = 0
  const validBefore = overrides.validBefore ?? Math.floor(Date.now() / 1000) + 300
  const domain = eip3009Domain({
    tokenName: 'USD Coin',
    tokenVersion: '2',
    chainId: CHAIN_ID,
    tokenAddress: TOKEN,
  })
  const message = eip3009Message({
    from: PAYER.address,
    to: RECIPIENT,
    value: AMOUNT,
    validAfter,
    validBefore,
    nonce,
  })
  const signature = await PAYER.signTypedData({
    domain,
    types: eip3009Types,
    primaryType: 'TransferWithAuthorization',
    message,
  })
  return {
    type: 'authorization' as const,
    signature,
    from: PAYER.address,
    validAfter,
    validBefore,
    nonce,
  }
}

function baseRequest() {
  return {
    amount: AMOUNT,
    currency: TOKEN,
    recipient: RECIPIENT,
    methodDetails: { tokenName: 'USD Coin', tokenVersion: '2' },
  }
}

test('verifyAuthorization happy path', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload()
  const receipt = await verifyAuthorization({
    payload,
    request: baseRequest(),
    challenge: { id: CHALLENGE_ID },
    publicClient,
    walletClient,
    store,
    chainId: CHAIN_ID,
    confirmations: 1,
  })
  assert.equal(receipt.method, 'evm')
  assert.equal(receipt.status, 'success')
  assert.equal(receipt.reference, TX_HASH)
})

test('verifyAuthorization rejects wrong nonce', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const wrongNonce = `0x${'ff'.repeat(32)}` as const
  const payload = await buildPayload({ nonce: wrongNonce })
  await assert.rejects(
    verifyAuthorization({
      payload,
      request: baseRequest(),
      challenge: { id: CHALLENGE_ID },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /nonce mismatch/i,
  )
})

test('verifyAuthorization rejects expired validBefore', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload({ validBefore: Math.floor(Date.now() / 1000) - 10 })
  await assert.rejects(
    verifyAuthorization({
      payload,
      request: baseRequest(),
      challenge: { id: CHALLENGE_ID },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /expired/i,
  )
})

test('verifyAuthorization rejects insufficient balance', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients({ balance: 1n })
  const payload = await buildPayload()
  await assert.rejects(
    verifyAuthorization({
      payload,
      request: baseRequest(),
      challenge: { id: CHALLENGE_ID },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /insufficient payer balance/i,
  )
})

test('verifyAuthorization rejects replay of the same nonce', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload()
  await verifyAuthorization({
    payload,
    request: baseRequest(),
    challenge: { id: CHALLENGE_ID },
    publicClient,
    walletClient,
    store,
    chainId: CHAIN_ID,
    confirmations: 1,
  })
  await assert.rejects(
    verifyAuthorization({
      payload,
      request: baseRequest(),
      challenge: { id: CHALLENGE_ID },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /already been used/i,
  )
})

test('verifyAuthorization rejects missing tokenName/version in challenge', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload()
  await assert.rejects(
    verifyAuthorization({
      payload,
      request: { amount: AMOUNT, currency: TOKEN, recipient: RECIPIENT, methodDetails: {} },
      challenge: { id: CHALLENGE_ID },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /tokenName\/tokenVersion/i,
  )
})
