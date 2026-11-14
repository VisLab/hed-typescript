---
myst:
  html_meta:
    description: 'Validating BIDS sidecars and tabular files with hed-validator: BidsSidecar, BidsTsvFile, curly-brace splices, value columns, and column-name checks'
    keywords: HED, hed-validator, BIDS, sidecar, events.tsv, tabular file, BidsSidecar, BidsTsvFile, curly braces, value columns
---

```{index} BIDS sidecar, tabular file, BidsSidecar, BidsTsvFile, curly braces, value columns, column names

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Validating BIDS files

In a BIDS dataset, HED annotations live in two kinds of files: JSON sidecars, which annotate the values of columns,
and tabular (TSV) files such as `events.tsv`, whose rows the sidecar annotations apply to. The package validates
each kind with its own class, `BidsSidecar` and `BidsTsvFile`. To validate all the files of a dataset at once, see
[Validating BIDS datasets](validating_datasets.md).

All examples on this page use schemas loaded once, as in [Validating HED strings](validating_strings.md):

```javascript
const { buildSchemasFromVersion, BidsSidecar, BidsTsvFile, DefinitionManager } = require('hed-validator')

async function main() {
  const schemas = await buildSchemasFromVersion('8.4.0')
  // the examples below go here
}

main()
```

## Sidecars

A `BidsSidecar` is built from the parsed JSON of a sidecar, with a name and a file object whose `path` appears in
the issues:

```javascript
const sidecarData = {
  trial_type: {
    HED: {
      go: 'Sensory-event, Visual-presentation, (Green, Square)',
      stop: 'Sensory-event, Visual-presentation, (Red, Square), {response}',
    },
  },
  response: {
    HED: {
      left: 'Agent-action, (Press, (Left-side-of, Push-button))',
      right: 'Agent-action, (Press, (Right-side-of, Push-button))',
    },
  },
  rate: { HED: 'Frequency/# Hz' },
  definitions: { HED: { fixation: '(Definition/Fixation, (Visual-presentation, Cross))' } },
}

const sidecar = new BidsSidecar('task-stop_events.json', { path: 'task-stop_events.json' }, sidecarData)
const sidecarIssues = sidecar.validate(schemas)
console.log(sidecarIssues.length)
```

prints `0`. `validate` returns an array of `BidsHedIssue` objects (see [Issues returned](#issues-returned)).

The sidecar shows the three kinds of HED entries:

- **Categorical columns** (`trial_type`, `response`): `HED` is an object with one annotation per column value.
- **Value columns** (`rate`): `HED` is a single string with exactly one `#` placeholder, which the value in each row
  replaces. Each value must fit the value class of the tag; here `Frequency` takes a number.
- **Definitions**: an entry whose annotations are `Definition` groups. Its column name does not matter; the
  definitions are available to every annotation in the sidecar and in the tabular files that use it.

Validating a sidecar checks every annotation in it, with definitions and placeholders allowed where they belong.

## Curly-brace splices

An annotation can contain the name of another column in curly braces, `{response}` above. When the rows are
assembled, the annotation of that column in the same row replaces the braces, so the two annotations are grouped
together. If the column's value in a row is `n/a`, the splice is dropped.

The sidecar checks the splices. A splice must name a column that the sidecar annotates, and a value column must have
its placeholder:

```javascript
const badSidecar = new BidsSidecar(
  'bad.json',
  { path: 'bad.json' },
  {
    trial_type: { HED: { go: 'Sensory-event, {duration}', stop: 'Sensory-event' } },
    rate: { HED: 'Frequency' },
  },
)
console.log(badSidecar.validate(schemas).map((issue) => issue.subCode))
```

prints

```text
[ 'PLACEHOLDER_INVALID', 'SIDECAR_BRACES_INVALID' ]
```

`{duration}` is invalid because the sidecar has no HED for `duration`, and `rate` is a value column without `#`.

## Tabular files

A `BidsTsvFile` takes the text of the file and the sidecar that applies to it, as a plain object. For a file that
inherits from several sidecars, pass their merged contents.

```javascript
const tsvText =
  'onset\tduration\ttrial_type\tresponse\trate\tHED\n' +
  '0.5\t0\tgo\tn/a\t3\tDef/Fixation\n' +
  '1.5\t0\tstop\tleft\t4\tn/a\n'

const tsvFile = new BidsTsvFile(
  'sub-01_task-stop_events.tsv',
  { path: 'sub-01/sub-01_task-stop_events.tsv' },
  tsvText,
  sidecarData,
)
const tsvIssues = tsvFile.validate(schemas)
console.log(tsvIssues.length)
```

prints `0`. For each row, the annotations of the sidecar columns and the row's own `HED` column are assembled into
one string and validated. Here the second row assembles to the `stop` annotation with the `left` annotation spliced
in at `{response}`, plus `Frequency/4 Hz`. A `HED` column value of `n/a` adds nothing.

Validating the tabular file also validates its sidecar, so an error in the sidecar is reported for the tabular file
too. Rows are checked one at a time and then together: the temporal tags (`Onset`, `Offset`, `Inset`) must match up
across rows, and rows with the same onset must not repeat a tag between them.

A tabular file with no HED column and no sidecar annotation has nothing to check, and `validate` returns `[]`. A
file whose first non-empty line has a cell `HED` (once trimmed) counts as having a HED column even when an empty or
malformed first line hides it, so that line is reported.

### Values in value columns

A value that does not fit the placeholder's tag is reported with the line of the file:

```javascript
const badFile = new BidsTsvFile('rate.tsv', { path: 'rate.tsv' }, 'onset\tduration\trate\n0.5\t0\tfast\n', {
  rate: { HED: 'Frequency/# Hz' },
})
for (const issue of badFile.validate(schemas)) {
  console.log(issue.code, issue.subCode, issue.severity, issue.location, issue.line)
  console.log(issue.issueMessage)
}
```

prints

```text
HED_ERROR VALUE_INVALID error rate.tsv 2
ERROR: [VALUE_INVALID] Invalid placeholder value for tag "Frequency/fast Hz". Tag "Frequency" has value classes [numericClass] but its value "fast" is not in any of them. TSV line: "2". (For more information on this HED error, see https://hed-specification.readthedocs.io/en/latest/Appendix_B.html#value-invalid.)
```

The line counts the header as line 1.

### Column names

Before any row is assembled, the column names of the header are checked. A name with leading or trailing whitespace,
a blank name, or a name that appears twice makes the rows ambiguous, so it is a `TABULAR_INVALID` error and the
rows are not checked further:

```javascript
const headerFile = new BidsTsvFile(
  'events.tsv',
  { path: 'events.tsv' },
  'onset\ttrial_type \tduration\tduration\tHED\n1.0\tgo\t0\t0\tRed\n',
)
for (const issue of headerFile.validate(schemas)) {
  console.log(issue.subCode, issue.hedIssue.internalCode)
}
```

prints

```text
TABULAR_INVALID paddedTsvColumn
TABULAR_INVALID duplicateTsvColumn
```

The first line is always the header: an empty first line is one blank column name. After the header, every line must
have as many tab-separated cells as the first line (`tsvCellCount`) and must not be empty (`emptyTsvLine`); one line
break at the end of the file is not an empty line, but two are. A line of tabs only, with the right number of cells,
is a row of missing values. Each offending line is reported with its line number, and the rows are not checked
further.

The package also exports `parseTSV`, which splits TSV text into columns, and `findDuplicateHeaders`, which lists the
repeated column names of TSV text, for callers that want to inspect a file before validating it.

## Definitions from elsewhere

The definitions in a file's own sidecar are found automatically. Definitions kept somewhere else go in a
`DefinitionManager` (see [Definitions](validating_strings.md#definitions)), passed as the last argument of either
constructor:

```javascript
const [definitions] = DefinitionManager.createDefinitions(
  ['(Definition/Fixation, (Visual-presentation, Cross))'],
  schemas,
)
const manager = new DefinitionManager()
manager.addDefinitions(definitions)
const file = new BidsTsvFile(
  'events.tsv',
  { path: 'events.tsv' },
  'onset\tduration\tHED\n0.5\t0\tDef/Fixation\n',
  {},
  manager,
)
console.log(file.validate(schemas).length)
```

prints `0`. Without the manager, the same file gives `DEF_INVALID`, since `Fixation` is not defined.

## Issues returned

`validate` returns `BidsHedIssue` objects, the form the BIDS validator uses. Each wraps a HED `Issue`:

| Field          | Example                      | Meaning                                              |
| -------------- | ---------------------------- | ---------------------------------------------------- |
| `code`         | `HED_ERROR`                  | `HED_ERROR` or `HED_WARNING`, for the BIDS validator |
| `subCode`      | `VALUE_INVALID`              | The HED error code                                   |
| `severity`     | `error`                      | `error` or `warning`                                 |
| `location`     | `rate.tsv`                   | The `path` of the file object                        |
| `line`         | `2`                          | The line of a tabular file, when the issue has one   |
| `issueMessage` | `ERROR: [VALUE_INVALID] ...` | The full message                                     |
| `hedIssue`     | an `Issue`                   | The underlying issue, with its `internalCode`        |

`BidsHedIssue.splitErrors` splits a list by severity, and `BidsHedIssue.processIssues` keeps the errors (and, if
asked, the warnings). See [Issues](issues.md).
