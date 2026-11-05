/**
 * This module holds the class representing a parsed HED tag.
 * @module parser/parsedHedTag
 */

import ParsedHedSubstring from './parsedHedSubstring'
import { ReservedChecker } from './reservedChecker'
import TagConverter from './tagConverter'
import { type TagSpec } from './tokenizer'
import { IssueError } from '../issues/issues'
import { characterSets, codePoint } from '../schema/characterSets'
import { type HedSchema, type HedSchemas } from '../schema/containers'

import type SchemaTag from '../schema/entries/tag'
import SchemaValueTag from '../schema/entries/valueTag'
import type SchemaUnit from '../schema/entries/unit'
import type SchemaUnitClass from '../schema/entries/unitClass'

// The characters of a value whose placeholder declares no valueClass (character_sets.json; hed-python does the same).
const UNCLASSED_VALUE_SETS = ['value-text']

/**
 * Why a value is not valid for a tag: a VALUE_INVALID message, or the characters (index within the value) that the
 * first class rejecting only characters does not allow, with that class (subject) and its character set names.
 */
type ValueProblem =
  | { msg: string; characters?: undefined }
  | { msg?: undefined; characters: Array<[number, string]>; subject: string; names: string[] }

/**
 * A parsed HED tag.
 */
export default class ParsedHedTag extends ParsedHedSubstring {
  /**
   * The formatted canonical version of the HED tag.
   */
  formattedTag: string

  /**
   * The canonical form of the HED tag.
   */
  canonicalTag: string

  /**
   * The HED schema this tag belongs to.
   */
  schema: HedSchema

  /**
   * The schema's representation of this tag.
   */
  private _schemaTag: SchemaTag

  /**
   * The remaining part of the tag after the portion actually in the schema.
   */
  private _remainder: string

  /**
   * The value of the tag, if any.
   */
  private _value: string

  /**
   * If definition, this is the second value, otherwise empty string.
   */
  private _splitValue: string | null

  /**
   * The units if any.
   */
  private _units: string | null

  /**
   * The schema unit matching the units, if any.
   */
  private _unit: SchemaUnit | null

  /**
   * The normalized string representation of this tag.
   */
  private readonly _normalized: string

  /**
   * Constructor.
   *
   * @param tagSpec - The token for this tag.
   * @param hedSchemas - The collection of HED schemas.
   * @throws {IssueError} If tag conversion or parsing fails.
   */
  public constructor(tagSpec: TagSpec, hedSchemas: HedSchemas) {
    super(tagSpec.tag, tagSpec.bounds) // Sets originalTag and originalBounds
    this._convertTag(hedSchemas, tagSpec)
    this._normalized = this.format(false) // Sets various forms of the tag.
  }

  /**
   * Convert this tag to its various forms
   *
   * @param hedSchemas - The collection of HED schemas.
   * @param tagSpec - The token for this tag.
   * @throws {IssueError} If tag conversion or parsing fails.
   */
  private _convertTag(hedSchemas: HedSchemas, tagSpec: TagSpec): void {
    const schemaName = tagSpec.library
    const schema = hedSchemas.getSchema(schemaName)
    if (schema === undefined) {
      if (schemaName !== '') {
        IssueError.generateAndThrow('unmatchedLibrarySchema', {
          tag: this.originalTag,
          prefix: schemaName,
        })
      } else {
        IssueError.generateAndThrow('unmatchedBaseSchema', {
          tag: this.originalTag,
        })
      }
    }
    this.schema = schema

    const [schemaTag, remainder] = new TagConverter(tagSpec, hedSchemas).convert()
    this._schemaTag = schemaTag
    this._remainder = remainder
    this.canonicalTag = this._schemaTag.longExtend(remainder)
    this.formattedTag = this.canonicalTag.toLowerCase()
    this._handleRemainder(schemaTag, remainder)
  }

  /**
   * Handle the remainder portion for value tag (converter handles others).
   *
   * @param schemaTag - The part of the tag that is in the schema.
   * @param remainder - The leftover part.
   * @throws {IssueError} If parsing the remainder section fails.
   */
  private _handleRemainder(schemaTag: SchemaTag, remainder: string): void {
    if (!(schemaTag instanceof SchemaValueTag)) {
      return
    }
    // Check that there is a value if required
    const reserved = ReservedChecker.getInstance()
    if ((schemaTag.hasAttribute('requireChild') || reserved.requireValueTags.has(schemaTag.name)) && remainder === '') {
      IssueError.generateAndThrow('valueRequired', { tag: this.originalTag })
    }
    // Check if this could have a two-level value
    const [value, rest] = this._getSplitValue(remainder, reserved)
    this._splitValue = rest
    // After a Definition name only # may follow (specification 3.2.8.1, DEFINITION_INVALID l).
    if (ReservedChecker.valueForms.get(this.schemaTag.name)?.secondPart === 'placeholder' && rest && rest !== '#') {
      IssueError.generateAndThrow('invalidDefinition', {
        definition: this.originalTag,
        msg: `Only "#" may follow the definition name, not "${rest}".`,
      })
    }

    // Resolve the units and check
    const [actualUnit, actualUnitString, actualValueString] = this._separateUnits(schemaTag, value)
    this._unit = actualUnit
    this._units = actualUnitString
    this._value = actualValueString

    if (actualUnit === null && actualUnitString !== null) {
      IssueError.generateAndThrow('unitClassInvalidUnit', { tag: this.originalTag })
    }
    const problem = this._findValueProblem(actualValueString)
    if (problem?.characters) {
      // The index is within the tag as written: the value starts where it does in the remainder.
      const valueStart = this.originalTag.length - remainder.length + remainder.indexOf(actualValueString)
      const [index, character] = problem.characters[0]
      IssueError.generateAndThrow('invalidValueCharacter', {
        character: character,
        codePoint: codePoint(character),
        index: valueStart + index,
        tag: this.originalTag,
        allows: `${problem.subject} allows ${characterSets.describe(problem.names)}`,
        charSet: problem.names.join(', '),
      })
    } else if (problem) {
      IssueError.generateAndThrow('invalidValue', { tag: this.originalTag, msg: problem.msg })
    }
  }

  /**
   * Separate the remainder of the tag into three parts.
   *
   * @param schemaTag - The part of the tag that is in the schema.
   * @param remainder - The leftover part.
   * @returns A tuple representing the actual Unit, the unit string and the value string.
   * @throws {IssueError} If parsing the remainder section fails.
   */
  private _separateUnits(schemaTag: SchemaTag, remainder: string): [SchemaUnit | null, string | null, string] {
    const unitClasses = this._expandUnitClasses(schemaTag.unitClasses)
    let actualUnit: SchemaUnit | null = null
    let actualUnitString: string | null = null
    let actualValueString = remainder // If no unit class, the remainder is the value
    // A unit listed outright in some class wins over one another class only derives: with several classes
    // (unitClass=anyUnits) "dB" is the listed decibel, not "d" + "B" (byte).
    for (const listedOnly of [true, false]) {
      for (const unitClass of unitClasses) {
        ;[actualUnit, actualUnitString, actualValueString] = unitClass.extractUnit(remainder, listedOnly)
        if (actualUnit !== null) {
          return [actualUnit, actualUnitString, actualValueString]
        }
      }
    }
    return [actualUnit, actualUnitString, actualValueString]
  }

  /**
   * Expand the anyUnits pseudo class (HED 8.5.0) to every unit class of this tag's schema.
   *
   * @param unitClasses - The unit classes of the schema tag.
   * @returns The unit classes to search, in schema order.
   */
  private _expandUnitClasses(unitClasses: SchemaUnitClass[]): SchemaUnitClass[] {
    if (!unitClasses.some((unitClass) => unitClass.name === 'anyUnits')) {
      return unitClasses
    }
    const expanded = unitClasses.filter((unitClass) => unitClass.name !== 'anyUnits')
    for (const unitClass of this.schema.entries.unitClasses.values()) {
      if (unitClass.name !== 'anyUnits' && !expanded.includes(unitClass)) {
        expanded.push(unitClass)
      }
    }
    return expanded
  }

  /**
   * Convert this tag's value to the default unit of its unit class.
   *
   * @remarks
   *
   * A value written without a unit is taken to be in the default unit already; a numeric value of a tag
   * that has no unit class is returned unchanged. A placeholder with unitClass=anyUnits has no default unit,
   * so its value converts only when a unit is written.
   *
   * In a unit class none of whose units has a conversionFactor (timeUnits in HED 8.0.0), an unmodified form of
   * the default unit or of an SI unit of the class (s, second, seconds) converts with factor 1 (specification
   * 3.2.8.4); a modified form (ms) or another unit (minute) does not convert.
   *
   * @returns The value in default units, or null if the tag takes no value, the value is not numeric, the unit is
   *     invalid, the unit has no conversionFactor (such as month or year), or the value is a bare number on an
   *     anyUnits placeholder.
   */
  public valueAsDefaultUnit(): number | null {
    const takesValueTag = this.takesValueTag
    if (takesValueTag === undefined || this._value === undefined || this._value === null) {
      return null
    }
    const value = Number(this._value)
    if (this._value === '' || !Number.isFinite(value)) {
      return null
    }
    if (this._units === null) {
      const acceptsAnyUnits = takesValueTag.unitClasses.some((unitClass) => unitClass.name === 'anyUnits')
      return acceptsAnyUnits ? null : value
    }
    const factor = this._unit?.conversionFactor(this._units) ?? null
    if (factor !== null) {
      return value * factor
    }
    return this._isUnconvertedBaseUnit() ? value : null
  }

  /**
   * Determine whether this tag's unit is a base unit of a unit class that defines no conversion factors.
   *
   * @returns True if no unit of the unit class holding this tag's unit has a conversionFactor and the unit is
   *     written unmodified as the default unit or, when the default unit is itself an SI unit, as an SI unit of
   *     that class (its other spelling: second beside s). A class whose default is not SI, such as intensityUnits
   *     with default dB beside candela and cd, accepts only the default unit.
   */
  private _isUnconvertedBaseUnit(): boolean {
    const unit = this._unit
    const takesValueTag = this.takesValueTag
    if (unit === null || takesValueTag === undefined || this._units === null) {
      return false
    }
    const unitClass = this._expandUnitClasses(takesValueTag.unitClasses).find(
      (candidate) => candidate.units.get(unit.name) === unit,
    )
    if (unitClass === undefined || unitClass.hasConversionFactors) {
      return false
    }
    const defaultUnit = unitClass.defaultUnit
    const isBaseUnit = unit === defaultUnit || (defaultUnit?.isSIUnit === true && unit.isSIUnit)
    return isBaseUnit && unit.isUnmodifiedForm(this._units)
  }

  /**
   * Split the value of a tag whose value has two parts (the valueForms of the reserved-tag file).
   *
   * @param remainder - The remainder of the tag string after schema tag.
   * @param reserved - The reserved-tag checker.
   * @returns The name and the part after it, or the remainder and null for other tags.
   */
  private _getSplitValue(remainder: string, reserved: ReservedChecker): [string, string | null] {
    if (!reserved.twoPartValueTags.has(this.schemaTag.name)) {
      return [remainder, null]
    }
    const [first, ...rest] = remainder.split('/')
    return [first, rest.join('/')]
  }

  /**
   * Nicely format this tag.
   *
   * @param long - Whether the tags should be in long form.
   * @returns The nicely formatted version of this tag.
   */
  public format(long: boolean = true): string {
    let tagName
    if (long) {
      tagName = this._schemaTag?.longExtend(this._remainder)
    } else {
      tagName = this._schemaTag?.extend(this._remainder)
    }
    if (tagName === undefined) {
      tagName = this.originalTag
    }
    if (this.schema?.prefix) {
      return this.schema.prefix + ':' + tagName
    } else {
      return tagName
    }
  }

  /**
   * Return the normalized version of this tag.
   *
   * @returns The normalized version of this tag.
   */
  public get normalized(): string {
    return this._normalized
  }

  public get remainder(): string {
    return this._remainder
  }

  public get splitValue(): string | null {
    return this._splitValue
  }

  public get value(): string {
    return this._value
  }

  /**
   * Override of {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/toString | Object.prototype.toString}.
   *
   * @returns The original form of this HED tag.
   */
  public override toString(): string {
    if (this.schema?.prefix) {
      return this.schema.prefix + ':' + this.originalTag
    } else {
      return this.originalTag
    }
  }

  /**
   * Determine whether this tag has a given attribute.
   *
   * @param attribute - An attribute name.
   * @returns Whether this tag has the named attribute.
   */
  public hasAttribute(attribute: string): boolean {
    return this.schemaTag.hasAttribute(attribute)
  }

  /**
   * Determine if this HED tag is equivalent to another HED tag.
   *
   * @remarks
   *
   * HED tags are deemed equivalent if they have the same schema and normalized tag string.
   *
   * @param other - A HED tag to compare with this one.
   * @returns Whether the other tag is equivalent to this HED tag.
   */
  public equivalent(other: unknown): boolean {
    return other instanceof ParsedHedTag && this.formattedTag === other.formattedTag && this.schema === other.schema
  }

  /**
   * Get the schema tag object for this tag.
   *
   * @returns The schema tag object for this tag.
   */
  public get schemaTag(): SchemaTag {
    if (this._schemaTag instanceof SchemaValueTag) {
      return this._schemaTag.parent
    } else {
      return this._schemaTag
    }
  }

  /**
   * Indicates whether the tag is deprecated.
   */
  public get isDeprecated(): boolean {
    return this.schemaTag.hasAttribute('deprecatedFrom')
  }

  /**
   * Indicates whether the tag is extended.
   */
  public get isExtended(): boolean {
    return !this.takesValueTag && this._remainder !== ''
  }

  /**
   * Get the schema tag object for this tag's value-taking form.
   *
   * @returns The schema tag object for this tag's value-taking form.
   */
  public get takesValueTag(): SchemaValueTag | undefined {
    if (this._schemaTag instanceof SchemaValueTag) {
      return this._schemaTag
    }
    return undefined
  }

  /**
   * Checks if this HED tag has the `takesValue` attribute.
   *
   * @returns Whether this HED tag has the `takesValue` attribute.
   */
  public get takesValue(): boolean {
    return this.takesValueTag !== undefined
  }

  /**
   * Checks if this HED tag has the `unitClass` attribute.
   *
   * @returns Whether this HED tag has the `unitClass` attribute.
   */
  public get hasUnitClass(): boolean {
    return this.hasAttribute('unitClass')
  }

  /**
   * Get the unit classes for this HED tag.
   *
   * @returns The unit classes for this HED tag.
   */
  public get unitClasses(): SchemaUnitClass[] {
    if (this.hasUnitClass) {
      return this.takesValueTag?.unitClasses ?? []
    }
    return []
  }

  /**
   * Check if value is a valid value for this tag.
   *
   * @param value - The value to be checked.
   * @returns An empty string if value is value, otherwise an indication of failure.
   */
  public checkValue(value: string): string {
    const problem = this._findValueProblem(value)
    if (problem === null) {
      return ''
    }
    if (problem.characters) {
      const [index, character] = problem.characters[0]
      return `Character "${character}" (${codePoint(character)}) at index ${index} of value "${value}" is not allowed: ${problem.subject} allows ${characterSets.describe(problem.names)}.`
    }
    return problem.msg
  }

  /**
   * Find why a value is not valid for this tag, as hed-python's _check_value_class does.
   *
   * @remarks
   *
   * A value passes when any of the tag's value classes accepts it. Each class checks its whole-value rule
   * (numericClass, dateTimeClass) before its characters: a broken rule is VALUE_INVALID, a character the class
   * does not allow is CHARACTER_INVALID. A value whose placeholder declares no value class may use value-text.
   *
   * @param value - The value to be checked.
   * @returns null if the value is valid; `{msg}` for a VALUE_INVALID failure; otherwise the characters (index within
   *     the value) of the first class that rejected only characters, with the class (subject) and its character set
   *     names.
   */
  private _findValueProblem(value: string): ValueProblem | null {
    const takesValueTag = this.takesValueTag
    if (takesValueTag === undefined) {
      return { msg: `Tag "${this.schemaTag.name}" does not take a value but has value "${value}"` }
    }
    if (value === '#') {
      // Placeholders work
      return null
    }
    const valueClasses = takesValueTag.valueClasses
    if (valueClasses.length === 0) {
      const characters = characterSets.problemCharacters(value, UNCLASSED_VALUE_SETS)
      if (characters.length === 0) {
        return null
      }
      return { characters: characters, subject: 'a value with no value class', names: UNCLASSED_VALUE_SETS }
    }
    let characterProblem: ValueProblem | null = null
    for (const valueClass of valueClasses) {
      const problem = valueClass.valueProblem(value)
      if (problem === null) {
        return null
      }
      if (problem.characters && characterProblem === null) {
        characterProblem = { characters: problem.characters, subject: valueClass.name, names: valueClass.allowedNames }
      }
    }
    if (characterProblem !== null) {
      return characterProblem
    }
    const valueClassNames = valueClasses.map((valueClass) => valueClass.name)
    return {
      msg: `Tag "${this.schemaTag.name}" has value classes [${valueClassNames.join(', ')}] but its value "${value}" is not in any of them.`,
    }
  }
}
