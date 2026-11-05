/**
 * This module contains classes for representing BIDS TSV files and their components.
 * @module bids/types/tsv
 */

import isPlainObject from 'lodash/isPlainObject'

import { BidsFile, type FilePath } from './file'
import {
  convertParsedTSVData,
  findHeaderProblems,
  isMissingTsvValue,
  parseTSV,
  parseTSVHeader,
  type OldParsedTSV,
  type ParsedTSV,
} from '../tsvParser'
import { BidsSidecar } from './json'
import BidsHedTsvValidator from '../validator/tsvValidator'
import { IssueError } from '../../issues/issues'
import { type DefinitionManager } from '../../parser/definitionManager'
import type ParsedHedString from '../../parser/parsedHedString'
import { columnNameText, stripNameWhitespace } from '../../utils/string'

/**
 * A BIDS TSV file.
 */
export class BidsTsvFile extends BidsFile {
  /**
   * This file's parsed TSV data.
   */
  public readonly parsedTsv: ParsedTSV

  /**
   * The column names that appear more than once in the header (TABULAR_INVALID).
   */
  public readonly duplicateColumns: string[]

  /**
   * The column names that begin or end with whitespace (TABULAR_INVALID), each once in header order.
   */
  public readonly paddedColumns: string[]

  /**
   * The 1-based positions of the blank column names (TABULAR_INVALID).
   */
  public readonly blankColumns: number[]

  /**
   * HED strings in the "HED" column of the TSV data.
   */
  public readonly hedColumnHedStrings: string[]

  /**
   * The pseudo-sidecar object representing the merged sidecar data.
   */
  public readonly mergedSidecar: BidsSidecar

  /**
   * Constructor.
   *
   * @param name - The name of this file.
   * @param file - The Object representing this file data.
   * @param tsvData - This file's TSV data.
   * @param mergedDictionary - This file's merged JSON dictionary.
   * @param defManager - This file's definition manager.
   */
  constructor(
    name: string,
    file: FilePath,
    tsvData: string | ParsedTSV | OldParsedTSV,
    mergedDictionary: Record<string, unknown> = {},
    defManager: DefinitionManager | null = null,
  ) {
    super(name, file, BidsHedTsvValidator)

    const [parsedTsv, headers] = this._parseTsv(tsvData, file)
    this.parsedTsv = parsedTsv
    const { padded, blank, duplicate } = findHeaderProblems(headers)
    this.paddedColumns = padded
    this.blankColumns = blank
    this.duplicateColumns = duplicate
    this.hedColumnHedStrings = this._parseHedColumn()
    this.mergedSidecar = new BidsSidecar(name, this.file, mergedDictionary, defManager)
  }

  /**
   * Parse the TSV file.
   *
   * @param tsvData - This file's TSV data.
   * @param file - The Object representing this file data.
   * @returns The parsed TSV data and the column names as written.
   */
  private _parseTsv(tsvData: string | ParsedTSV | OldParsedTSV, file: FilePath): [ParsedTSV, string[]] {
    if (typeof tsvData === 'string') {
      return [parseTSV(tsvData), parseTSVHeader(tsvData)]
    } else if (tsvData instanceof Map) {
      // Names become text, as in a text file; two keys that become the same name keep the first column.
      const parsedTsv: ParsedTSV = new Map<string, string[]>()
      const headers: string[] = []
      for (const [key, values] of tsvData) {
        const name = columnNameText(key)
        headers.push(name)
        if (!parsedTsv.has(name)) {
          parsedTsv.set(name, values)
        }
      }
      return [parsedTsv, headers]
    } else if (isPlainObject(tsvData)) {
      const headers = tsvData.headers.map(columnNameText)
      return [convertParsedTSVData({ headers, rows: tsvData.rows }), headers]
    } else {
      const msg = 'The tsvData was not a string, Map or plain object, so a BidsTsvFile could not be created.'
      IssueError.generateAndThrow('internalError', { message: msg, filePath: file.path })
    }
  }

  /**
   * Parse the HED column from the TSV data.
   *
   * @returns The parsed HED column.
   */
  private _parseHedColumn(): string[] {
    const hedColumn = this.parsedTsv.get('HED')
    if (hedColumn === undefined) {
      return []
    } else {
      return hedColumn.map((hedCell) => (isMissingTsvValue(hedCell) ? '' : hedCell))
    }
  }

  /**
   * Determine whether this file has any HED data.
   *
   * @returns Whether this file has any HED data.
   */
  public override get hasHedData(): boolean {
    // A padded "HED" header is still the HED column, so the file is checked and its header reported.
    return (
      this.parsedTsv.has('HED') ||
      this.paddedColumns.some((column) => stripNameWhitespace(column) === 'HED') ||
      this.mergedSidecar.hasHedData
    )
  }

  /**
   * Whether this TSV file is a timeline file.
   *
   * @returns Whether this TSV file is a timeline file.
   */
  public get isTimelineFile(): boolean {
    return this.parsedTsv.has('onset')
  }
}

/**
 * An element in a BIDS TSV file.
 */
export class BidsTsvElement {
  /**
   * The string representation of this element.
   */
  public readonly hedString: string

  /**
   * The ParsedHedString representation of this element.
   */
  public parsedHedString: ParsedHedString | null

  /**
   * The file this element belongs to (usually just the path).
   */
  public readonly file: FilePath

  /**
   * The name of the file this element belongs to (usually just the path).
   */
  public readonly fileName: string

  /**
   * The onset represented by this element or a NaN.
   *
   * @todo This probably should be a number. Move numeric conversion to this file?
   */
  public readonly onset: string

  /**
   * The line number(s) (including the header) represented by this element.
   */
  public readonly tsvLine: string

  /**
   * Constructor.
   *
   * @param hedString - The string representation of this element.
   * @param tsvFile - The file this element belongs to (usually just the path).
   * @param onset - The onset represented by this element or a NaN.
   * @param tsvLine - The line number(s) (including the header) represented by this element.
   */
  constructor(hedString: string, tsvFile: BidsTsvFile, onset: string, tsvLine: string) {
    this.hedString = hedString
    this.parsedHedString = null
    this.file = tsvFile.file
    this.fileName = tsvFile.name
    this.onset = onset
    this.tsvLine = tsvLine
  }

  /**
   * Override of {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.prototype.toString}.
   *
   * @returns The string representation of this element.
   */
  public toString(): string {
    const onsetString = this.onset ? ` with onset=${this.onset}` : ''
    return this.hedString + ` in TSV file "${this.fileName}" at line(s) ${this.tsvLine}` + onsetString
  }

  /**
   * Create a string list of a list of BidsTsvElement objects.
   *
   * @param elements - A list of elements to construct line numbers from.
   * @returns A string with the list of line numbers for error messages.
   */
  public static getTsvLines(elements: BidsTsvElement[]): string {
    return elements.map((element) => element.tsvLine).join(',')
  }
}

/**
 * A row in a BIDS TSV file.
 */
export class BidsTsvRow extends BidsTsvElement {
  /**
   * The map of column name to value for this row.
   */
  public readonly rowCells: Map<string, string>

  /**
   * Constructor.
   *
   * @param hedString - The string representation of this row.
   * @param tsvFile - The file this row belongs to (usually just the path).
   * @param tsvLine - The line number (including the header) represented by this row.
   * @param rowCells - The map of column name to value for this row.
   */
  constructor(hedString: string, tsvFile: BidsTsvFile, tsvLine: number, rowCells: Map<string, string>) {
    const onset = rowCells.get('onset') ?? ''
    super(hedString, tsvFile, onset, tsvLine.toString())
    this.rowCells = rowCells
  }
}
