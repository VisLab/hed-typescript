/**
 * Browser stand-in for the local directory access of BIDS datasets.
 *
 * @remarks
 * The ESM (browser) build uses this module in place of {@link module:bids/accessors/directory} through the "browser"
 * field of package.json, so that no Node.js file system code is bundled. The class keeps its name so that the
 * package exports stay the same in every build.
 *
 * @module bids/accessors/directory.browser
 */

import { BidsFileAccessor } from './file'
import { IssueError } from '../../issues/issues'

/**
 * A BIDS file accessor for local directory environments, which are not available in this build.
 */
export class BidsDirectoryAccessor extends BidsFileAccessor<string> {
  /**
   * Factory method to create a BidsDirectoryAccessor (not supported in this build).
   *
   * @param datasetRootDirectory - The absolute path to the dataset's root directory.
   * @returns Never resolves; always throws.
   * @throws {IssueError} Always, since this build has no file system access.
   */
  public static async create(datasetRootDirectory: string): Promise<BidsDirectoryAccessor> {
    IssueError.generateAndThrowInternalError(
      `BidsDirectoryAccessor cannot read '${datasetRootDirectory}': it needs Node.js file system access, which this build does not have. Use BidsWebAccessor in a browser.`,
    )
  }

  /**
   * Read the content of a file (never reached, since {@link create} always throws).
   *
   * @param relativePath - The relative path to the file within the dataset.
   * @returns Always null.
   */
  public async getFileContent(relativePath: string): Promise<string | null> {
    void relativePath
    return null
  }
}
