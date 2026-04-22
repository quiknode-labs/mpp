import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keccak256, stringToBytes } from 'viem'
import {
  challengeIdBytes32,
  eip3009Nonce,
  permit2Domain,
  permit2Nonce,
  permit2WitnessHash,
  permit2WitnessTypeString,
} from './typedData.js'

test('eip3009Nonce is deterministic keccak256(challengeId)', () => {
  const id = 'chg_01HZZZ0000000000'
  assert.equal(eip3009Nonce(id), keccak256(stringToBytes(id)))
})

test('challengeIdBytes32 matches keccak256(utf8(id))', () => {
  const id = 'chg_abc'
  assert.equal(challengeIdBytes32(id), keccak256(stringToBytes(id)))
})

test('permit2Nonce returns a decimal-string bigint derived from id', () => {
  const n = permit2Nonce('chg_abc')
  assert.doesNotThrow(() => BigInt(n))
  assert.ok(n.length > 0)
})

test('permit2Domain uses canonical Permit2 address and given chainId', () => {
  const d = permit2Domain(8453)
  assert.equal(d.name, 'Permit2')
  assert.equal(d.chainId, 8453)
  assert.equal(d.verifyingContract, '0x000000000022D473030F116dDEE9F6B43aC78BA3')
})

test('permit2WitnessHash is deterministic for same inputs', () => {
  const h1 = permit2WitnessHash('chg_abc', 'https://api.example.com')
  const h2 = permit2WitnessHash('chg_abc', 'https://api.example.com')
  assert.equal(h1, h2)
})

test('permit2WitnessHash differs per challenge id', () => {
  const h1 = permit2WitnessHash('chg_a', 'https://api.example.com')
  const h2 = permit2WitnessHash('chg_b', 'https://api.example.com')
  assert.notEqual(h1, h2)
})

test('permit2WitnessTypeString contains ChargeWitness and TokenPermissions defs', () => {
  assert.match(permit2WitnessTypeString, /ChargeWitness\(bytes32 challengeId,string realm\)/)
  assert.match(permit2WitnessTypeString, /TokenPermissions\(address token,uint256 amount\)/)
})
