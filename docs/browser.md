---
myst:
  html_meta:
    description: 'Using hed-validator in a web page: the browser build, bundled schemas, and validating files the user picks with BidsWebAccessor'
    keywords: HED, hed-validator, browser, bundler, Vite, webpack, ESM, BidsWebAccessor, hed-web
---

```{index} browser; bundler; BidsWebAccessor; hed-web

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Using the package in the browser

`hed-validator` runs in a web page through a bundler such as Vite or webpack. All validation happens in the page:
no file is uploaded to a server.

## The browser build

The package is built twice (`npm run build`, configured in `esbuild.mjs`):

- `dist/commonjs/` for Node.js, which `require('hed-validator')` loads.
- `dist/esm/` for browsers, which `import ... from 'hed-validator'` loads. Bundlers pick it through the `import`
  condition of the `exports` field in `package.json`.

Two modules of the source need the Node.js file system. The `browser` field of `package.json` names a browser
replacement for each, and the build of `dist/esm/` uses the replacements:

| Node.js module                    | Browser replacement                       | What changes in the browser                                                 |
| --------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| `src/schema/loader.ts`            | `src/schema/browserLoader.ts`             | Schemas are never read from a local file; they come bundled or from GitHub. |
| `src/bids/accessors/directory.ts` | `src/bids/accessors/directory.browser.ts` | `BidsDirectoryAccessor.create` throws; use `BidsWebAccessor` instead.       |

The same field maps `fs` to `false`, so a bundler never tries to include it. As a result, `dist/esm/` imports no
Node.js built-in module, and needs no polyfills. Its only import of another package is `pluralize`, which npm
installs as a dependency.

The exported names are the same in both builds, so code written against the package compiles for either.

## Schemas in the browser

The bundled schemas (see [Installation and versions](installation.md)) are in the ES module build too, each in its
own file under `dist/esm/schemas/`. `buildSchemasFromVersion` loads a schema file only when it is first used, so a
page that validates against HED 8.4.0 does not download the other versions: `dist/esm/index.js` loads each one with a
dynamic `import()`.

A version that is not bundled is fetched from GitHub (`raw.githubusercontent.com`), exactly as in Node.js. The page
then needs network access to that site.

## Validating files that the user picks

In a browser, a dataset is the set of `File` objects that the user picks with a folder input:

```html
<input type="file" id="dataset" webkitdirectory />
```

`BidsWebAccessor` reads those files with the browser `File` API. Pass the file list and the accessor class to
`BidsDataset.create`:

```javascript
import { BidsDataset, BidsHedIssue, BidsWebAccessor } from 'hed-validator'

async function validateDataset(files) {
  const [dataset, creationIssues] = await BidsDataset.create(files, BidsWebAccessor)
  if (dataset === null) {
    return BidsHedIssue.processIssues(creationIssues)
  }
  const issues = await dataset.validate()
  return BidsHedIssue.processIssues(issues)
}

const input = document.getElementById('dataset')
input.addEventListener('change', async () => {
  const errors = await validateDataset(input.files)
  console.log(`${errors.length} errors`)
})
```

`BidsWebAccessor` finds the root of the dataset from the `webkitRelativePath` of the files: it is the directory of
the shallowest file named `dataset_description.json`. The `HEDVersion` in that file selects the schemas.
`BidsHedIssue.processIssues` keeps the errors; pass `true` as its second argument to keep the warnings too.

To validate a single string, sidecar, or tabular file in a page, call the same functions as in Node.js; they need no
file access.

## A worked example: hed-web

[hed-web](https://github.com/hed-standard/hed-web) is the browser application behind the
[HED browser tools](https://www.hedtags.org/hed-web/), and it is the reference for using this package in a page.
It is a React application built with Vite, with one page for each kind of input:

- **String**: the user types a HED string and picks schema versions; the page calls `buildSchemasFromVersion` and
  then `parseStandaloneString`.
- **Sidecar** and **tabular file**: the user picks the files with an ordinary file input; the page builds a
  `BidsSidecar` (and a `BidsTsvFile`) from their text and calls `validate` with the chosen schemas.
- **Dataset**: the user picks a folder with a `webkitdirectory` input; the page passes the files to
  `BidsDataset.create` with `BidsWebAccessor`, shows the creation issues, and then calls `validate()`.

hed-web uses the ES module build through Vite. It installs `hed-validator` from a fixed commit, not from a version
range; today that commit is from hed-javascript, which has the same API (see
[hed-javascript and hed-typescript](hed_javascript_and_hed_typescript.md)). Its source shows how to turn the issues
into a list for display and for download.
