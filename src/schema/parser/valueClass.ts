import semver from 'semver'

import { SchemaDefinitionEntryParser } from './schemaEntry'
import type { DefinitionElement, HedSchemaXMLCollection, HedSchemaXMLObject } from '../xmlType'

import { characterSets } from '../characterSets'
import type SchemaEntryManager from '../entries/schemaEntryManager'
import type SchemaAttribute from '../entries/attribute'
import SchemaValueClass from '../entries/valueClass'

export default class ValueClassParser extends SchemaDefinitionEntryParser<SchemaValueClass> {
  public constructor(xmlCollection: HedSchemaXMLCollection, attributes: SchemaEntryManager<SchemaAttribute>) {
    super(xmlCollection, attributes)
  }

  protected override _getDefinitions(schemaXml: HedSchemaXMLObject): Iterable<DefinitionElement> | undefined {
    return schemaXml.HED.valueClassDefinitions.valueClassDefinition
  }

  protected override _buildEntry(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
  ): SchemaValueClass {
    const allowedNames = this._allowedNames(name, valueAttributes)
    return new SchemaValueClass(name, description, booleanAttributes, valueAttributes, allowedNames)
  }

  /**
   * The character set names that define the characters of a value class (character_sets.json).
   *
   * From standard schema 8.5.0, and in libraries partnered with 8.5.0 or later, the class's own allowedCharacter
   * declaration defines it, provided every name is a set, an alias, or a single character. Before that the
   * file's value_class_defaults for the standard version define the standard classes, because their released
   * declarations are incomplete. A class the file has no defaults for (a library's own class) always follows its
   * declaration. This is hed-python's CharRexValidator.allowed_names.
   *
   * @param name - The value class name.
   * @param valueAttributes - The class's value attributes.
   * @returns The names; empty when nothing constrains the characters.
   */
  private _allowedNames(name: string, valueAttributes: Map<SchemaAttribute, string[]>): string[] {
    const standardVersion = this.xmlCollection.standardVersion || null
    const declarationWins = standardVersion !== null && !semver.lt(standardVersion, characterSets.declarationWinsFrom)
    const defaults = characterSets.defaultsFor(name, standardVersion)
    const allowedCharacter = this.attributes.getEntry('allowedCharacter')
    const declaredValues = allowedCharacter === undefined ? [] : (valueAttributes.get(allowedCharacter) ?? [])
    const declared = characterSets.declaredNames(declaredValues)
    if (declared.length > 0 && (declarationWins || defaults.length === 0)) {
      if (declared.every((declaredName) => characterSets.isKnownName(declaredName))) {
        return declared
      }
    }
    return defaults
  }
}
