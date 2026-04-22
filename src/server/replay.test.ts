import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Store } from 'mppx'
import {
  authorizationKey,
  type ChargeStore,
  hashKey,
  markUsed,
  permit2Key,
  releaseUse,
} from './replay.js'

test('markUsed returns true first time and false on replay', async () => {
  const store = Store.memory() as ChargeStore
  const key = hashKey(84532, '0xdeadbeef')
  assert.equal(await markUsed(store, key), true)
  assert.equal(await markUsed(store, key), false)
})

test('releaseUse frees the slot so it can be reserved again', async () => {
  const store = Store.memory() as ChargeStore
  const key = hashKey(84532, '0xdeadbeef')
  assert.equal(await markUsed(store, key), true)
  await releaseUse(store, key)
  assert.equal(await markUsed(store, key), true)
})

test('hashKey/authorizationKey/permit2Key lowercase inputs and include chainId', () => {
  assert.equal(hashKey(1, '0xABCDEF'), 'mpp:evm:charge:hash:1:0xabcdef')
  assert.equal(authorizationKey(1, '0xToKeN', '0xNoNcE'), 'mpp:evm:charge:auth:1:0xtoken:0xnonce')
  assert.equal(permit2Key(1, '0xOwNeR', '123'), 'mpp:evm:charge:permit2:1:0xowner:123')
})
