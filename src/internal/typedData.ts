import {
  type Address,
  encodeAbiParameters,
  type Hash,
  type Hex,
  keccak256,
  stringToBytes,
  toHex,
} from 'viem'
import { PERMIT2_ADDRESS } from '../constants.js'

/**
 * Computes the bytes32 `nonce` that binds an EIP-3009 authorization to a specific challenge.
 */
export function eip3009Nonce(challengeId: string): Hash {
  return keccak256(stringToBytes(challengeId))
}

/**
 * Derives the bytes32 `challengeId` used as Permit2 witness input from the MPP challenge id string.
 */
export function challengeIdBytes32(challengeId: string): Hash {
  return keccak256(stringToBytes(challengeId))
}

/**
 * Derives a uint256 Permit2 nonce (as decimal string) from the challenge id. Permit2 stores nonces
 * as a bitmap keyed by `(owner, word)`; this picks a deterministic slot per challenge.
 */
export function permit2Nonce(challengeId: string): string {
  return BigInt(keccak256(stringToBytes(challengeId))).toString()
}

export const permit2WitnessTypeString =
  'ChargeWitness witness)ChargeWitness(bytes32 challengeId,string realm)TokenPermissions(address token,uint256 amount)'

const CHARGE_WITNESS_TYPEHASH = keccak256(
  stringToBytes('ChargeWitness(bytes32 challengeId,string realm)'),
)

/** Computes the keccak256 witness hash passed to Permit2's `permitWitnessTransferFrom`. */
export function permit2WitnessHash(challengeId: string, realm: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }],
      [CHARGE_WITNESS_TYPEHASH, challengeIdBytes32(challengeId), keccak256(stringToBytes(realm))],
    ),
  )
}

export const permit2Types = {
  PermitBatchWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions[]' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'ChargeWitness' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  ChargeWitness: [
    { name: 'challengeId', type: 'bytes32' },
    { name: 'realm', type: 'string' },
  ],
} as const

export function permit2Domain(chainId: number) {
  return {
    name: 'Permit2',
    chainId,
    verifyingContract: PERMIT2_ADDRESS,
  } as const
}

export type Permit2Message = {
  permitted: readonly { token: Address; amount: bigint }[]
  spender: Address
  nonce: bigint
  deadline: bigint
  witness: {
    challengeId: Hex
    realm: string
  }
}

export function permit2Message(parameters: {
  challengeId: string
  realm: string
  spender: Address
  token: Address
  amount: string
  nonce: string
  deadline: number
}): Permit2Message {
  return {
    permitted: [{ token: parameters.token, amount: BigInt(parameters.amount) }],
    spender: parameters.spender,
    nonce: BigInt(parameters.nonce),
    deadline: BigInt(parameters.deadline),
    witness: {
      challengeId: challengeIdBytes32(parameters.challengeId),
      realm: parameters.realm,
    },
  }
}

export const eip3009Types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

export function eip3009Domain(parameters: {
  tokenName: string
  tokenVersion: string
  chainId: number
  tokenAddress: Address
}) {
  return {
    name: parameters.tokenName,
    version: parameters.tokenVersion,
    chainId: parameters.chainId,
    verifyingContract: parameters.tokenAddress,
  } as const
}

export type Eip3009Message = {
  from: Address
  to: Address
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: Hex
}

export function eip3009Message(parameters: {
  from: Address
  to: Address
  value: string
  validAfter: number
  validBefore: number
  nonce: Hex
}): Eip3009Message {
  return {
    from: parameters.from,
    to: parameters.to,
    value: BigInt(parameters.value),
    validAfter: BigInt(parameters.validAfter),
    validBefore: BigInt(parameters.validBefore),
    nonce: parameters.nonce,
  }
}

/** Convert an ISO 8601 timestamp to unix seconds (BigInt-safe). */
export function isoToUnix(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

export { toHex }
