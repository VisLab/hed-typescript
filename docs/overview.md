---
myst:
  html_meta:
    description: 'Overview of the hed-validator npm package: what it validates (HED strings, BIDS sidecars, tabular files, and datasets) in Node.js and browsers'
    keywords: HED, hed-validator, hed-typescript, validation, BIDS, Node.js, browser, hed-web, hedtools
---

```{index} overview; hed-validator; validation levels; related tools

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Overview

hed-typescript is the source of the [`hed-validator`](https://www.npmjs.com/package/hed-validator) npm package. The
package checks HED (Hierarchical Event Descriptors) annotations against a HED schema and reports what is wrong with
them. This site assumes that you already know what HED is; if you do not, start at [www.hedtags.org](https://www.hedtags.org/).

## What the package validates

The package validates HED at four levels, from the smallest unit to the largest:

| Level                | What you give it                                  | Main entry points                                       |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| A HED string         | One annotation string and the schemas             | `buildSchemasFromVersion`, `parseStandaloneString`      |
| A BIDS sidecar       | The parsed contents of a JSON sidecar             | `BidsSidecar`                                           |
| A BIDS tabular file  | The text of a TSV file and its merged sidecar     | `BidsTsvFile`                                           |
| A whole BIDS dataset | A directory, or the files of one picked by a user | `BidsDataset.create` with a file accessor, `validate()` |

Each level has its own guide: [Validating HED strings](validating_strings.md),
[Validating BIDS files](validating_bids_files.md), and [Validating BIDS datasets](validating_datasets.md). Each level
builds on the one before it. Validating a sidecar validates every HED string in it, and validating a
dataset validates each sidecar and each tabular file. Definitions, curly-brace splices, value columns, and the
temporal tags (`Onset`, `Offset`, `Inset`, `Duration`, `Delay`) are checked at the levels where they become
visible.

Every problem found comes back as an issue object with a HED error code, such as `TAG_INVALID` or
`SIDECAR_BRACES_INVALID`. The codes are those of the
[HED specification](https://www.hedtags.org/hed-specification/), so the same problem has the same code here and in
the Python tools.

## Node.js and browsers

The same package runs in two environments:

- **Node.js** (version 22 or later): the package can read a BIDS dataset straight from a directory.
- **Browsers**, through a bundler such as Vite or webpack: the package reads the files that a user picks in the
  page, and never touches the local file system.

The schemas that the package bundles are available offline in both. See [Installation and versions](installation.md)
and [Using the package in the browser](browser.md).

## Related tools

- **The BIDS validator.** The current focus of `hed-validator` is full validation of HED in
  [BIDS datasets](https://bids-specification.readthedocs.io/en/stable/) under the BIDS validator 2.0, which calls
  this package for its HED checks. Its use of the package is in
  [`hed.ts`](https://github.com/bids-standard/bids-validator/blob/43be01517aaf338aa8bf87676be192dd57087c50/src/validators/hed.ts).
- **hed-web.** The [HED browser tools](https://www.hedtags.org/hed-web/) validate a HED string, a sidecar, a tabular
  file, or a whole dataset in the browser with this package. The files stay on the user's computer.
- **hed-python.** The Python [hedtools](https://pypi.org/project/hedtools/) package validates HED too, and adds
  search, summaries, and remodeling. It runs behind the [HED online tools](https://hedtools.org/hed/). Both
  validators run the [hed-tests](https://github.com/hed-standard/hed-tests) conformance suite.
- **hed-javascript.** The JavaScript implementation of the same validator; see
  [hed-javascript and hed-typescript](hed_javascript_and_hed_typescript.md).

## Where HED itself is documented

- [www.hedtags.org](https://www.hedtags.org/) - the HED project home page.
- [HED specification](https://www.hedtags.org/hed-specification/) - the rules that this validator implements,
  including the error codes in its Appendix B.
- [HED resources](https://www.hedtags.org/hed-resources/) - tutorials and guides for annotating data with HED.
- [HED schema browser](https://www.hedtags.org/hed-schema-browser/) - the tags of each schema version.
