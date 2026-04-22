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
import { ERC20_ABI, PERMIT2_ADDRESS } from '../../constants.js'
import {
  permit2Domain,
  permit2Message,
  permit2Nonce,
  permit2Types,
} from '../../internal/typedData.js'
import type { ChargeStore } from '../replay.js'
import { verifyPermit2 } from './permit2.js'

const ANVIL_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const SUBMITTER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const
const PAYER = privateKeyToAccount(ANVIL_0)
const SUBMITTER = privateKeyToAccount(SUBMITTER_KEY)

const TOKEN = getAddress('0x036CbD53842c5426634e7929541eC2318f3dCF7e')
const RECIPIENT = getAddress('0x1111111111111111111111111111111111111111')
const AMOUNT = '10000'
const CHAIN_ID = 84532
const CHALLENGE_ID = 'chg_test_permit2_001'
const REALM = 'https://api.example.com'
const TX_HASH = `0x${'cc'.repeat(32)}` as const

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
  overrides: { balance?: bigint; allowance?: bigint; receiptStatus?: 'success' | 'reverted' } = {},
) {
  const {
    balance = BigInt(AMOUNT),
    allowance = BigInt(AMOUNT) * 2n,
    receiptStatus = 'success',
  } = overrides
  const publicClient = {
    readContract: async ({ functionName }: { functionName: string }) => {
      if (functionName === 'balanceOf') return balance
      if (functionName === 'allowance') return allowance
      throw new Error(`Unexpected readContract: ${functionName}`)
    },
    simulateContract: async ({ args }: { args: unknown[] }) => ({ request: { args } }),
    waitForTransactionReceipt: async () => ({
      status: receiptStatus,
      transactionHash: TX_HASH,
      logs: [buildTransferLog({})],
    }),
  } as unknown as PublicClient
  const walletClient = {
    account: SUBMITTER,
    writeContract: async () => TX_HASH,
  } as unknown as WalletClient
  return { publicClient, walletClient }
}

async function buildPayload(overrides: { deadline?: number } = {}) {
  const nonce = permit2Nonce(CHALLENGE_ID)
  const deadline = overrides.deadline ?? Math.floor(Date.now() / 1000) + 300
  const domain = permit2Domain(CHAIN_ID)
  const message = permit2Message({
    challengeId: CHALLENGE_ID,
    realm: REALM,
    spender: SUBMITTER.address,
    token: TOKEN,
    amount: AMOUNT,
    nonce,
    deadline,
  })
  const signature = await PAYER.signTypedData({
    domain,
    types: permit2Types,
    primaryType: 'PermitBatchWitnessTransferFrom',
    message,
  })
  return {
    type: 'permit2' as const,
    from: PAYER.address,
    signature,
    deadline,
    nonce,
    permitted: [{ token: TOKEN, amount: AMOUNT }],
  }
}

function baseRequest() {
  return {
    amount: AMOUNT,
    currency: TOKEN,
    recipient: RECIPIENT,
    methodDetails: { permit2Address: PERMIT2_ADDRESS },
  }
}

test('verifyPermit2 happy path', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload()
  const receipt = await verifyPermit2({
    payload,
    request: baseRequest(),
    challenge: { id: CHALLENGE_ID, realm: REALM },
    publicClient,
    walletClient,
    store,
    chainId: CHAIN_ID,
    confirmations: 1,
  })
  assert.equal(receipt.status, 'success')
  assert.equal(receipt.reference, TX_HASH)
})

test('verifyPermit2 rejects expired deadline', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload({ deadline: Math.floor(Date.now() / 1000) - 5 })
  await assert.rejects(
    verifyPermit2({
      payload,
      request: baseRequest(),
      challenge: { id: CHALLENGE_ID, realm: REALM },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /expired/i,
  )
})

test('verifyPermit2 rejects token mismatch', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload()
  const req = {
    ...baseRequest(),
    currency: getAddress('0x2222222222222222222222222222222222222222'),
  }
  await assert.rejects(
    verifyPermit2({
      payload,
      request: req,
      challenge: { id: CHALLENGE_ID, realm: REALM },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /does not match challenge token/i,
  )
})

test('verifyPermit2 rejects insufficient allowance', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients({ allowance: 0n })
  const payload = await buildPayload()
  await assert.rejects(
    verifyPermit2({
      payload,
      request: baseRequest(),
      challenge: { id: CHALLENGE_ID, realm: REALM },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /not approved Permit2/i,
  )
})

test('verifyPermit2 rejects replay of same nonce', async () => {
  const store = Store.memory() as ChargeStore
  const { publicClient, walletClient } = stubClients()
  const payload = await buildPayload()
  await verifyPermit2({
    payload,
    request: baseRequest(),
    challenge: { id: CHALLENGE_ID, realm: REALM },
    publicClient,
    walletClient,
    store,
    chainId: CHAIN_ID,
    confirmations: 1,
  })
  await assert.rejects(
    verifyPermit2({
      payload,
      request: baseRequest(),
      challenge: { id: CHALLENGE_ID, realm: REALM },
      publicClient,
      walletClient,
      store,
      chainId: CHAIN_ID,
      confirmations: 1,
    }),
    /already been used/i,
  )
})
