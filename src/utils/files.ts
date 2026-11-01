/**
 * This module holds the asynchronous function for reading local files (Node.js only).
 * @module
 */

import { readFile as readFilePromise } from 'node:fs/promises'

import { IssueError } from '../issues/issues'

/**
 * Read a local file.
 *
 * @param fileName - The file path.
 * @returns A promise with the file contents.
 * @throws {IssueError} If the file read failed or if called in a browser environment.
 */
export async function readFile(fileName: string): Promise<string> {
  try {
    const stringBuffer = await readFilePromise(fileName, 'utf8')
    return stringBuffer.toString()
  } catch (error) {
    IssueError.generateAndRethrow(
      error,
      (error) => ['fileReadError', { fileName: fileName, message: error.message }],
      'Illegal error type when reading local file',
    )
  }
}
