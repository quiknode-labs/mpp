import type { Store } from 'mppx'
import type { ChargeReplayItemMap } from '../types.js'

export type ChargeStore = Store.AtomicStore<ChargeReplayItemMap>

/**
 * Atomically reserves a replay slot. Returns `true` if the slot was free and
 * is now marked used; `false` if already consumed.
 */
export async function markUsed(store: ChargeStore, key: `mpp:evm:charge:${string}`) {
  return store.update(key, (current) => {
    if (current !== null) return { op: 'noop', result: false }
    return { op: 'set', value: Date.now(), result: true }
  })
}

/** Releases a reservation previously made by `markUsed` (e.g. on verify failure). */
export async function releaseUse(store: ChargeStore, key: `mpp:evm:charge:${string}`) {
  await store.delete(key)
}

export function hashKey(chainId: number, txHash: string): `mpp:evm:charge:${string}` {
  return `mpp:evm:charge:hash:${chainId}:${txHash.toLowerCase()}`
}

export function authorizationKey(
  chainId: number,
  token: string,
  nonce: string,
): `mpp:evm:charge:${string}` {
  return `mpp:evm:charge:auth:${chainId}:${token.toLowerCase()}:${nonce.toLowerCase()}`
}

export function permit2Key(
  chainId: number,
  owner: string,
  nonce: string,
): `mpp:evm:charge:${string}` {
  return `mpp:evm:charge:permit2:${chainId}:${owner.toLowerCase()}:${nonce}`
}
