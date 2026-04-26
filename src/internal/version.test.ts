import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { version } from './version.js'

// Note: this test is allowed to read package.json from disk because it runs
// in Node, not the SDK's edge-runtime targets. It guards against a stale
// generated `version.ts` produced by `genversion`.
test('version matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'))
  assert.equal(version, pkg.version)
})

test('version is a semver-looking string', () => {
  assert.match(version, /^\d+\.\d+\.\d+/)
})
