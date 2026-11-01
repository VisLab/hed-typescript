/**
 * This module contains functions for building HED schemas for BIDS datasets.
 * @module bids/schema
 */

import AbstractHedSchemaLoader from '../schema/abstractLoader'
import { type HedSchemas } from '../schema/containers'
import { SchemasSpec } from '../schema/specs'
import { type BidsJsonFile } from './types/json'
import HedSchemaLoader from '../schema/loader'

/**
 * Build a HED schema collection based on the defined BIDS schemas.
 *
 * @param datasetDescription - The description of the BIDS dataset being validated.
 * @param schemaLoader - The schema loader (the loader of this build by default).
 * @returns A Promise with the schema collection, or null if the specification is missing.
 * @throws {IssueError} If the schema specification is invalid.
 */
export async function buildBidsSchemas(
  datasetDescription: BidsJsonFile,
  schemaLoader: AbstractHedSchemaLoader = new HedSchemaLoader(),
): Promise<HedSchemas | null> {
  if (datasetDescription?.jsonData?.HEDVersion) {
    const schemasSpec = SchemasSpec.parseVersionSpecs(datasetDescription.jsonData.HEDVersion)
    return await schemaLoader.buildSchemas(schemasSpec)
  } else {
    return null
  }
}
