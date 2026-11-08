# hed-typescript

Purpose: the TypeScript source of the `hed-validator` npm package, which validates HED annotations - single strings, BIDS sidecars and tabular files, and whole BIDS datasets - for Node.js and for browser bundlers. Not in scope: the browser validator app (hed-web), the HED schema sources (hed-schemas), and the JSON conformance suite (hed-tests, included here as a submodule).

## Commands

Test framework: jest (transformed by babel-jest; test files are `*.spec.js`). Never convert the suite to another framework as a side effect of other work.

Run from the repo root, on Node.js 22 or later.

| Task             | Command                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Install          | `npm ci` (its `prepare` script also installs the husky hook and builds `dist/`)              |
| Spec-test data   | `git submodule update --init` (fills `spec_tests/hed-tests`)                                 |
| Tests (the gate) | `npm test`                                                                                   |
| One test file    | `npx jest tests/otherTests/paths.spec.js`                                                    |
| JSON spec tests  | `npm run testSpecs`                                                                          |
| Lint             | `npm run lint`                                                                               |
| Type check       | `npm run type-check`                                                                         |
| Format check     | `npx prettier --check src`                                                                   |
| Build            | `npm run build` (esbuild -> `dist/commonjs/` and `dist/esm/`)                                |
| Docs site        | `pip install -r docs/requirements.txt`, then `sphinx-build -W -b html docs docs/_build/html` |
| API docs         | `npm run docs` (typedoc -> `docs/_build/html/api/`)                                          |
| Coverage         | `npm run coverage`                                                                           |
| Spelling         | `uvx typos --config .typos.toml --exclude spec_tests/hed-tests`                              |

CI (`.github/workflows/`): `tests.yml` runs `npm test` and `npm run testSpecs` on Node 22, LTS, and current, and fails on any tracked file with CRLF line endings; `typos.yaml` runs the spelling check without the submodule; `coverage.yml` and `codeql.yml`; `reserved_tags.yml` (below); `deploy-pages.yml` builds the documentation site and API reference under `docs/_build/html` on every push and pull request to `main` and publishes them from `main`; `publish.yml` publishes to npm on a GitHub release.

The pre-commit hook (`.husky/pre-commit`) runs prettier on staged files under `src/` and then the whole `npm test`.

Never quote pass or skip counts in a committed file: they change with every commit.

## Layout

- `src/index.ts` - the public API.
- `src/bids/` - BIDS dataset, sidecar, and TSV validation. `accessors/` reads a dataset from a directory (Node), a file list, or the web.
- `src/parser/` - HED string tokenizing, splitting, parsing, definitions, and reserved-tag checks.
- `src/schema/` - schema loading, the XML schema parser (`parser/`), and the schema entry model (`entries/`).
- `src/issues/` - issue codes and messages.
- `src/utils/` - shared helpers.
- `src/data/schemas/` - HED schema XML bundled into the package. `src/data/json/` - JSON data bundled into the package.
- `tests/` - `otherTests/` (hand-written specs), `jsonTests/` (specs driven by `jsonTestData/`), fixtures in `bidsDemoData/` and `schemaData/`, helpers in `testHelpers/`.
- `spec_tests/` - the runner for the hed-tests suite. `skippedTests.js` lists the cases this validator does not pass yet; remove an entry once its case passes.
- `docs/` - the documentation site (Sphinx, Markdown guides); `docs/api_readme.md` is the TypeDoc front page.
- `dist/`, `docs/_build/` - generated and gitignored.
- `.status/` - working notes. Gitignored; local to each machine.

## Conventions that differ from defaults

- **ASCII only** in prose, code, comments, and filenames: `-` not em or en dashes, `->` not arrows, `...` not an ellipsis character, straight quotes. Exception: genuine data (author names, dataset titles, recorded responses) keeps whatever characters it actually contains.
- Prettier is the formatter (`.prettierrc.yaml`: single quotes, no semicolons, trailing commas, 120 columns).
- No `#name` private class members; use `private _name`. ESLint enforces it (`no-restricted-syntax` in `eslint.config.mjs`).
- Markdown headers are sentence case.
- On GitHub, an issue or PR in another repository is referred to by its full URL, not `#n` or `repo#n`.
- Committed files carry no project history and no local paths or drive letters.

## Rules that are easy to get wrong

- `src/data/json/reservedTags.json` is a verbatim copy of hed-specification's `reserved_tags.json`. Never edit or reformat it (`.prettierignore` excludes it); replace it with the published file. `reserved_tags.yml` compares it byte for byte with hed-specification `main` weekly.
- Two modules are Node-only and have browser twins, swapped by the `browser` field in `package.json`: `src/schema/loader.ts` -> `browserLoader.ts`, and `src/bids/accessors/directory.ts` -> `directory.browser.ts`. Anything that needs `fs` or another Node built-in goes behind one of them; `dist/esm/` must contain no `node:` import, because browser bundlers consume it.
- Never edit files under `spec_tests/hed-tests/`; changes to the suite go to hed-tests, and this repo moves the submodule pin.
- Pull requests go to `fix_required`, not `main`; `fix_required` reaches `main` by its own pull request.

## Related repositories

Referred to by name; a session that needs one must be given access to that checkout.

- `hed-javascript` - the JavaScript validator this code shares its design with; fixes are ported in both directions.
- `hed-tests` - the conformance suite, a submodule at `spec_tests/hed-tests`.
- `hed-specification` - the rules the validator implements, and the source of `reserved_tags.json`.
- `hed-schemas` - the source of the schema XML bundled in `src/data/schemas/`.
- `hed-web` - the browser validator; consumes `dist/esm/`.

## Where the thinking lives

`.status/` is gitignored, so it exists only on the machine that wrote it and never in a fresh clone or worktree.

- `.status/README.md` - current state, unfinished work, and an ordered `Next` list. Read this first.
- `.status/development_history.md` - what has shipped, newest first, with pointers to the records. History only; append at the top when a PR merges.
- `.status/decisions.md` - why things are the way they are. Read before proposing structural changes. Append entries; never rewrite one.
- `.status/plans/*.md` - unfinished plans only. Check the `Status:` header and the `[ ]` / `[x]` markers before starting work. A finished plan moves to `.status/archive/completed_plans/`, renamed `archived_YYYY-MM-DD_<name>` with the day it was archived; split any still-open boxes into a new plan first.
- `.status/notes/` - dated records, always named `YYYY-MM-DD_<slug>.md`. Write-once.
- `.status/local-environment.md` - this machine's paths, interpreter, and quirks. Tool-agnostic. Never copy its contents into a committed file.
- IMPORTANT: do not read `.status/archive/` unless a file is named for you. The `.status/` root holds only `README.md`, `decisions.md`, `development_history.md`, and `local-environment.md`; nothing else is created there.

## Working agreements

- IMPORTANT: every file written to `.status/` opens with a `For humans:` summary - three or four sentences, at the very top: what the file is and what a person needs to take from it. The same applies to a long answer in a session: lead with the conclusion.
- IMPORTANT: temporary scripts, experiments, and one-off test files go in `.status/scratch/` - **never the repository root**. Anything in `scratch/` may be deleted unread.
- IMPORTANT: never delete or rewrite a file under `.status/` without asking first. Appending is fine.
- For a change spanning more than three files, write a plan to `.status/plans/` and stop for review before editing.
- When you are guessing about an external API or data format, say so explicitly rather than assuming.
- Show evidence, not assertions: the command you ran and its actual output.
- Do not commit, push, or create branches unless asked.
