import SchemaEntry from './schemaEntry'
import type SchemaProperty from './property'

/**
 * A schema attribute.
 */
export default class SchemaAttribute extends SchemaEntry {
  /**
   * The set of all attribute names which are always recursive.
   */
  static readonly ALWAYS_RECURSIVE: Set<string> = new Set(['extensionAllowed'])

  /**
   * The properties assigned to this schema attribute.
   */
  readonly _properties: Set<SchemaProperty>

  /**
   * Whether this attribute is recursive.
   */
  readonly _recursive: boolean

  /**
   * Constructor.
   *
   * @param name - The name of the schema attribute.
   * @param description - The description of the schema attribute.
   * @param properties - The properties assigned to this schema attribute.
   * @param recursive - Whether this attribute is recursive.
   */
  constructor(name: string, description: string | undefined, properties: Set<SchemaProperty>, recursive: boolean) {
    super(name, description)
    this._properties = properties
    this._recursive = recursive || SchemaAttribute.ALWAYS_RECURSIVE.has(name)
  }

  /**
   * The collection of properties for this schema attribute.
   */
  public get properties(): Set<SchemaProperty> {
    return new Set(this._properties)
  }

  /**
   * Whether this attribute is recursive.
   */
  public get recursive(): boolean {
    return this._recursive
  }

  /**
   * Determine if this schema attribute is equivalent to another schema attribute.
   *
   * @remarks
   *
   * Schema attributes are equivalent if they have the same name, description, and property names. Properties are
   * compared by name, so attributes of two separately loaded schemas can be compared.
   *
   * @param other - A schema attribute to compare with this one.
   * @returns Whether the other attribute is equivalent to this schema attribute.
   */
  public override equivalent(other: unknown): boolean {
    if (!(other instanceof SchemaAttribute)) {
      return false
    }
    if (!super.equivalent(other)) {
      return false
    }
    const propertyNames = new Set([...this._properties].map((property) => property.name))
    const otherPropertyNames = new Set([...other._properties].map((property) => property.name))
    return propertyNames.symmetricDifference(otherPropertyNames).size === 0
  }
}
