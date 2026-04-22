/**
 * Manual end-to-end test on Base Sepolia — not run in CI.
 *
 * Usage:
 *   RPC_URL=https://base-sepolia.g.alchemy.com/v2/<key> \
 *   PAYER_PK=0x... \
 *   SUBMITTER_PK=0x... \
 *   RECIPIENT=0x... \
 *   npx tsx scripts/live-sepolia.ts --type hash
 *
 *   # or --type authorization, --type permit2
 *
 * Requirements:
 *   - PAYER has Base Sepolia USDC (faucet: https://faucet.circle.com/).
 *   - For `hash`: PAYER also needs Base Sepolia ETH for gas.
 *   - For `authorization`: SUBMITTER needs Base Sepolia ETH for gas.
 *   - For `permit2`: SUBMITTER needs ETH AND PAYER must have approved Permit2
 *     (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) on the USDC contract
 *     for at least `amount`.
 */

import { Store } from 'mppx'
import {
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { createAuthorizationCredential } from '../src/client/authorization.js'
import { createHashCredential } from '../src/client/hash.js'
import { createPermit2Credential } from '../src/client/permit2.js'
import { CHAIN_IDS, ERC20_ABI, USDC_CONTRACTS } from '../src/constants.js'
import type { ChargeStore } from '../src/server/replay.js'
import { verifyAuthorization } from '../src/server/verifiers/authorization.js'
import { verifyHash } from '../src/server/verifiers/hash.js'
import { verifyPermit2 } from '../src/server/verifiers/permit2.js'

const type = process.argv.find((arg, i, arr) => arr[i - 1] === '--type')
if (!type || !['hash', 'authorization', 'permit2'].includes(type)) {
  console.error('Usage: live-sepolia.ts --type hash|authorization|permit2')
  process.exit(1)
}

const RPC_URL = process.env.RPC_URL
const PAYER_PK = process.env.PAYER_PK as Hex | undefined
const SUBMITTER_PK = process.env.SUBMITTER_PK as Hex | undefined
const RECIPIENT = process.env.RECIPIENT as Hex | undefined

if (!RPC_URL || !PAYER_PK || !RECIPIENT) {
  console.error('Missing env: RPC_URL, PAYER_PK, RECIPIENT required.')
  process.exit(1)
}
if (type !== 'hash' && !SUBMITTER_PK) {
  console.error('SUBMITTER_PK required for authorization/permit2 types.')
  process.exit(1)
}

const payer = privateKeyToAccount(PAYER_PK)
const submitter = SUBMITTER_PK ? privateKeyToAccount(SUBMITTER_PK) : undefined

const CHAIN_ID = CHAIN_IDS['base-sepolia']
const TOKEN = USDC_CONTRACTS['base-sepolia']
const AMOUNT = 1000n // 0.001 USDC
const CHALLENGE_ID = `chg_live_${Date.now()}`
const REALM = 'https://example.test'
const EXPIRES = new Date(Date.now() + 5 * 60_000).toISOString()

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
}) as unknown as PublicClient
const store = Store.memory() as ChargeStore

console.log(`▶ type=${type} chain=base-sepolia amount=${AMOUNT} recipient=${RECIPIENT}`)

if (type === 'hash') {
  console.log('▶ creating credential (client broadcasts)…')
  const payload = await createHashCredential({
    account: payer,
    rpcUrl: RPC_URL,
    chainId: CHAIN_ID,
    tokenAddress: TOKEN,
    recipient: RECIPIENT,
    amount: AMOUNT,
  })
  console.log(`  txHash: ${payload.txHash}`)
  console.log('▶ verifying…')
  const receipt = await verifyHash({
    payload,
    request: {
      amount: AMOUNT.toString(),
      currency: TOKEN,
      recipient: RECIPIENT,
      methodDetails: { chainId: CHAIN_ID },
    },
    client: publicClient,
    store,
    confirmations: 1,
    expectedChainId: CHAIN_ID,
  })
  console.log('✔ receipt:', receipt)
} else if (type === 'authorization') {
  if (!submitter) throw new Error('unreachable')
  const [name, version] = (await Promise.all([
    publicClient.readContract({ address: TOKEN, abi: ERC20_ABI, functionName: 'name' }),
    publicClient.readContract({ address: TOKEN, abi: ERC20_ABI, functionName: 'version' }),
  ])) as [string, string]
  console.log(`▶ token domain: name="${name}" version="${version}"`)
  console.log('▶ signing EIP-3009 authorization…')
  const payload = await createAuthorizationCredential({
    account: payer,
    chainId: CHAIN_ID,
    tokenAddress: TOKEN,
    tokenName: name,
    tokenVersion: version,
    recipient: RECIPIENT,
    amount: AMOUNT,
    challengeId: CHALLENGE_ID,
    expires: EXPIRES,
  })
  console.log('▶ verifying + broadcasting via submitter…')
  const walletClient = createWalletClient({
    account: submitter,
    chain: baseSepolia,
    transport: http(RPC_URL),
  }) as unknown as WalletClient
  const receipt = await verifyAuthorization({
    payload,
    request: {
      amount: AMOUNT.toString(),
      currency: TOKEN,
      recipient: RECIPIENT,
      methodDetails: { tokenName: name, tokenVersion: version },
    },
    challenge: { id: CHALLENGE_ID },
    publicClient,
    walletClient,
    store,
    chainId: CHAIN_ID,
    confirmations: 1,
  })
  console.log('✔ receipt:', receipt)
} else {
  if (!submitter) throw new Error('unreachable')
  console.log('▶ signing Permit2 witness…')
  const payload = await createPermit2Credential({
    account: payer,
    chainId: CHAIN_ID,
    tokenAddress: TOKEN,
    spender: submitter.address,
    amount: AMOUNT,
    challengeId: CHALLENGE_ID,
    realm: REALM,
    expires: EXPIRES,
  })
  console.log('▶ verifying + broadcasting via Permit2…')
  const walletClient = createWalletClient({
    account: submitter,
    chain: baseSepolia,
    transport: http(RPC_URL),
  }) as unknown as WalletClient
  const receipt = await verifyPermit2({
    payload,
    request: {
      amount: AMOUNT.toString(),
      currency: TOKEN,
      recipient: RECIPIENT,
      methodDetails: {},
    },
    challenge: { id: CHALLENGE_ID, realm: REALM },
    publicClient,
    walletClient,
    store,
    chainId: CHAIN_ID,
    confirmations: 1,
  })
  console.log('✔ receipt:', receipt)
}
