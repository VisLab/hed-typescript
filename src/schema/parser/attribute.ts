import { getElementDescription, getElementName, type HedSchemaXMLCollection, type HedSchemaXMLObject } from '../xmlType'
import { getDefinitionElements, SchemaEntryParser } from './schemaEntry'
import type SchemaEntryManager from '../entries/schemaEntryManager'
import type SchemaProperty from '../entries/property'
import SchemaAttribute from '../entries/attribute'

export default class AttributeParser extends SchemaEntryParser<SchemaAttribute> {
  /**
   * The schema properties.
   */
  private readonly properties: SchemaEntryManager<SchemaProperty>

  /**
   * Constructor.
   *
   * @param xmlCollection - A collection of XML data for a given prefix.
   * @param properties - The parsed mapping of schema properties.
   */
  public constructor(xmlCollection: HedSchemaXMLCollection, properties: SchemaEntryManager<SchemaProperty>) {
    super(xmlCollection)
    this.properties = properties
  }

  /**
   * Parse attributes in a specific schema.
   *
   * @param schemaXml - The XML for a specific schema.
   */
  protected override _parseSchema(schemaXml: HedSchemaXMLObject): void {
    for (const definition of getDefinitionElements(schemaXml.HED, 'schemaAttribute')) {
      const attributeName = getElementName(definition)
      const attributeDescription = getElementDescription(definition)
      const propertyElements = definition.property ?? []
      const properties = propertyElements
        .map((element) => this.properties.getEntry(getElementName(element)))
        .filter((property) => property !== undefined)
      const isRecursive = this._determineAttributeRecursion(properties)
      this.addEntry(
        attributeName,
        new SchemaAttribute(attributeName, attributeDescription, new Set(properties), isRecursive),
      )
    }
  }

  /**
   * Determine whether a given list of properties infers that an attribute is recursive.
   *
   * @param properties - A list of properties held by an attribute being parsed.
   * @returns Whether the attribute is recursive.
   */
  private _determineAttributeRecursion(properties: SchemaProperty[]): boolean {
    const annotationProperty = this.properties.getEntry('annotationProperty')
    if (annotationProperty) {
      return !properties.includes(annotationProperty)
    }
    const isInheritedProperty = this.properties.getEntry('isInheritedProperty')
    if (isInheritedProperty) {
      return properties.includes(isInheritedProperty)
    }
    // The case of extensionAllowed will be handled by the SchemaAttribute constructor.
    return false
  }
}
