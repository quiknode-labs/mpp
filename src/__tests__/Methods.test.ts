import assert from 'node:assert/strict'
import { test } from 'node:test'
import { charge } from '../Methods.js'

test('request schema parses and transforms human amount to base units', () => {
  const parsed = charge.schema.request.safeParse({
    amount: '0.01',
    currency: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    decimals: 6,
    recipient: '0x1111111111111111111111111111111111111111',
    chainId: 84532,
    credentialTypes: ['permit2', 'hash'],
  })
  assert.equal(parsed.success, true)
  assert.ok(parsed.data)
  assert.equal(parsed.data.amount, '10000')
  assert.equal(parsed.data.methodDetails?.chainId, 84532)
  assert.deepEqual(parsed.data.methodDetails?.credentialTypes, ['permit2', 'hash'])
  assert.equal(parsed.data.methodDetails?.decimals, 6)
})

test('request schema rejects missing required fields', () => {
  const parsed = charge.schema.request.safeParse({ amount: '1' })
  assert.equal(parsed.success, false)
})

test('credential payload discriminated union — hash', () => {
  const parsed = charge.schema.credential.payload.safeParse({
    type: 'hash',
    txHash: '0xaaaa000000000000000000000000000000000000000000000000000000000001',
    chainId: 8453,
  })
  assert.equal(parsed.success, true)
})

test('credential payload discriminated union — authorization', () => {
  const parsed = charge.schema.credential.payload.safeParse({
    type: 'authorization',
    signature: `0x${'ab'.repeat(65)}`,
    from: '0x1111111111111111111111111111111111111111',
    validAfter: 0,
    validBefore: 9999999999,
    nonce: '0xbbbb000000000000000000000000000000000000000000000000000000000002',
  })
  assert.equal(parsed.success, true)
})

test('credential payload discriminated union — permit2', () => {
  const parsed = charge.schema.credential.payload.safeParse({
    type: 'permit2',
    from: '0x1111111111111111111111111111111111111111',
    signature: `0x${'cd'.repeat(65)}`,
    deadline: 9999999999,
    nonce: '12345',
    permitted: [{ token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', amount: '10000' }],
  })
  assert.equal(parsed.success, true)
})

test('credential payload rejects unknown type', () => {
  const parsed = charge.schema.credential.payload.safeParse({
    type: 'bogus',
    whatever: 1,
  })
  assert.equal(parsed.success, false)
})
