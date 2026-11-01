import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from '@jest/globals'

// Checks of the published ESM (browser) build. They need dist/, which "npm run build" writes (npm ci and npm install
// run it through the "prepare" script); without it they are skipped.
const esmIndex = path.join(__dirname, '..', '..', 'dist', 'esm', 'index.js')
const describeBuild = fs.existsSync(esmIndex) ? describe : describe.skip

describeBuild('ESM build', () => {
  const esmCode = fs.existsSync(esmIndex) ? fs.readFileSync(esmIndex, 'utf8') : ''

  it('imports no Node.js module', () => {
    expect(esmCode).not.toMatch(/(?:from|import|require)\s*\(?\s*["'](?:node:)?(?:fs|fs\/promises|path)["']/)
    expect(esmCode).not.toContain('node:')
  })

  it('uses the browser schema loader and the browser directory accessor', () => {
    expect(esmCode).toContain('Local file reading is not supported in browser environment')
    expect(esmCode).toContain('it needs Node.js file system access')
  })
})
