---
myst:
  html_meta:
    description: 'Installing the hed-validator npm package, importing it as CommonJS or ESM, and the HED schema versions it bundles'
    keywords: HED, hed-validator, npm install, CommonJS, ESM, Node.js, schema versions, bundled schemas, getLocalSchemaVersions
---

```{index} installation, npm, CommonJS, ESM, schema versions, bundled schemas

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Installation and versions

## Installing

Install the package from npm:

```shell
npm install hed-validator
```

The package needs Node.js 22 or later (the `engines` field of its `package.json`). It has no native dependencies.

## Importing

The package ships two builds, and the `exports` field of its `package.json` picks one for you:

| You write             | Node.js resolves to | Built for                                                             |
| --------------------- | ------------------- | --------------------------------------------------------------------- |
| `require(...)`        | `dist/commonjs/`    | Node.js                                                               |
| `import ... from ...` | `dist/esm/index.js` | Browser bundlers (see [Using the package in the browser](browser.md)) |

In CommonJS:

```javascript
const { buildSchemasFromVersion, parseStandaloneString } = require('hed-validator')
```

As an ES module:

```javascript
import { buildSchemasFromVersion, parseStandaloneString } from 'hed-validator'
```

:::{important}
The ES module build is the browser build. Its `BidsDirectoryAccessor` cannot read a directory: in Node.js,
`BidsDirectoryAccessor.create` throws an `IssueError` with the code `INTERNAL_ERROR` and the message "it needs Node.js
file system access, which this build does not have". To validate a BIDS dataset from a directory in Node.js, load
the package with `require`. Everything else works the same in both builds.
:::

The names that the package exports are listed in the [API reference](https://www.hedtags.org/hed-typescript/api/).

## Package version and schema versions

The version of the package (for example 4.1.4) and the versions of the HED schemas it validates against are
independent. Each release of the package bundles a set of schema XML files, so those schemas load without a
network connection, in Node.js and in browsers. `getLocalSchemaVersions` lists them:

```javascript
const { getLocalSchemaVersions } = require('hed-validator')

console.log(getLocalSchemaVersions())
```

For this release it prints:

```text
[
  '8.0.0',       '8.1.0',
  '8.2.0',       '8.3.0',
  '8.4.0',       '8.5.0',
  'lang_1.0.0',  'lang_1.1.0',
  'lang_1.2.0',  'mouse_1.0.0',
  'score_1.2.0', 'score_2.0.0',
  'score_2.1.0', 'score_2.2.0'
]
```

Standard schemas appear as their version number, library schemas as `<library>_<version>`.

## Choosing schemas

`buildSchemasFromVersion` takes a HED version string and returns a promise of the schemas to validate against:

```javascript
const { buildSchemasFromVersion } = require('hed-validator')

async function main() {
  const schemas = await buildSchemasFromVersion('8.4.0, sc:score_2.0.0')
  // pass schemas to the validation functions
}

main()
```

The string is a comma-separated list of schemas:

- `8.4.0` - a standard schema.
- `score_2.0.0` - a library schema. A partnered library carries its standard schema with it.
- `sc:score_2.0.0` - a library schema under the prefix `sc`, so its tags are written `sc:Tag-name` in the
  annotations. Schemas without a prefix are merged; each prefix may name one group of schemas.

In the `HEDVersion` field of a BIDS `dataset_description.json`, several schemas are written as an array
(`["8.4.0", "sc:score_2.0.0"]`), not as one comma-separated string; see
[Validating BIDS datasets](validating_datasets.md#choosing-the-schemas).

A string that breaks these rules makes `buildSchemasFromVersion` reject with an `IssueError` whose code is
`SCHEMA_LOAD_FAILED`. For example, `'8.4.0, 8.3.0'` lists the standard schema twice under the same prefix.

## Schemas that are not bundled

A version that is not in `getLocalSchemaVersions()` is downloaded from the `main` branch of the
[hed-schemas](https://github.com/hed-standard/hed-schemas) repository on GitHub (for example `score_1.1.0`). This
needs a network connection; if the download fails, the promise rejects with an `IssueError` whose code is
`SCHEMA_LOAD_FAILED`. To validate offline, use a bundled version. The released schemas and their status are listed
in the [HED schemas documentation](https://www.hedtags.org/hed-schemas/).
