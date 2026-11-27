import type { DefinitionElement, HedSchemaXMLCollection, HedSchemaXMLObject } from '../xmlType'
import { getDefinitionElements, SchemaDefinitionEntryParser } from './schemaEntry'

import type SchemaEntryManager from '../entries/schemaEntryManager'
import type SchemaAttribute from '../entries/attribute'
import SchemaUnitModifier from '../entries/unitModifier'

export default class UnitModifierParser extends SchemaDefinitionEntryParser<SchemaUnitModifier> {
  public constructor(xmlCollection: HedSchemaXMLCollection, attributes: SchemaEntryManager<SchemaAttribute>) {
    super(xmlCollection, attributes)
  }

  protected override _getDefinitions(schemaXml: HedSchemaXMLObject): DefinitionElement[] {
    return getDefinitionElements(schemaXml.HED, 'unitModifier')
  }

  protected override _buildEntry(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
  ): SchemaUnitModifier {
    return new SchemaUnitModifier(name, description, booleanAttributes, valueAttributes)
  }
}
