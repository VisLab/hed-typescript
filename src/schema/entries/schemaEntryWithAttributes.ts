import SchemaEntry from './schemaEntry'
import type SchemaAttribute from './attribute'
import { IssueError } from '../../issues/issues'

/**
 * A generic schema entry with schema attributes.
 */
export default class SchemaEntryWithAttributes extends SchemaEntry {
  /**
   * The set of attribute names to ignore when checking for equality.
   */
  private static readonly IGNORED_ATTRIBUTES: Set<string> = new Set([
    'inLibrary', // Checked separately
    'hedId', // Will always differ
  ])
  /**
   * The set of boolean attributes this schema entry has.
   */
  readonly booleanAttributes: Set<SchemaAttribute>

  /**
   * The collection of value attributes this schema entry has.
   */
  readonly valueAttributes: Map<SchemaAttribute, string[]>

  /**
   * The set of boolean attribute names this schema entry has.
   */
  readonly booleanAttributeNames: Set<string>

  /**
   * The collection of value attribute names this schema entry has.
   */
  readonly valueAttributeNames: Map<string, string[]>

  constructor(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
  ) {
    super(name, description)
    this.booleanAttributes = booleanAttributes
    this.valueAttributes = valueAttributes
    this.booleanAttributeNames = new Set()
    for (const attribute of this.booleanAttributes) {
      this.booleanAttributeNames.add(attribute.name)
    }
    this.valueAttributeNames = new Map()
    for (const [attributeName, value] of this.valueAttributes) {
      this.valueAttributeNames.set(attributeName.name, value)
    }
  }

  /**
   * Determine if this schema entry is equivalent to another schema entry.
   *
   * @remarks
   *
   * Entries with attributes are equivalent if they have the same name, description, boolean attributes, and value
   * attributes (by name, values in any order), ignoring inLibrary and hedId. Attributes are compared by name, so
   * entries of two separately loaded schemas can be compared.
   *
   * @param other - A schema entry to compare with this one.
   * @returns Whether the other entry is equivalent to this schema entry.
   */
  public override equivalent(other: unknown): boolean {
    if (!(other instanceof SchemaEntryWithAttributes)) {
      return false
    }
    if (!super.equivalent(other)) {
      return false
    }
    if (this.booleanAttributeNames.symmetricDifference(other.booleanAttributeNames).size > 0) {
      return false
    }
    const compared = (entry: SchemaEntryWithAttributes): [string, string[]][] =>
      [...entry.valueAttributeNames].filter(([name]) => !SchemaEntryWithAttributes.IGNORED_ATTRIBUTES.has(name))
    const ours = compared(this)
    const theirs = new Map(compared(other))
    if (ours.length !== theirs.size) {
      return false
    }
    return ours.every(
      ([name, values]) => theirs.has(name) && SchemaEntryWithAttributes.sameValues(theirs.get(name)!, values),
    )
  }

  /**
   * Determine whether two lists of attribute values hold the same values in any order.
   *
   * @param first - The first list of values.
   * @param second - The second list of values.
   * @returns Whether the lists hold the same values.
   */
  private static sameValues(first: readonly string[], second: readonly string[]): boolean {
    if (first.length !== second.length) {
      return false
    }
    const sorted = (values: readonly string[]): string[] => [...values].map(String).sort((a, b) => a.localeCompare(b))
    const sortedFirst = sorted(first)
    const sortedSecond = sorted(second)
    return sortedFirst.every((value, index) => value === sortedSecond[index])
  }

  /**
   * Whether this schema entry has this attribute (by name).
   *
   * @param attributeName - The attribute to check for.
   * @returns Whether this schema entry has this attribute.
   */
  public hasAttribute(attributeName: string): boolean {
    return this.booleanAttributeNames.has(attributeName) || this.valueAttributeNames.has(attributeName)
  }

  /**
   * Whether this schema entry has this boolean attribute (by name).
   *
   * @param attributeName - The attribute to check for.
   * @returns Whether this schema entry has this attribute.
   */
  public override hasBooleanAttribute(attributeName: string): boolean {
    return this.booleanAttributeNames.has(attributeName)
  }

  /**
   * Retrieve a single value of a value attribute (by name) on this schema entry, throwing an error if more than one value exists.
   *
   * @param attributeName - The attribute whose value should be returned.
   * @returns The value of the attribute.
   * @throws {IssueError} If the attribute has more than one value.
   */
  public getSingleAttributeValue(attributeName: string): string | undefined {
    const attributeValues = this.valueAttributeNames.get(attributeName)
    if (attributeValues === undefined) {
      return undefined
    } else if (attributeValues.length > 1) {
      IssueError.generateAndThrowInternalError(
        `More than one value exists for attribute ${attributeName}, when only one value was expected.`,
      )
    }
    return attributeValues[0]
  }

  /**
   * Retrieve all values of a value attribute (by name) on this schema entry.
   *
   * @param attributeName - The attribute whose value should be returned.
   * @returns The values of the attribute.
   */
  public getAttributeValues(attributeName: string): string[] | undefined {
    return this.valueAttributeNames.get(attributeName)
  }
}
