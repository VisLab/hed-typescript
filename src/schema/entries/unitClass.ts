import SchemaEntryWithAttributes from './schemaEntryWithAttributes'
import type SchemaUnit from './unit'
import type SchemaAttribute from './attribute'

/**
 * A schema unit class.
 */
export default class SchemaUnitClass extends SchemaEntryWithAttributes {
  /**
   * The units for this unit class.
   */
  private readonly _units: Map<string, SchemaUnit>

  /**
   * Constructor.
   *
   * @param name - The name of this unit class.
   * @param description - The description of this unit class.
   * @param booleanAttributes - The boolean attributes for this unit class.
   * @param valueAttributes - The value attributes for this unit class.
   * @param units - The units for this unit class.
   */
  constructor(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
    units: Map<string, SchemaUnit>,
  ) {
    super(name, description, booleanAttributes, valueAttributes)
    this._units = units
  }

  /**
   * Get the units for this unit class.
   */
  public get units(): Map<string, SchemaUnit> {
    return new Map(this._units)
  }

  /**
   * Get the default unit for this unit class.
   *
   * @remarks
   *
   * A listed unit wins; otherwise the unit that the default derives from (A for mA, Ohm for kOhm) is matched.
   */
  public get defaultUnit(): SchemaUnit | undefined {
    const attributeValue = this.getSingleAttributeValue('defaultUnits')
    if (attributeValue === undefined) {
      return undefined
    }
    return (
      this._units.get(attributeValue) ?? [...this._units.values()].find((unit) => unit.validateUnit(attributeValue))
    )
  }

  /**
   * Whether any unit of this unit class has a conversionFactor (none of the timeUnits of HED 8.0.0 does).
   */
  public get hasConversionFactors(): boolean {
    return [...this._units.values()].some((unit) => unit.hasAttribute('conversionFactor'))
  }

  /**
   * Determine if this schema unit class is equivalent to another schema unit class.
   *
   * @remarks
   *
   * Schema unit classes are deemed equivalent if they have the same name and equivalent attributes.
   *
   * @param other - A schema unit class to compare with this one.
   * @returns Whether the other unit class is equivalent to this schema unit class.
   */
  public override equivalent(other: unknown): boolean {
    if (!(other instanceof SchemaUnitClass)) {
      return false
    }
    return super.equivalent(other)
  }

  /**
   * Extract the unit class and remainder.
   *
   * @param value - The value part of a tag, possibly ending in a unit.
   * @param listedOnly - Whether to match only unit names as listed in the schema (no plurals or modifiers).
   * @returns A tuple with the unit, unit string, and value string.
   */
  public extractUnit(value: string, listedOnly: boolean = false): [SchemaUnit | null, string | null, string] {
    let actualUnit = null // The Unit class of the value
    let actualValueString // The actual value part of the value
    let actualUnitString
    let lastPart
    let firstPart
    const index = value.indexOf(' ')
    if (index !== -1) {
      lastPart = value.slice(index + 1)
      firstPart = value.slice(0, index)
    } else {
      // no blank -- there are no units
      return [null, null, value]
    }
    actualValueString = firstPart
    actualUnitString = lastPart
    for (const unit of this._units.values()) {
      if (!unit.isPrefixUnit && (listedOnly ? lastPart === unit.name : unit.validateUnit(lastPart))) {
        // Checking if it is non-prefixed unit
        actualValueString = firstPart
        actualUnitString = lastPart
        actualUnit = unit
        break
      } else if (!unit.isPrefixUnit) {
        continue
      }
      if (unit.validateUnit(firstPart)) {
        actualUnit = unit
        actualValueString = value.substring(unit.name.length + 1)
        actualUnitString = unit.name
        break
      }
      // If it got here, can only be a prefix Unit
    }
    return [actualUnit, actualUnitString, actualValueString]
  }
}
