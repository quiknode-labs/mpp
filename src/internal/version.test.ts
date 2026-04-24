import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { VERSION } from './version.js'

test('VERSION matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'))
  assert.equal(VERSION, pkg.version)
})

test('VERSION is a semver-looking string', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+/)
})
