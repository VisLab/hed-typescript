---
myst:
  html_meta:
    description: 'Contributing to hed-typescript: building, testing, the hed-tests conformance suite, formatting and linting, the pull request flow, and porting changes to and from hed-javascript'
    keywords: HED, hed-typescript, contributing, jest, hed-tests, conformance suite, prettier, eslint, pull requests, hed-javascript
---

```{index} contributing, tests, hed-tests, spec tests, prettier, eslint, pull requests, porting

```

:::{admonition} Under development
:class: danger

These pages are under development.
:::

# Contributing

hed-typescript is developed on GitHub at
[hed-standard/hed-typescript](https://github.com/hed-standard/hed-typescript). Questions and bug reports go to its
[issues](https://github.com/hed-standard/hed-typescript/issues). This page is for people changing the code.

## Setting up

You need Node.js 22 or later and git. Clone the repository with its submodule and install:

```shell
git clone --recurse-submodules https://github.com/hed-standard/hed-typescript
cd hed-typescript
npm ci
```

`npm ci` also installs the pre-commit hook and builds `dist/`. In an existing clone without the submodule, run
`git submodule update --init`.

## Tests and checks

The tests use jest; test files are named `*.spec.js`.

| Task                  | Command                                                         |
| --------------------- | --------------------------------------------------------------- |
| Unit tests (the gate) | `npm test`                                                      |
| One test file         | `npx jest tests/otherTests/paths.spec.js`                       |
| Conformance suite     | `npm run testSpecs`                                             |
| Lint                  | `npm run lint`                                                  |
| Type check            | `npm run type-check`                                            |
| Format check          | `npx prettier --check src`                                      |
| Build                 | `npm run build`                                                 |
| Coverage              | `npm run coverage`                                              |
| Spelling              | `uvx typos --config .typos.toml --exclude spec_tests/hed-tests` |

The unit tests are in `tests/`: hand-written tests in `tests/otherTests/`, tests driven by data in
`tests/jsonTests/` with their data in `tests/jsonTestData/`, a sample BIDS dataset in `tests/bidsDemoData/`, and
helpers in `tests/testHelpers/`.

The pre-commit hook formats the staged files under `src/` with Prettier and then runs `npm test`, so a commit
waits for the whole unit suite.

## The hed-tests conformance suite

[hed-tests](https://github.com/hed-standard/hed-tests) is the conformance suite shared by the HED validators. It is
a git submodule at `spec_tests/hed-tests`, pinned to one commit; `npm run testSpecs` runs every case in it against
this validator, as a HED string, a sidecar, a tabular file, and a tabular file with its sidecar.

- Never edit the files under `spec_tests/hed-tests/`. A change to the suite goes to hed-tests as its own pull
  request; this repository then moves the submodule to the new commit.
- `spec_tests/skippedTests.js` lists the cases this validator does not pass yet, with the reason. Remove an entry
  once its case passes. Set `HED_RUN_SKIPPED=1` to run the listed cases anyway.
- `spec_tests/README.md` describes the runner.

## Code style

- Prettier formats the code (`.prettierrc.yaml`: single quotes, no semicolons, trailing commas, 120 columns).
- ESLint checks it (`eslint.config.mjs`). One rule differs from common TypeScript practice: private class members
  are written `private _name`, not `#name`.
- Text in code, comments, documentation, and file names is ASCII only: `-` rather than a dash, `->` rather than an
  arrow, `...` rather than an ellipsis character, and straight quotes.
- A module that needs the Node.js file system goes behind one of the two modules with browser replacements (see
  [Using the package in the browser](browser.md#the-browser-build)), so that `dist/esm/` stays free of Node.js
  imports.
- Two data files are verbatim copies of files that hed-specification publishes, and are never edited by hand:
  `src/data/json/reservedTags.json` and `src/data/json/characterSets.json`. Weekly workflows compare each with
  hed-specification `main`.

## Pull requests

Pull requests go to the `fix_required` branch, not to `main`. `fix_required` reaches `main` by its own pull
request, and a GitHub release publishes the package to npm.

Each pull request runs the unit tests and the conformance suite on Node.js 22, the current LTS, and the current
release, a spelling check, CodeQL, and a build of this documentation site. The tests also fail on any tracked file
with Windows (CRLF) line endings.

To refer to an issue or pull request in another repository, use its full URL rather than `#n`.

## hed-javascript and hed-typescript

The same validator also exists in JavaScript, in [hed-javascript](https://github.com/hed-standard/hed-javascript),
and changes are ported between the two in both directions. The two must give the same results on the hed-tests
suite. [hed-javascript and hed-typescript](hed_javascript_and_hed_typescript.md) lists the differences that are
intended and explains the porting rule; any other difference in behavior is a bug in one of them.
