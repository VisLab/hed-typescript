import path from 'node:path'
import esbuild from 'esbuild'

// Node.js target build
await esbuild.build({
  entryPoints: [path.join(process.cwd(), 'src', 'index.js')],
  loader: { '.xml': 'text' },
  outdir: path.join(process.cwd(), 'dist', 'commonjs'),
  target: 'node18',
  bundle: true,
  sourcemap: true,
  platform: 'node',
  define: {
    'import.meta.env': 'undefined',
  },
})

// Browser target build, consumed by Vite/Webpack browser bundlers.
// The "browser" field in package.json redirects the two Node-only modules (src/schema/loader.ts and
// src/bids/accessors/directory.ts) to their browser versions; esbuild honours that field when platform is 'browser'.
// No Node.js module is bundled, so none is polyfilled.
await esbuild.build({
  entryPoints: [path.join(process.cwd(), 'src', 'index.js')],
  loader: { '.xml': 'text' },
  outdir: path.join(process.cwd(), 'dist', 'esm'),
  bundle: true,
  sourcemap: true,
  format: 'esm',
  external: ['pluralize'],
  platform: 'browser',
})
