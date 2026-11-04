/**
 * @module
 * @description This module is the entry point for the HED JavaScript library.
 */
export {
  BidsDataset,
  BidsTsvFile,
  BidsJsonFile,
  BidsSidecar,
  BidsHedIssue,
  BidsFileAccessor,
  BidsDirectoryAccessor,
  BidsWebAccessor,
  buildBidsSchemas,
} from './bids'

export { findDuplicateHeaders, parseTSV } from './bids/tsvParser'

export { IssueError, Issue } from './issues/issues'

// Export parser functions for HED string validation

export { Definition, DefinitionManager } from './parser/definitionManager'

export { parseStandaloneString, parseHedString, parseHedStrings } from './parser/parser'

// Export schema functions
export { getLocalSchemaVersions } from './schema/config'

export { buildSchemasFromVersion } from './schema/init'
