---
myst:
  html_meta:
    description: 'Validating a single HED string with hed-validator: loading schemas, parseStandaloneString and parseHedString, definitions, and the issues returned'
    keywords: HED, hed-validator, HED string, validation, parseStandaloneString, parseHedString, DefinitionManager, definitions, issues
---

```{index} HED string; parseStandaloneString; parseHedString; parseHedStrings; DefinitionManager; definitions

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Validating HED strings

A single HED string is the smallest thing the package validates. You load the schemas once, then pass each string
and the schemas to a parsing function, which returns the parsed string and the issues it found.

The examples on this page are CommonJS; the same calls work as an ES module (see
[Installation and versions](installation.md)).

## Loading the schemas

Every validation function takes a schema collection, which `buildSchemasFromVersion` builds from a HED version
string:

```javascript
const { buildSchemasFromVersion, parseStandaloneString } = require('hed-validator')

async function main() {
  const schemas = await buildSchemasFromVersion('8.4.0')
  // validate strings here
}

main()
```

Building the schemas is the slow step, so build them once and reuse the collection for every string. The version
string can name library schemas too; see [Choosing schemas](installation.md#choosing-schemas).

## Validating a standalone string

`parseStandaloneString(hedString, schemas)` validates a string that stands on its own, such as an annotation typed
into a form. It returns an array of three elements: the parsed string, the errors, and the warnings.

```javascript
const [parsed, errors, warnings] = parseStandaloneString('Sensory-event, (Red, Square)', schemas)
console.log(errors.length, warnings.length)
console.log(parsed.format())
console.log(parsed.format(false))
```

prints

```text
0 0
Event/Sensory-event, (Property/Sensory-property/Sensory-attribute/Visual-attribute/Color/CSS-color/Red-color/Red, Item/Object/Geometric-object/2D-shape/Rectangle/Square)
Sensory-event, (Red, Square)
```

`format()` gives the long form of each tag (its full path in the schema) and `format(false)` the short form.

When the string has an error, the parsed string is `null`, and each error is an `Issue` with a HED error code:

```javascript
const [parsed, errors, warnings] = parseStandaloneString('Sensory-event, Blech', schemas)
console.log(parsed)
for (const issue of errors) {
  console.log(issue.hedCode, issue.level)
  console.log(issue.message)
}
```

prints

```text
null
TAG_INVALID error
ERROR: [TAG_INVALID] Invalid tag - "Blech". Tag extensions must have a parent in the HED schema.  (For more information on this HED error, see https://hed-specification.readthedocs.io/en/latest/Appendix_B.html#tag-invalid.)
```

A warning does not stop the string from being parsed. Extending a tag that the schema does not define, as in
`Red/Blech`, gives a parsed string, no errors, and the warning `TAG_EXTENDED`.

Syntax is checked first. A string that cannot be split into tags and groups, such as one with an unmatched
parenthesis, returns only the syntax error (`PARENTHESES_MISMATCH` for `'Sensory-event, Blech, (Red, Square'`); the
tags in it are not checked until the syntax is right.

A standalone string may not contain definitions, `#` placeholders, or curly-brace column splices, since those only
make sense inside a BIDS sidecar.

## Strings from other contexts

`parseHedString` is the general form. It takes three switches after the schemas:

```javascript
parseHedString(hedString, schemas, definitionsAllowed, placeholdersAllowed, fullValidation)
```

- `definitionsAllowed` - whether `Definition` groups may appear.
- `placeholdersAllowed` - whether `#` placeholders may appear.
- `fullValidation` - whether the string is complete. Pass `false` for a piece that is later joined to others, as a
  sidecar value is joined into a row of a tabular file; then a tag that must be in a top-level group, such as
  `Onset`, is not yet required to be in one.

For example, a definition with a placeholder is an error as a standalone string, and valid where definitions and
placeholders are allowed, as in the `definitions` entry of a sidecar:

```javascript
const definition = '(Definition/Rate/#, (Frequency/# Hz))'
const [, standaloneErrors] = parseStandaloneString(definition, schemas)
console.log(standaloneErrors.map((issue) => issue.hedCode))
const [parsed, errors] = parseHedString(definition, schemas, true, true, true)
console.log(errors.length, parsed.definitions.length)
```

prints

```text
[ 'PLACEHOLDER_INVALID' ]
0 1
```

`parseHedStrings` takes an array of strings and the same switches, and returns an array of parsed strings (or `null`
if any of them failed) with the errors and warnings of all of them.

## Definitions

A `Def/Name` tag refers to a definition that is made somewhere else, usually in a sidecar. To check `Def` tags in a
standalone string, give `parseStandaloneString` a `DefinitionManager` that holds the definitions:

```javascript
const { DefinitionManager } = require('hed-validator')

const [definitions, definitionIssues] = DefinitionManager.createDefinitions(
  ['(Definition/Fixation, (Visual-presentation, Cross))', '(Definition/Rate/#, (Frequency/# Hz))'],
  schemas,
)
const manager = new DefinitionManager()
const addIssues = manager.addDefinitions(definitions)
console.log(definitionIssues.length, addIssues.length)

for (const hedString of ['Sensory-event, Def/Fixation', 'Def/Rate/3', 'Def/Missing']) {
  const [, errors] = parseStandaloneString(hedString, schemas, manager)
  console.log(
    hedString,
    errors.map((issue) => issue.hedCode),
  )
}
```

prints

```text
0 0
Sensory-event, Def/Fixation []
Def/Rate/3 []
Def/Missing [ 'DEF_INVALID' ]
```

- `DefinitionManager.createDefinitions(strings, schemas)` parses each definition string and returns the
  definitions it could make, with the issues of the ones it could not.
- `addDefinitions` returns issues too: adding a second definition with a name already in the manager is a
  `DEFINITION_INVALID` error.
- A definition with a placeholder (`Rate/#`) must be used with a value (`Def/Rate/3`), and one without a placeholder
  without a value.
- Without a manager, `Def` tags are checked only against the schema, not against any definition.

## What comes back

Every parsing function returns `[parsed, errors, warnings]`:

| Element    | Type                           | Meaning                                             |
| ---------- | ------------------------------ | --------------------------------------------------- |
| `parsed`   | A parsed HED string, or `null` | `null` when there is an error; otherwise the string |
| `errors`   | `Issue[]`                      | Problems that make the string invalid               |
| `warnings` | `Issue[]`                      | Problems that do not, such as an extended tag       |

An `Issue` carries the HED error code (`hedCode`), the level (`error` or `warning`), and a message that ends with a
link to the code in the HED specification. See [Issues](issues.md) for the codes.

To validate the HED in BIDS sidecars and tabular files, where the strings are assembled from several columns, see
[Validating BIDS files](validating_bids_files.md).
