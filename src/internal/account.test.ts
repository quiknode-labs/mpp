import assert from 'node:assert/strict'
import { test } from 'node:test'
import { privateKeyToAccount } from 'viem/accounts'
import { resolveSigner } from './account.js'

const ANVIL_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const

test('resolveSigner derives account from privateKey', () => {
  const account = resolveSigner({ privateKey: ANVIL_0 })
  assert.equal(account.address, privateKeyToAccount(ANVIL_0).address)
})

test('resolveSigner passes through explicit account', () => {
  const base = privateKeyToAccount(ANVIL_0)
  const account = resolveSigner({ account: base })
  assert.equal(account, base)
})
