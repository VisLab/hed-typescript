import { getElementName, type HedSchemaXMLCollection, type DefinitionElement, HedSchemaXMLObject } from '../xmlType'
import { SchemaDefinitionEntryParser } from './schemaEntry'

import type SchemaUnitModifier from '../entries/unitModifier'
import type SchemaAttribute from '../entries/attribute'
import type SchemaEntryManager from '../entries/schemaEntryManager'
import SchemaUnitClass from '../entries/unitClass'
import SchemaUnit from '../entries/unit'

import { IssueError } from '../../issues/issues'

export default class UnitClassParser extends SchemaDefinitionEntryParser<SchemaUnitClass> {
  private readonly unitModifiers: SchemaEntryManager<SchemaUnitModifier>
  private unitClassesUnits: Map<string, Map<string, SchemaUnit>>
  private unitClassUnits: Map<string, SchemaUnit>

  public constructor(
    xmlCollection: HedSchemaXMLCollection,
    attributes: SchemaEntryManager<SchemaAttribute>,
    unitModifiers: SchemaEntryManager<SchemaUnitModifier>,
  ) {
    super(xmlCollection, attributes)
    this.unitModifiers = unitModifiers
  }

  protected override _preprocessSchemas(schemaXml: HedSchemaXMLCollection) {
    this.unitClassesUnits = new Map<string, Map<string, SchemaUnit>>()
    for (const schema of schemaXml) {
      this.parseUnits(schema)
    }
  }

  protected override _getDefinitions(schemaXml: HedSchemaXMLObject): Iterable<DefinitionElement> | undefined {
    return schemaXml.HED.unitClassDefinitions.unitClassDefinition
  }

  protected override _buildEntry(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
  ): SchemaUnitClass {
    return new SchemaUnitClass(
      name,
      description,
      booleanAttributes,
      valueAttributes,
      this.unitClassesUnits.get(name) ?? new Map<string, SchemaUnit>(),
    )
  }

  private parseUnits(schemaXml: HedSchemaXMLObject): void {
    const unitClassElements = schemaXml.HED.unitClassDefinitions.unitClassDefinition
    if (!unitClassElements) {
      return
    }
    for (const element of unitClassElements) {
      const elementName = getElementName(element)
      this.unitClassUnits = this.unitClassesUnits.get(elementName) ?? new Map<string, SchemaUnit>()
      if (element.unit === undefined) {
        continue
      }
      const [unitBooleanAttributeDefinitions, unitValueAttributeDefinitions, unitValueDescriptions] =
        this._parseAttributeElements(element.unit, getElementName)
      this._addInLibrary(schemaXml, unitValueAttributeDefinitions, (name) => this.unitClassUnits.has(name))
      for (const [name, valueAttributes] of unitValueAttributeDefinitions) {
        const booleanAttributes = unitBooleanAttributeDefinitions.get(name) ?? new Set<SchemaAttribute>()
        const description = unitValueDescriptions.get(name)
        this.addUnit(name, new SchemaUnit(name, description, booleanAttributes, valueAttributes, this.unitModifiers))
      }
      this.unitClassesUnits.set(elementName, this.unitClassUnits)
    }
  }

  /**
   * Add a new unit while checking for duplicates.
   *
   * @param newUnitName - The unit name.
   * @param newUnit - The new unit object to add.
   */
  private addUnit(newUnitName: string, newUnit: SchemaUnit): void {
    if (this.unitClassUnits.has(newUnitName)) {
      if (!newUnit.equivalent(this.unitClassUnits.get(newUnitName))) {
        IssueError.generateAndThrow('lazyPartneredSchemasShareEntry', { entryName: newUnitName })
      }
    } else {
      this.unitClassUnits.set(newUnitName, newUnit)
    }
  }
}
