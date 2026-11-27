export type NamedElement = { name: { _: string } }
export type DescribedElement = { description?: { _: string } }
export type AttributeValue = string | number
export type AttributeElement = NamedElement & { value?: { _: AttributeValue }[] }
export type DefinitionElement = NamedElement & DescribedElement & { attribute?: AttributeElement[] }
export type NodeElement = DefinitionElement & { node?: NodeElement[]; $parent?: NodeElement | null }
export type UnitClassElement = DefinitionElement & { unit: DefinitionElement[] }
export type SchemaAttributeElement = NamedElement & DescribedElement & { property: AttributeElement[] }
export type PropertyElement = NamedElement & DescribedElement

export type HedSchemaRootElement = {
  $: { version: string; library?: string; unmerged?: boolean; withStandard?: string }
  schema: { node: NodeElement[] }
  unitClassDefinitions: {
    unitClassDefinition?: UnitClassElement[]
  }
  unitModifierDefinitions: {
    unitModifierDefinition?: DefinitionElement[]
  }
  valueClassDefinitions: {
    valueClassDefinition?: DefinitionElement[]
  }
  schemaAttributeDefinitions: {
    schemaAttributeDefinition?: SchemaAttributeElement[]
  }
  propertyDefinitions: {
    propertyDefinition?: PropertyElement[]
  }
}

export type HedSchemaXMLObject = {
  HED: HedSchemaRootElement
}

export class HedSchemaXMLCollection {
  public readonly baseSchema: HedSchemaXMLObject
  public readonly mergedSchemas: HedSchemaXMLObject[]
  public readonly unmergedSchemas: HedSchemaXMLObject[]
  public readonly standardVersion: string

  constructor(
    baseSchema: HedSchemaXMLObject,
    standardVersion?: string,
    mergedSchemas?: HedSchemaXMLObject[],
    unmergedSchemas?: HedSchemaXMLObject[],
  ) {
    this.baseSchema = baseSchema
    this.standardVersion = standardVersion ?? ''
    this.mergedSchemas = mergedSchemas ?? []
    this.unmergedSchemas = unmergedSchemas ?? []
  }

  public *[Symbol.iterator](): Generator<HedSchemaXMLObject> {
    yield this.baseSchema
    yield* this.mergedSchemas
    yield* this.unmergedSchemas
  }
}

/**
 * Extract the name of an XML element.
 *
 * @param element - An XML element.
 * @returns The name of the element.
 */
export function getElementName(this: void, element: NamedElement): string {
  return element.name._
}

/**
 * Extract the description of an XML element.
 *
 * @param element - An XML element.
 * @returns The description of the element.
 */
export function getElementDescription(this: void, element: DescribedElement): string | undefined {
  return element.description?._
}
