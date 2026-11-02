import type SchemaEntry from '../entries/schemaEntry'
import SchemaEntryManager from '../entries/schemaEntryManager'
import type SchemaEntryWithAttributes from '../entries/schemaEntryWithAttributes'
import type SchemaAttribute from '../entries/attribute'
import {
  getElementName,
  type DefinitionElement,
  type NamedElement,
  type HedSchemaXMLCollection,
  type HedSchemaXMLObject,
  getElementDescription,
} from '../xmlType'

import { IssueError } from '../../issues/issues'

/**
 * A parser for a specific {@link SchemaEntry} subtype.
 *
 * @typeParam T - The subclass of {@link SchemaEntry} the implementation parses.
 */
export abstract class SchemaEntryParser<T extends SchemaEntry> {
  /**
   * The collection of XML data for a given prefix.
   */
  protected readonly xmlCollection: HedSchemaXMLCollection

  /**
   * The map of names to entry objects for this entry type.
   */
  protected readonly entryTypeMap: Map<string, T>

  /**
   * Constructor.
   *
   * @param xmlCollection - A collection of XML data for a given prefix.
   */
  protected constructor(xmlCollection: HedSchemaXMLCollection) {
    this.xmlCollection = xmlCollection
    this.entryTypeMap = new Map<string, T>()
  }

  /**
   * Parse this entry type across all schemas in the collection.
   *
   * @returns An entry manager for this entry type.
   * @internal
   */
  public parse(): SchemaEntryManager<T> {
    this._preprocessSchemas(this.xmlCollection)
    for (const schema of this.xmlCollection) {
      this._parseSchema(schema)
    }
    this._addCustomEntries()
    return new SchemaEntryManager(this.entryTypeMap)
  }

  /**
   * Add a new entry while checking for duplicates.
   *
   * @param newEntryName - The entry name.
   * @param newEntry - The new entry object to add.
   */
  protected addEntry(newEntryName: string, newEntry: T): void {
    if (this.entryTypeMap.has(newEntryName)) {
      if (!newEntry.equivalent(this.entryTypeMap.get(newEntryName))) {
        IssueError.generateAndThrow('lazyPartneredSchemasShareEntry', { entryName: newEntryName })
      }
    } else {
      this.entryTypeMap.set(newEntryName, newEntry)
    }
  }

  /**
   * Preprocess the schema collection.
   *
   * @param schemaXml - The XML collection.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _preprocessSchemas(schemaXml: HedSchemaXMLCollection): void {}

  /**
   * Parse this entry type for a specific schema.
   *
   * @param schemaXml - The XML for a specific schema.
   */
  protected abstract _parseSchema(schemaXml: HedSchemaXMLObject): void

  /**
   * Add any custom entries required by the platform to support old versions.
   */
  protected _addCustomEntries(): void {}
}

export abstract class SchemaEntryWithAttributesParser<
  T extends SchemaEntryWithAttributes,
> extends SchemaEntryParser<T> {
  protected readonly attributes: SchemaEntryManager<SchemaAttribute>

  protected constructor(xmlCollection: HedSchemaXMLCollection, attributes: SchemaEntryManager<SchemaAttribute>) {
    super(xmlCollection)
    this.attributes = attributes
  }

  protected _parseDefinitions(
    definitionElements: Iterable<DefinitionElement>,
  ): [Map<string, Set<SchemaAttribute>>, Map<string, Map<SchemaAttribute, string[]>>, Map<string, string | undefined>] {
    return this._parseAttributeElements(definitionElements, getElementName)
  }

  protected _parseAttributeElements(
    elements: Iterable<DefinitionElement>,
    namer: (element: NamedElement) => string,
  ): [Map<string, Set<SchemaAttribute>>, Map<string, Map<SchemaAttribute, string[]>>, Map<string, string | undefined>] {
    const booleanAttributeDefinitions = new Map<string, Set<SchemaAttribute>>()
    const valueAttributeDefinitions = new Map<string, Map<SchemaAttribute, string[]>>()
    const descriptions = new Map<string, string | undefined>()

    for (const element of elements) {
      const [booleanAttributes, valueAttributes] = this._parseAttributeElement(element)

      const elementName = namer(element)
      booleanAttributeDefinitions.set(elementName, booleanAttributes)
      valueAttributeDefinitions.set(elementName, valueAttributes)
      descriptions.set(elementName, getElementDescription(element))
    }

    return [booleanAttributeDefinitions, valueAttributeDefinitions, descriptions]
  }

  private _parseAttributeElement(element: DefinitionElement): [Set<SchemaAttribute>, Map<SchemaAttribute, string[]>] {
    const booleanAttributes = new Set<SchemaAttribute>()
    const valueAttributes = new Map<SchemaAttribute, string[]>()

    const tagAttributes = element.attribute ?? []

    for (const tagAttribute of tagAttributes) {
      const attributeName = getElementName(tagAttribute)
      const attribute = this.attributes.getEntry(attributeName)
      if (!attribute) {
        IssueError.generateAndThrow('invalidSchema', { error: 'Referenced schema attribute was not found' })
      }
      if (tagAttribute.value === undefined) {
        booleanAttributes.add(attribute)
        continue
      }
      const values = tagAttribute.value.map((value) => value._.toString())
      valueAttributes.set(attribute, values)
    }

    return [booleanAttributes, valueAttributes]
  }

  /**
   * Give the elements of an unmerged library schema the inLibrary attribute that its merged file carries.
   *
   * @remarks
   * An unmerged file holds only its library's elements, except that it may name an element of an earlier schema of the
   * group again to extend it (a partner unit class it adds units to); such an element keeps its declarer.
   *
   * @param schemaXml - The XML of the schema being parsed.
   * @param valueAttributeDefinitions - The value attributes by name, modified in place.
   * @param isDeclared - Whether an earlier schema of the group declared the named element.
   */
  protected _addInLibrary(
    schemaXml: HedSchemaXMLObject,
    valueAttributeDefinitions: Map<string, Map<SchemaAttribute, string[]>>,
    isDeclared: (name: string) => boolean,
  ): void {
    const library = schemaXml.HED.$.library
    const inLibrary = this.attributes.getEntry('inLibrary')
    if (schemaXml.HED.$.unmerged === undefined || library === undefined || inLibrary === undefined) {
      return
    }
    for (const [name, valueAttributes] of valueAttributeDefinitions) {
      if (!isDeclared(name) && !valueAttributes.has(inLibrary)) {
        valueAttributes.set(inLibrary, [library])
      }
    }
  }
}

export abstract class SchemaDefinitionEntryParser<
  T extends SchemaEntryWithAttributes,
> extends SchemaEntryWithAttributesParser<T> {
  protected override _parseSchema(schemaXml: HedSchemaXMLObject): void {
    const definitions = this._getDefinitions(schemaXml)
    if (!definitions) {
      return
    }
    const [booleanAttributeDefinitions, valueAttributeDefinitions, descriptions] = this._parseDefinitions(definitions)
    this._addInLibrary(schemaXml, valueAttributeDefinitions, (name) => this.entryTypeMap.has(name))
    for (const [name, valueAttributes] of valueAttributeDefinitions) {
      const booleanAttributes = booleanAttributeDefinitions.get(name) ?? new Set<SchemaAttribute>()
      const description = descriptions.get(name)
      this.addEntry(name, this._buildEntry(name, description, booleanAttributes, valueAttributes))
    }
  }

  protected abstract _getDefinitions(schemaXml: HedSchemaXMLObject): Iterable<DefinitionElement> | undefined

  protected abstract _buildEntry(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
  ): T
}
