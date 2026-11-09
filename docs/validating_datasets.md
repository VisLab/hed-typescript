---
myst:
  html_meta:
    description: 'Validating a whole BIDS dataset with hed-validator: BidsDataset.create, the directory, web, and custom file accessors, HEDVersion, and creation versus validation issues'
    keywords: HED, hed-validator, BIDS dataset, BidsDataset, BidsDirectoryAccessor, BidsWebAccessor, BidsFileAccessor, HEDVersion, dataset_description.json
---

```{index} BIDS dataset, BidsDataset, BidsDirectoryAccessor, BidsWebAccessor, BidsFileAccessor, HEDVersion, buildBidsSchemas

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Validating BIDS datasets

`BidsDataset` validates the HED in a whole BIDS dataset: it reads the schema versions from `dataset_description.json`,
finds the JSON sidecars and the tabular files, merges the sidecars that apply to each tabular file, and validates
everything. How it reads the files is up to a file accessor, so the same code works on a directory in Node.js, on
files picked in a browser, or on files kept anywhere else.

## Validating a directory

In Node.js, `BidsDirectoryAccessor` reads the dataset from a directory:

```javascript
const path = require('node:path')
const { BidsDataset, BidsDirectoryAccessor, BidsHedIssue } = require('hed-validator')

async function main() {
  const dataRoot = path.resolve('tests/bidsDemoData')
  const [dataset, creationIssues] = await BidsDataset.create(dataRoot, BidsDirectoryAccessor)
  if (dataset === null) {
    console.log(creationIssues.map((issue) => issue.issueMessage))
  } else {
    const issues = await dataset.validate()
    const byLevel = BidsHedIssue.splitErrors(issues)
    console.log(`${dataset.sidecarMap.size} sidecars`)
    console.log(`${byLevel.get('error')?.length ?? 0} errors, ${byLevel.get('warning')?.length ?? 0} warnings`)
  }
}

main()
```

Run from the root of the hed-typescript repository, on its sample dataset
[`tests/bidsDemoData`](https://github.com/hed-standard/hed-typescript/tree/main/tests/bidsDemoData), this prints

```text
9 sidecars
0 errors, 0 warnings
```

The later examples on this page also run inside an `async` function such as `main`.

Validation is done in two steps, and each has its own issues:

1. **`BidsDataset.create(root, accessorClass)`** reads the files, loads the schemas named by `HEDVersion`, and parses
   the sidecars. It returns `[dataset, creationIssues]`. If anything goes wrong at this step, `dataset` is `null` and
   the issues say why; nothing has been validated yet.
2. **`dataset.validate()`** validates the sidecars, and then, if no sidecar has an error, the tabular files with their
   merged sidecars. It returns a promise of the validation issues.

Both steps return `BidsHedIssue` objects (see [Issues returned](validating_bids_files.md#issues-returned)).

`BidsDirectoryAccessor` needs the Node.js file system, so it works only in the CommonJS build; see
[Installation and versions](installation.md#importing).

## Choosing the schemas

The schemas come from the `HEDVersion` field of `dataset_description.json`. A single schema is a string; several are
an array:

```json
{
  "Name": "Demo",
  "BIDSVersion": "1.10.0",
  "HEDVersion": ["8.4.0", "sc:score_2.0.0"]
}
```

Each entry has the form described in [Choosing schemas](installation.md#choosing-schemas). Unlike
`buildSchemasFromVersion`, `HEDVersion` does not take a comma-separated string: `"8.4.0, sc:score_2.0.0"` is a
`SCHEMA_LOAD_FAILED` creation issue.

`buildBidsSchemas` loads the schemas of a dataset description without creating a dataset. It takes a `BidsJsonFile`
and returns a promise of the schemas, or of `null` if there is no `HEDVersion`:

```javascript
const { BidsJsonFile, buildBidsSchemas } = require('hed-validator')

const description = new BidsJsonFile(
  'dataset_description.json',
  { path: 'dataset_description.json' },
  { HEDVersion: ['8.4.0', 'sc:score_2.0.0'] },
)
const schemas = await buildBidsSchemas(description)
```

The result can be passed to `BidsSidecar.validate` and `BidsTsvFile.validate` (see
[Validating BIDS files](validating_bids_files.md)).

## Creation issues

`BidsDataset.create` returns `null` and a `SCHEMA_LOAD_FAILED` issue when the schemas cannot be loaded. The
`internalCode` of the underlying issue tells the cases apart:

| Dataset                                          | `subCode`            | `hedIssue.internalCode`      |
| ------------------------------------------------ | -------------------- | ---------------------------- |
| No `dataset_description.json`                    | `SCHEMA_LOAD_FAILED` | `missingSchemaSpecification` |
| A description without `HEDVersion`               | `SCHEMA_LOAD_FAILED` | `invalidSchemaSpecification` |
| A `HEDVersion` that is not a version (`"x.y.z"`) | `SCHEMA_LOAD_FAILED` | `invalidSchemaSpecification` |
| A sidecar with `"HED":` that is not valid JSON   | `INTERNAL_ERROR`     | `fileReadError`              |

The `location` of the last one is the path of the sidecar.

## Files from elsewhere

`BidsDataset.create` takes the accessor class, not an instance, and calls its static `create` with the first
argument. Three accessors are available:

| Accessor                | First argument of `BidsDataset.create` | Where                                                                             |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| `BidsDirectoryAccessor` | The path of the dataset's root         | Node.js (CommonJS build)                                                          |
| `BidsWebAccessor`       | A `FileList` or an array of `File`     | Browsers; see [the browser page](browser.md#validating-files-that-the-user-picks) |
| A `BidsFileAccessor`    | Anything your subclass accepts         | Anywhere                                                                          |

`BidsFileAccessor` is the base class of the other two. A subclass needs a static `create` that builds the accessor
from a map of relative paths to file handles, and a `getFileContent` that returns a promise of a file's text (or of
`null` if it cannot be read). The third argument of the constructor builds the schemas; pass `buildBidsSchemas`.

This accessor holds a dataset in memory, as a map from relative path to file contents:

```javascript
const { BidsDataset, BidsFileAccessor, buildBidsSchemas } = require('hed-validator')

class MemoryAccessor extends BidsFileAccessor {
  static async create(files) {
    return new MemoryAccessor('', new Map(Object.entries(files)), buildBidsSchemas)
  }

  async getFileContent(relativePath) {
    return this.fileMap.get(relativePath) ?? null
  }
}

const files = {
  'dataset_description.json': '{"Name": "Demo", "BIDSVersion": "1.10.0", "HEDVersion": "8.4.0"}',
  'task-go_events.json': '{"trial_type": {"HED": {"go": "Sensory-event, Blech"}}}',
  'sub-01/sub-01_task-go_events.tsv': 'onset\tduration\ttrial_type\n0.5\t0\tgo\n',
}
const [dataset, creationIssues] = await BidsDataset.create(files, MemoryAccessor)
const issues = await dataset.validate()
console.log(creationIssues.length)
console.log(issues.map((issue) => `${issue.subCode} in ${issue.location}`))
```

prints

```text
0
[ 'TAG_INVALID in task-go_events.json' ]
```

The dataset is created, since its schemas load and its sidecar is valid JSON; validating it finds the invalid tag
in the sidecar. Because the sidecar has an error, the tabular file is not validated.

An accessor keeps only the files that HED validation needs: `dataset_description.json`, and the JSON and TSV files
named like `participants`, `samples`, `*_events`, `*_beh`, `*_scans`, and `*_sessions`, plus those under
`phenotype/` and `stimuli/`. Other files in the map are ignored.
