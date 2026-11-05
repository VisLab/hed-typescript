/**
 * hed-tests cases that this validator does not pass yet, keyed by test case name.
 *
 * The runner (jsonTests.spec.js) skips a whole case by name and reports the reason in the jest
 * summary. Remove an entry once the case passes. Reasons record what was observed when the entry
 * was added, not a diagnosis. Set HED_RUN_SKIPPED=1 to run the listed cases anyway.
 *
 */
export const skippedTests = {
  'bad-value-in-curly-column':
    'An invalid value in a column referenced in curly braces, in a row that does not substitute it, gives no error.',
  'value-invalid-date-time-format':
    'dateTimeClass values outside the BIDS Datetime format or calendar (2026-09-30T24:00:00, 2026-02-31) give no error.',
  'placeholder-invalid-after-extension':
    'Item/# and Item/Blech/# in a sidecar value column (alone or in a combo) give TAG_EXTENSION_INVALID, not PLACEHOLDER_INVALID.',
  'tag-extension-invalid-no-letter':
    'Extension terms with no letter (Item/Blech/3, Item/1-2, Item/42, Item/_, Item/-1, Item/ + U+00B0 or U+0663) give no error.',
  'tag-extension-invalid-no-letter-8-2-0':
    'Extension terms with no letter (Item/Blech/3, Item/1-2) under 8.2.0 give no error.',
}
