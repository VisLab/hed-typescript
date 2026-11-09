.. meta::
   :description: hed-typescript, the TypeScript source of the hed-validator npm package, validates HED annotations in HED strings, BIDS sidecars and tabular files, and BIDS datasets, in Node.js and browsers
   :keywords: HED, hierarchical event descriptors, hed-validator, hed-typescript, TypeScript, JavaScript, validation, BIDS, Node.js, browser

.. admonition:: Under development
   :class: danger

   These pages are under development.

hed-typescript
==============

hed-typescript is the TypeScript source of the ``hed-validator`` npm package, which validates
HED (Hierarchical Event Descriptors) annotations for Node.js and for browser bundlers.
The package is published on npm as
`hed-validator <https://www.npmjs.com/package/hed-validator>`_, and the source is on
`GitHub <https://github.com/hed-standard/hed-typescript>`_.

Key features
------------

* **HED strings**: validate a single HED string against one or more HED schemas.
* **BIDS files**: validate BIDS sidecars and tabular files, including curly-brace splices and value columns.
* **BIDS datasets**: validate a whole BIDS dataset from a directory, a file list, or the web.
* **Node.js and browsers**: the same package runs in Node.js and in browser bundlers.
* **Conformance**: checked against the `hed-tests <https://github.com/hed-standard/hed-tests>`_ suite.

Working with hed-typescript
---------------------------

.. toctree::
   :maxdepth: 2

   Overview <overview>
   Installation and versions <installation>
   Validating HED strings <validating_strings>
   Validating BIDS files <validating_bids_files>
   Validating BIDS datasets <validating_datasets>
   Using the package in the browser <browser>
   Issues <issues>
   Contributing <contributing>
   hed-javascript and hed-typescript <hed_javascript_and_hed_typescript>
   API reference <https://www.hedtags.org/hed-typescript/api/>

* :ref:`genindex`
