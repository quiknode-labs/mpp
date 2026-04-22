import { Method, z } from 'mppx'
import { parseUnits } from 'viem'
import { credentialTypes } from './types.js'

/**
 * EVM charge intent for one-time ERC-20 token transfers.
 *
 * Implements IETF draft-evm-charge-00 with three credential types:
 * `permit2` (RECOMMENDED, server-pays-gas), `authorization` (EIP-3009,
 * server-pays-gas), and `hash` (client broadcasts their own tx).
 *
 * @see https://github.com/tempoxyz/mpp-specs/blob/main/specs/methods/evm/draft-evm-charge-00.md
 */
export const charge = Method.from({
  name: 'evm',
  intent: 'charge',
  schema: {
    credential: {
      payload: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('permit2'),
          from: z.address(),
          signature: z.signature(),
          deadline: z.number(),
          nonce: z.string(),
          permitted: z
            .array(z.object({ token: z.address(), amount: z.amount() }))
            .check(z.minLength(1)),
        }),
        z.object({
          type: z.literal('authorization'),
          signature: z.signature(),
          from: z.address(),
          validAfter: z.number(),
          validBefore: z.number(),
          nonce: z.hash(),
        }),
        z.object({
          type: z.literal('hash'),
          txHash: z.hash(),
          chainId: z.number(),
        }),
      ]),
    },
    request: z.pipe(
      z.object({
        amount: z.amount(),
        chainId: z.optional(z.number()),
        credentialTypes: z.optional(z.array(z.enum(credentialTypes)).check(z.minLength(1))),
        currency: z.string(),
        decimals: z.number(),
        description: z.optional(z.string()),
        externalId: z.optional(z.string()),
        permit2Address: z.optional(z.address()),
        permit2Spender: z.optional(z.address()),
        recipient: z.optional(z.address()),
        tokenName: z.optional(z.string()),
        tokenVersion: z.optional(z.string()),
      }),
      z.transform(
        ({
          amount,
          chainId,
          credentialTypes: types,
          decimals,
          permit2Address,
          permit2Spender,
          tokenName,
          tokenVersion,
          ...rest
        }) => ({
          ...rest,
          amount: parseUnits(amount, decimals).toString(),
          methodDetails: {
            decimals,
            ...(chainId !== undefined && { chainId }),
            ...(types !== undefined && { credentialTypes: types }),
            ...(permit2Address !== undefined && { permit2Address }),
            ...(permit2Spender !== undefined && { permit2Spender }),
            ...(tokenName !== undefined && { tokenName }),
            ...(tokenVersion !== undefined && { tokenVersion }),
          },
        }),
      ),
    ),
  },
})
