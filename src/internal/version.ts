import { readFileSync } from 'node:fs'

const pkgPath = new URL('../../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string }

/**
 * @quicknode/mpp package version. Read at module load from package.json.
 * Used in the `x-qn-client` header sent with every default-transport request.
 */
export const VERSION: string = pkg.version
