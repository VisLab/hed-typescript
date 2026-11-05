import SchemaEntryWithAttributes from './schemaEntryWithAttributes'
import type SchemaAttribute from './attribute'
import { characterSets } from '../characterSets'

/**
 * Why a value fails a value class: a broken whole-value rule, or the characters the class does not allow.
 */
export type ValueClassProblem =
  { rule: true; characters?: undefined } | { rule?: undefined; characters: Array<[number, string]> }

/**
 * A schema value class.
 */
export default class SchemaValueClass extends SchemaEntryWithAttributes {
  /**
   * The character set names (character_sets.json) that define this class's characters; empty for no constraint.
   */
  public readonly allowedNames: string[]

  /**
   * The whole-value regular expression of this class (character_sets.json value_class_words), or null.
   */
  private readonly _wordRegex: RegExp | null

  /**
   * Constructor.
   *
   * @param name - The name of this value class.
   * @param description - The description of this value class.
   * @param booleanAttributes - The boolean attributes for this value class.
   * @param valueAttributes - The value attributes for this value class.
   * @param allowedNames - The character set names that define the class's characters.
   */
  constructor(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
    allowedNames: string[] = [],
  ) {
    super(name, description, booleanAttributes, valueAttributes)
    this.allowedNames = allowedNames
    this._wordRegex = characterSets.wordRule(name)
  }

  /**
   * Determine if a value is valid according to this value class.
   *
   * @param value - A HED value.
   * @returns Whether the value conforms to this value class.
   */
  public validateValue(value: string): boolean {
    return this.valueProblem(value) === null
  }

  /**
   * Say why a value fails this class, checking the whole-value rule before the characters, as hed-python does.
   *
   * @param value - A HED value.
   * @returns null if the value is valid; `{rule: true}` if it is empty or breaks the class's whole-value rule;
   *     otherwise the characters the class does not allow, as [index, character] pairs.
   */
  public valueProblem(value: string): ValueClassProblem | null {
    if (value === '' || (this._wordRegex !== null && !this._wordRegex.test(value))) {
      return { rule: true }
    }
    const characters = characterSets.problemCharacters(value, this.allowedNames)
    return characters.length > 0 ? { characters: characters } : null
  }

  /**
   * Determine if this schema value class is equivalent to another schema value class.
   *
   * @remarks
   *
   * Value classes are equivalent if they have the same name, description, attributes, and allowed characters (in
   * any order, as for the attribute values).
   *
   * @param other - A schema value class to compare with this one.
   * @returns Whether the other value class is equivalent to this schema value class.
   */
  public override equivalent(other: unknown): boolean {
    if (!(other instanceof SchemaValueClass)) {
      return false
    }
    if (!super.equivalent(other)) {
      return false
    }
    const sorted = (names: string[]): string => [...names].sort((a, b) => a.localeCompare(b)).join('\u0000')
    return sorted(this.allowedNames) === sorted(other.allowedNames)
  }
}
