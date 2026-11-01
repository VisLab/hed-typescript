/**
 * Provides file access for BIDS datasets.
 *
 * @remarks
 * This module contains the {@link BidsFileAccessor} base class. Its subclasses read files from a BIDS dataset in
 * different environments, such as {@link BidsDirectoryAccessor} (module bids/accessors/directory) for a local
 * directory.
 *
 * @module bids/accessors/file
 */

import { type BidsJsonFile } from '../types/json'
import { IssueError } from '../../issues/issues'
import { type HedSchemas } from '../../schema/containers'
import { organizePaths } from '../../utils/paths'

type SchemaBuilder = (datasetDescription: BidsJsonFile) => Promise<HedSchemas | null>

/**
 * Base class for BIDS file accessors.
 *
 * @remarks
 * This class provides a common interface for accessing files in a BIDS dataset, regardless of the underlying storage
 * mechanism. Subclasses must implement the `create` and `getFileContent` methods.
 */
export abstract class BidsFileAccessor<FileType> {
  /**
   * The root directory of the dataset.
   */
  readonly datasetRootDirectory: string

  /**
   * Map of relative file paths to file representations.
   */
  fileMap: Map<string, FileType>

  /**
   * Organized paths.
   */
  organizedPaths: Map<string, Map<string, string[]>>

  /**
   * The HED schema builder function.
   */
  readonly schemaBuilder: SchemaBuilder

  /**
   * BIDS suffixes.
   */
  public static readonly SUFFIXES: readonly string[] = [
    'dataset_description',
    'participants',
    '_events',
    '_beh',
    '_scans',
    '_sessions',
    'samples',
  ]

  /**
   * BIDS special directories.
   */
  public static readonly SPECIAL_DIRS: readonly string[] = ['phenotype', 'stimuli']

  /**
   * Constructs a BidsFileAccessor.
   *
   * @param datasetRootDirectory - The root directory of the dataset.
   * @param fileMap - A map of relative file paths to file representations (e.g., `File` objects for web, full paths for Node.js).
   * @param schemaBuilder - The HED schema builder function.
   */
  protected constructor(datasetRootDirectory: string, fileMap: Map<string, FileType>, schemaBuilder: SchemaBuilder) {
    if (typeof datasetRootDirectory !== 'string') {
      IssueError.generateAndThrowInternalError(
        'BidsFileAccessor constructor requires a string for datasetRootDirectory.',
      )
    }
    if (!(fileMap instanceof Map)) {
      // Ensure fileMap is a Map
      IssueError.generateAndThrowInternalError('BidsFileAccessor constructor requires a Map argument for fileMap.')
    }
    this.datasetRootDirectory = datasetRootDirectory
    this._initialize(fileMap)
    this.schemaBuilder = schemaBuilder
  }

  /**
   * Initializes the file map and organized paths.
   *
   * @remarks
   * This method filters the file map to include only BIDS-related files and organizes them by type and category.
   *
   * @param fileMap - A map of relative file paths to file representations.
   */
  private _initialize(fileMap: Map<string, FileType>) {
    const relativeFilePaths = Array.from(fileMap.keys())
    const { candidates, organizedPaths } = organizePaths(
      relativeFilePaths,
      BidsFileAccessor.SUFFIXES,
      BidsFileAccessor.SPECIAL_DIRS,
    )
    this.organizedPaths = organizedPaths

    const newFileMap = new Map<string, FileType>()
    for (const candidate of candidates) {
      const mappedCandidate = fileMap.get(candidate)
      if (fileMap.has(candidate)) {
        newFileMap.set(candidate, mappedCandidate as FileType)
      }
    }
    this.fileMap = newFileMap
  }

  /**
   * Asynchronously reads the content of a file.
   *
   * @remarks
   * This method must be implemented by subclasses to handle environment-specific file reading.
   *
   * @param relativePath - The relative path to the file.
   * @returns A promise that resolves with the file content as a string, or null if the file cannot be read.
   * @throws {IssueError} If the method is not implemented by a subclass.
   */
  public abstract getFileContent(relativePath: string): Promise<string | null>
}
