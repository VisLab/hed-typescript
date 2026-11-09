---
myst:
  html_meta:
    description: 'Issues returned by hed-validator: the Issue, IssueError, and BidsHedIssue classes, levels, and how each HED error code maps to Appendix B of the HED specification'
    keywords: HED, hed-validator, issues, error codes, warnings, Issue, IssueError, BidsHedIssue, Appendix B, HED specification
---

```{index} issues, error codes, Issue, IssueError, BidsHedIssue, Appendix B

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Issues

Every problem the package finds is reported as an issue: an object with a HED error code, a level, and a message.
The codes are those of [Appendix B of the HED specification](https://www.hedtags.org/hed-specification/Appendix_B.html),
which explains what each one means and when it applies. This page describes the objects and lists the codes the
package produces.

## The `Issue` class

The string functions (see [Validating HED strings](validating_strings.md)) return `Issue` objects:

```javascript
const [, errors] = parseStandaloneString('Sensory-event, Blech', schemas)
const issue = errors[0]
console.log(issue instanceof Issue)
console.log(issue.hedCode, issue.internalCode, issue.level)
console.log(issue.parameters)
```

prints

```text
true
TAG_INVALID invalidTag error
{
  tag: 'Blech',
  msg: 'Tag extensions must have a parent in the HED schema.'
}
```

| Property       | Meaning                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `hedCode`      | The HED error code from Appendix B, such as `TAG_INVALID`. Several internal codes share one.   |
| `internalCode` | The validator's own, more specific code, such as `invalidTag`. Use it to tell cases apart.     |
| `level`        | `'error'` or `'warning'`. An error makes the annotation invalid; a warning does not.           |
| `message`      | The full message: level, code, the text with its parameters filled in, and a link to the code. |
| `parameters`   | The values filled into the message, such as the tag, the sidecar key, or the TSV line.         |

`message` is built when it is read, from the template for `internalCode` and from `parameters`. Its last part names
the code's section of Appendix B.

## Exceptions: `IssueError`

Most functions return their issues. A few cannot go on after a problem and throw it instead, as an `IssueError`
whose `issue` property is the `Issue`. The main one is schema loading:

```javascript
try {
  await buildSchemasFromVersion('8.4.0, 8.3.0')
} catch (error) {
  if (error instanceof IssueError) {
    console.log(error.issue.hedCode, error.issue.internalCode)
  } else {
    throw error
  }
}
```

prints

```text
SCHEMA_LOAD_FAILED multipleVersionsOfSameLibrarySchema
```

`BidsDataset.create` catches these and returns them as creation issues, so it does not throw for a bad dataset (see
[Validating BIDS datasets](validating_datasets.md#creation-issues)).

## BIDS issues: `BidsHedIssue`

`BidsSidecar.validate`, `BidsTsvFile.validate`, `BidsDataset.create`, and `BidsDataset.validate` return
`BidsHedIssue` objects, the form the BIDS validator uses. Each wraps an `Issue` (`hedIssue`) and adds the file:
`code` is `HED_ERROR` or `HED_WARNING`, `subCode` is the HED code, `severity` the level, `location` the file path,
and `line` the line of a tabular file. The fields are listed in
[Issues returned](validating_bids_files.md#issues-returned).

`BidsHedIssue` has static helpers for lists of issues:

- `splitErrors(issues)` - a `Map` from level (`'error'`, `'warning'`) to the issues of that level.
- `categorizeByCode(issues)` - a `Map` from HED code to the issues with that code.
- `processIssues(issues, checkWarnings, limitErrors)` - the errors, plus the warnings if `checkWarnings` is true;
  if `limitErrors` is true, only the first issue of each code, with a count of all of them added to its message.

```javascript
const file = new BidsTsvFile(
  'events.tsv',
  { path: 'events.tsv' },
  'onset\tduration\tHED\n0.5\t0\tRed/Blech\n1.5\t0\tBlech\n',
)
const issues = file.validate(schemas)
console.log(issues.map((issue) => `${issue.severity} ${issue.subCode} line ${issue.line}`))
console.log(BidsHedIssue.processIssues(issues).length, BidsHedIssue.processIssues(issues, true).length)
```

prints

```text
[ 'error TAG_INVALID line 3', 'warning TAG_EXTENDED line 2' ]
1 2
```

## Error codes

The table lists every HED code the package can report, with its level and the internal codes that produce it. It is
generated from `src/issues/data.ts`, which holds the 114 issue templates. Each linked code opens its section of
Appendix B. `INTERNAL_ERROR` (a failure inside the validator, or a file it could not read) and `VERSION_DEPRECATED`
have no section there.

| HED code                                                                                                               | Level   | Internal codes                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CHARACTER_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#character-invalid)                       | error   | `invalidCharacter`, `invalidValueCharacter`, `curlyBracesInHedColumn`, `curlyBracesNotAllowed`                                                                                                                                                                                                                                                                                |
| [COMMA_MISSING](https://www.hedtags.org/hed-specification/Appendix_B.html#comma-missing)                               | error   | `commaMissing`                                                                                                                                                                                                                                                                                                                                                                |
| [DEFINITION_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#definition-invalid)                     | error   | `invalidPlaceholderInDefinition`, `invalidDefinition`, `invalidDefinitionManager`, `nestedDefinition`, `invalidDefinitionGroupStructure`, `invalidDefinitionForbidden`, `duplicateDefinition`, `conflictingDefinitions`, `duplicateDefinitionNames`, `multipleTagGroupsInDefinition`, `illegalDefinitionGroupTag`, `illegalDefinitionContext`, `curlyBracesInDefinition`      |
| [DEF_EXPAND_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#def-expand-invalid)                     | error   | `missingDefinitionForDefExpand`, `invalidDefExpandGroupStructure`, `defExpandContentsInvalid`                                                                                                                                                                                                                                                                                 |
| [DEF_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#def-invalid)                                   | error   | `missingDefinitionForDef`                                                                                                                                                                                                                                                                                                                                                     |
| [ELEMENT_DEPRECATED](https://www.hedtags.org/hed-specification/Appendix_B.html#element-deprecated)                     | warning | `deprecatedTag`                                                                                                                                                                                                                                                                                                                                                               |
| INTERNAL_ERROR                                                                                                         | error   | `internalError`, `networkReadError`, `fileReadError`, `genericError`                                                                                                                                                                                                                                                                                                          |
| [PARENTHESES_MISMATCH](https://www.hedtags.org/hed-specification/Appendix_B.html#parentheses-mismatch)                 | error   | `parentheses`, `unopenedParenthesis`, `unclosedParenthesis`                                                                                                                                                                                                                                                                                                                   |
| [PLACEHOLDER_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#placeholder-invalid)                   | error   | `invalidPlaceholderContext`, `invalidSidecarPlaceholder`, `invalidPlaceholder`, `missingPlaceholder`, `extraPlaceholder`                                                                                                                                                                                                                                                      |
| [REQUIRED_TAG_MISSING](https://www.hedtags.org/hed-specification/Appendix_B.html#required-tag-missing)                 | warning | `requiredPrefixMissing`                                                                                                                                                                                                                                                                                                                                                       |
| [SCHEMA_DUPLICATE_NODE](https://www.hedtags.org/hed-specification/Appendix_B.html#schema-duplicate-node)               | error   | `duplicateTagsInSchema`                                                                                                                                                                                                                                                                                                                                                       |
| [SCHEMA_LOAD_FAILED](https://www.hedtags.org/hed-specification/Appendix_B.html#schema-load-failed)                     | error   | `invalidSchemaSpecification`, `missingSchemaSpecification`, `multipleVersionsOfSameLibrarySchema`, `bundledSchemaLoadFailed`, `localSchemaLoadFailed`, `remoteSchemaLoadFailed`, `differentWithStandard`, `lazyPartneredSchemaOverloadsStandardTag`, `lazyPartneredSchemasShareTag`, `lazyPartneredSchemasShareEntry`, `nonPartneredSchemaWithAnotherSchema`, `invalidSchema` |
| [SIDECAR_BRACES_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#sidecar-braces-invalid)             | error   | `unopenedCurlyBrace`, `unclosedCurlyBrace`, `nestedCurlyBrace`, `emptyCurlyBrace`, `recursiveCurlyBraces`, `recursiveCurlyBracesWithKey`, `undefinedCurlyBraces`                                                                                                                                                                                                              |
| [SIDECAR_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#sidecar-invalid)                           | error   | `illegalSidecarHedType`, `illegalSidecarHedKey`, `paddedSidecarKey`, `paddedSidecarCategoricalKey`, `illegalSidecarData`, `illegalSidecarHedCategoricalValue`, `illegalSidecarHedDeepKey`                                                                                                                                                                                     |
| [SIDECAR_KEY_MISSING](https://www.hedtags.org/hed-specification/Appendix_B.html#sidecar-key-missing)                   | warning | `sidecarKeyMissing`, `hedUsedAsSpliceButNoTsvHed`                                                                                                                                                                                                                                                                                                                             |
| [TABULAR_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#tabular-invalid)                           | error   | `duplicateTsvColumn`, `paddedTsvColumn`, `blankTsvColumn`, `paddedTsvValue`                                                                                                                                                                                                                                                                                                   |
| [TAG_EMPTY](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-empty)                                       | error   | `emptyTagFound`                                                                                                                                                                                                                                                                                                                                                               |
| [TAG_EXPRESSION_REPEATED](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-expression-repeated)           | error   | `duplicateTag`                                                                                                                                                                                                                                                                                                                                                                |
| [TAG_EXTENDED](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-extended)                                 | warning | `extendedTag`                                                                                                                                                                                                                                                                                                                                                                 |
| [TAG_EXTENSION_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-extension-invalid)               | error   | `invalidParentNode`, `invalidExtension`                                                                                                                                                                                                                                                                                                                                       |
| [TAG_GROUP_ERROR](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-group-error)                           | error   | `missingTagGroup`, `invalidTagGroup`, `forbiddenSubgroupTags`, `invalidTopLevelTagGroupTag`, `invalidGroupTags`, `invalidGroupTopTags`, `tooManyGroupTopTags`, `multipleTopLevelTagGroupTags`, `invalidNumberOfSubgroups`, `invalidTopLevelTag`, `invalidGroupTag`, `curlyBracesInReservedGroup`                                                                              |
| [TAG_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-invalid)                                   | error   | `invalidTag`, `extraSlash`, `extraBlank`, `extraCommaOrInvalid`, `childForbidden`, `illegalInExclusiveContext`, `invalidTagString`                                                                                                                                                                                                                                            |
| [TAG_NAMESPACE_PREFIX_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-namespace-prefix-invalid) | error   | `invalidTagPrefix`, `unmatchedBaseSchema`, `unmatchedLibrarySchema`                                                                                                                                                                                                                                                                                                           |
| [TAG_NOT_UNIQUE](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-not-unique)                             | error   | `multipleUniqueTags`                                                                                                                                                                                                                                                                                                                                                          |
| [TAG_REQUIRES_CHILD](https://www.hedtags.org/hed-specification/Appendix_B.html#tag-requires-child)                     | error   | `childRequired`, `valueRequired`                                                                                                                                                                                                                                                                                                                                              |
| [TEMPORAL_TAG_ERROR](https://www.hedtags.org/hed-specification/Appendix_B.html#temporal-tag-error)                     | error   | `inactiveOnset`, `temporalWithoutInnerGroup`, `temporalWithWrongNumberDefs`, `temporalWithWrongNumberOfGroups`, `temporalWithoutDefinition`, `extraTagsInTemporal`, `temporalTagInNonTemporalContext`, `temporalTagNoConversion`, `duplicateTemporal`, `multipleTemporalTags`, `multipleRequiresDefTags`, `simultaneousDuplicateEvents`                                       |
| [UNITS_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#units-invalid)                               | error   | `unitClassInvalidUnit`                                                                                                                                                                                                                                                                                                                                                        |
| [VALUE_INVALID](https://www.hedtags.org/hed-specification/Appendix_B.html#value-invalid)                               | error   | `invalidValue`                                                                                                                                                                                                                                                                                                                                                                |
| VERSION_DEPRECATED                                                                                                     | error   | `deprecatedStandardSchemaVersion`                                                                                                                                                                                                                                                                                                                                             |
