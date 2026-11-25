/**
 * This module holds the class representing a HED string.
 * @module parser/parsedHedString
 */

import ParsedHedColumnSplice from './parsedHedColumnSplice'
import ParsedHedGroup from './parsedHedGroup'
import type ParsedHedSubstring from './parsedHedSubstring'
import ParsedHedTag from './parsedHedTag'
import { filterByClass } from './parseUtils'
import { IssueError } from '../issues/issues'

/**
 * A parsed HED string.
 */
export default class ParsedHedString {
  /**
   * The original HED string.
   */
  readonly hedString: string

  /**
   * The parsed substring data in unfiltered form.
   */
  readonly parseTree: ParsedHedSubstring[]

  /**
   * The tag groups in the string (top-level).
   */
  readonly tagGroups: ParsedHedGroup[]

  /**
   * All the top-level tags in the string.
   */
  readonly topLevelTags: ParsedHedTag[]

  /**
   * All the tags in the string at all levels.
   */
  readonly tags: ParsedHedTag[]

  /**
   * All the column splices in the string at all levels.
   */
  readonly columnSplices: ParsedHedColumnSplice[]

  /**
   * The tags in the top-level tag groups in the string.
   */
  readonly topLevelGroupTags: ParsedHedTag[]

  /**
   * The top-level definition tag groups in the string.
   */
  readonly definitions: ParsedHedGroup[]

  /**
   * The normalized string representation of this column splice.
   */
  readonly normalized: string

  /**
   * Constructor.
   * @param hedString - The original HED string.
   * @param parsedTags - The nested list of parsed HED tags, groups, and column splices.
   */
  public constructor(hedString: string, parsedTags: ParsedHedSubstring[]) {
    this.hedString = hedString
    this.parseTree = parsedTags
    this.tagGroups = filterByClass(parsedTags, ParsedHedGroup)
    this.topLevelTags = filterByClass(parsedTags, ParsedHedTag)

    const subgroupTags = this.tagGroups.flatMap((tagGroup) => Array.from(tagGroup.tagIterator()))
    this.tags = this.topLevelTags.concat(subgroupTags)

    const topLevelColumnSplices = filterByClass(parsedTags, ParsedHedColumnSplice)
    const subgroupColumnSplices = this.tagGroups.flatMap((tagGroup) => Array.from(tagGroup.columnSpliceIterator()))
    this.columnSplices = topLevelColumnSplices.concat(subgroupColumnSplices)

    this.topLevelGroupTags = this.tagGroups.flatMap((tagGroup) => tagGroup.topTags)
    this.definitions = this.tagGroups.filter((group) => group.isDefinitionGroup)
    this.normalized = this._getNormalized()
  }

  /**
   * Nicely format this HED string. (Doesn't allow column splices).
   *
   * @param long - Whether the tags should be in long form.
   * @returns The formatted HED string.
   */
  public format(long: boolean = true): string {
    return this.parseTree.map((substring) => substring.format(long)).join(', ')
  }

  /**
   * Return a normalized string representation.
   *
   * @returns The normalized HED string.
   */
  private _getNormalized(): string {
    // This is an implicit recursion as the items have the same call.
    const normalizedItems = this.parseTree.map((item) => item.normalized)

    // Sort normalized items to ensure order independence
    const sortedNormalizedItems = normalizedItems.toSorted((a, b) => a.localeCompare(b))
    const duplicates = ParsedHedGroup.findRepeatedExpressions(this.parseTree)
    if (duplicates.length > 0) {
      IssueError.generateAndThrow('duplicateTag', { tags: '[' + duplicates.join('],[') + ']', string: this.hedString })
    }
    // Return the normalized group as a string
    return `${sortedNormalizedItems.join(',')}` // Using curly braces to indicate unordered group
  }

  /**
   * Override of {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.prototype.toString}.
   *
   * @returns The original HED string.
   */
  public toString(): string {
    return this.hedString
  }
}
