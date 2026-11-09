---
myst:
  html_meta:
    description: 'The intended differences between the hed-javascript and hed-typescript implementations of the hed-validator package'
    keywords: HED, hed-validator, hed-javascript, hed-typescript, differences, porting, factory methods
---

```{index} hed-javascript, hed-typescript, differences, factory methods

```

# hed-javascript and hed-typescript

The `hed-validator` npm package has two implementations of the same validator:

- [hed-javascript](https://github.com/hed-standard/hed-javascript), written in JavaScript, and
- [hed-typescript](https://github.com/hed-standard/hed-typescript), written in TypeScript.

Both validate HED strings, BIDS sidecars and tabular files, and whole BIDS datasets. Both run the
[hed-tests](https://github.com/hed-standard/hed-tests) conformance suite and must give the same results on it.
Changes are ported in both directions. As a rule, the two implementations share behavior, and hed-javascript follows
hed-typescript's code style.

This page lists the differences that are intended. Any difference in behavior that is not listed here is
unintended and is treated as a bug in one of the two.

## Language and packaging

|                      | hed-javascript                                            | hed-typescript                                            |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Source               | JavaScript modules in `src/*.js`                          | TypeScript in `src/*.ts`                                  |
| Build                | esbuild to `dist/commonjs/` and `dist/esm/`               | esbuild to `dist/commonjs/` and `dist/esm/`               |
| Type declarations    | Hand-written, `types/index.d.ts`, published               | Not published yet; the source is type-checked             |
| Node-only modules    | `src/schema/loader.js`, `src/bids/accessors/directory.js` | `src/schema/loader.ts`, `src/bids/accessors/directory.ts` |
| Browser replacements | `browserLoader.js`, `directory.browser.js`                | `browserLoader.ts`, `directory.browser.ts`                |

In both packages the `browser` field of `package.json` swaps each Node-only module for its browser replacement, so
the ES module build used by browser bundlers contains no Node built-in imports.

## Objects that must be created through a factory method

Some classes must not be built with `new`, because their factory methods check the input and return issues, and a
direct constructor call would skip those checks. TypeScript expresses this with a `private` constructor, which the
compiler enforces when TypeScript code is compiled. JavaScript has no private constructors, so hed-javascript either
checks at run time or leaves the constructor public and relies on the documented factory method.

| Class                   | Factory method                                                            | hed-typescript        | hed-javascript                                                    |
| ----------------------- | ------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| `Definition`            | `Definition.createDefinition()`, `Definition.createDefinitionFromGroup()` | `private` constructor | Throws unless called by a factory method (hidden second argument) |
| `ReservedChecker`       | `ReservedChecker.getInstance()`                                           | `private` constructor | Throws if an instance already exists                              |
| `BidsDataset`           | `BidsDataset.create()`                                                    | `private` constructor | Public; throws if the argument is not a `BidsFileAccessor`        |
| `BidsDirectoryAccessor` | `BidsDirectoryAccessor.create()`                                          | `private` constructor | Public                                                            |
| `Event`                 | `Event.createEvent()`                                                     | `private` constructor | Public                                                            |

What this means for callers:

- In TypeScript code that uses hed-typescript, `new Definition(...)` and the others do not compile.
- In plain JavaScript that uses either package, the compiled hed-typescript code no longer has the `private`
  keyword, so `new Definition({})` does not throw there, while hed-javascript throws. In both packages the factory
  methods are the supported way to create these objects; code that calls the constructors directly is outside the
  documented API.
- hed-typescript keeps the language feature rather than copying hed-javascript's run-time check. The tests that
  check the run-time error, the `Constructor` tests of `tests/otherTests/definitionManager.spec.js`, exist only in
  hed-javascript.
