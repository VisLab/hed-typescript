import pluralize from 'pluralize'
pluralize.addUncountableRule('hertz')

import SchemaEntryWithAttributes from './schemaEntryWithAttributes'
import type SchemaAttribute from './attribute'
import type SchemaUnitModifier from './unitModifier'
import type SchemaEntryManager from './schemaEntryManager'

/**
 * One component of a compound SI unit such as m-per-s^2.
 */
interface CompoundComponent {
  /**
   * The component's unit name without its exponent.
   */
  base: string

  /**
   * The component's exponent (1 when none is written).
   */
  exponent: number

  /**
   * The component as written in the unit name.
   */
  text: string
}

/**
 * A schema unit.
 */
export default class SchemaUnit extends SchemaEntryWithAttributes {
  /**
   * The legal derivatives of this unit (non-compound units only): the name, its plural, and modified forms.
   */
  private _derivativeUnits: string[]

  /**
   * The SI modifiers this unit accepts, mapped to their conversion factors (null if a modifier has none).
   */
  private _modifierFactors: Map<string, number | null>

  /**
   * The components of a compound SI unit such as m-per-s^2, or null for every other unit.
   */
  private _compoundComponents: CompoundComponent[] | null

  /**
   * Constructor.
   *
   * @param name - The name of this unit.
   * @param description - The description of this unit.
   * @param booleanAttributes - This unit's boolean attributes.
   * @param valueAttributes - This unit's key-value attributes.
   * @param unitModifiers - The collection of unit modifiers (of every schema in the merge group, since units are
   *     built after the unit modifiers have been merged).
   */
  constructor(
    name: string,
    description: string | undefined,
    booleanAttributes: Set<SchemaAttribute>,
    valueAttributes: Map<SchemaAttribute, string[]>,
    unitModifiers: SchemaEntryManager<SchemaUnitModifier>,
  ) {
    super(name, description, booleanAttributes, valueAttributes)
    this._buildForms(unitModifiers)
  }

  /**
   * Build the accepted forms of this unit from the collection of unit modifiers.
   *
   * @param unitModifiers - The collection of unit modifiers.
   */
  private _buildForms(unitModifiers: SchemaEntryManager<SchemaUnitModifier>): void {
    this._derivativeUnits = [this.name]
    this._modifierFactors = new Map()
    this._compoundComponents = null
    if (!this.isSIUnit) {
      this._pushPluralUnit()
      return
    }
    const modifierAttribute = this.isUnitSymbol ? 'SIUnitSymbolModifier' : 'SIUnitModifier'
    for (const [modifierName, modifier] of unitModifiers.getEntriesWithBooleanAttribute(modifierAttribute)) {
      this._modifierFactors.set(modifierName, SchemaUnit._parseFactor(modifier))
    }
    this._compoundComponents = this._parseCompoundComponents()
    if (this._compoundComponents !== null) {
      // A compound unit takes one modifier per component and is matched by validateUnit, not from a list.
      return
    }
    const pluralUnit = this._pushPluralUnit()
    for (const modifierName of this._modifierFactors.keys()) {
      this._derivativeUnits.push(modifierName + this.name)
      if (pluralUnit !== null) {
        this._derivativeUnits.push(modifierName + pluralUnit)
      }
    }
  }

  /**
   * Parse the conversionFactor attribute of a unit or unit modifier.
   *
   * @param entry - A unit or unit modifier.
   * @returns The factor, or null if the entry has none or it is not a number.
   */
  private static _parseFactor(entry: SchemaEntryWithAttributes): number | null {
    const text = entry.getSingleAttributeValue('conversionFactor')
    if (text === undefined) {
      return null
    }
    // Schemas write factors as decimals (0.001), in e-notation (1e-6), or as powers (10^-6).
    const [base, exponent, ...extra] = String(text).split('^')
    const factor = exponent === undefined ? Number(base) : Number(base) ** Number(exponent)
    return extra.length === 0 && Number.isFinite(factor) ? factor : null
  }

  /**
   * Split a compound SI unit name (one containing "-per-" or "^") into its components.
   *
   * @returns One entry per component in name order (the first is the numerator, the rest are denominators), or
   *     null if this is not a compound unit.
   */
  private _parseCompoundComponents(): CompoundComponent[] | null {
    if (!this.name.includes('-per-') && !this.name.includes('^')) {
      return null
    }
    const components: CompoundComponent[] = []
    for (const text of this.name.split('-per-')) {
      const [base, exponentText, ...extra] = text.split('^')
      if (base === '' || extra.length > 0) {
        return null
      }
      const exponent = exponentText === undefined ? 1 : Number(exponentText)
      if (!Number.isInteger(exponent)) {
        return null
      }
      components.push({ base: base, exponent: exponent, text: text })
    }
    return components
  }

  /**
   * Match a unit string against this compound unit, allowing one SI modifier per component.
   *
   * @param value - The unit string.
   * @returns The modifier used for each component ('' for none), or null if no match.
   */
  private _matchCompound(value: string): string[] | null {
    const components = this._compoundComponents
    if (components === null) {
      return null
    }
    const parts = value.split('-per-')
    if (parts.length !== components.length) {
      return null
    }
    const modifiers: string[] = []
    for (const [index, part] of parts.entries()) {
      const expected = components[index].text
      if (!part.endsWith(expected)) {
        return null
      }
      const modifier = part.slice(0, part.length - expected.length)
      if (modifier !== '' && !this._modifierFactors.has(modifier)) {
        return null
      }
      modifiers.push(modifier)
    }
    return modifiers
  }

  /**
   * Add the plural of this unit's name to its derivatives, unless the unit is a symbol.
   *
   * @returns The plural, or null for a unit symbol.
   */
  private _pushPluralUnit(): string | null {
    if (!this.isUnitSymbol) {
      const pluralUnit = pluralize.plural(this.name)
      this._derivativeUnits.push(pluralUnit)
      return pluralUnit
    }
    return null
  }

  /**
   * The legal derivatives of this unit.
   *
   * @returns A generator yielding each derivative unit string.
   */
  public *derivativeUnits(): Generator<string, void, void> {
    for (const unit of this._derivativeUnits) {
      yield unit
    }
  }

  public get isPrefixUnit(): boolean {
    return this.hasAttribute('unitPrefix')
  }

  public get isSIUnit(): boolean {
    return this.hasAttribute('SIUnit')
  }

  public get isUnitSymbol(): boolean {
    return this.hasAttribute('unitSymbol')
  }

  /**
   * Determine if this schema unit is equivalent to another schema unit.
   *
   * @remarks
   *
   * Schema units are deemed equivalent if they have the same name and equivalent attributes.
   *
   * @param other - A schema unit to compare with this one.
   * @returns Whether the other unit is equivalent to this schema unit.
   */
  public override equivalent(other: unknown): boolean {
    if (!(other instanceof SchemaUnit)) {
      return false
    }
    return super.equivalent(other)
  }

  /**
   * Determine if a value has this unit.
   *
   * @param value - Either the whole value or the part after a blank (if not a prefix unit)
   * @returns Whether the value has these units.
   */
  public validateUnit(value: string): boolean {
    if (value == null || value === '') {
      return false
    }
    if (this.isPrefixUnit) {
      return value.startsWith(this.name)
    }
    if (this._compoundComponents !== null) {
      return this._matchCompound(value) !== null
    }
    for (const dUnit of this.derivativeUnits()) {
      if (value === dUnit) {
        return true
      }
    }
    return false
  }

  /**
   * Get the factor that converts a value given in a form of this unit to the unit class's base unit.
   *
   * @param value - A unit string accepted by validateUnit.
   * @returns The conversion factor, or null if this unit has no conversionFactor, the string is not a form of this
   *     unit, or a modifier used has no conversionFactor.
   */
  public conversionFactor(value: string): number | null {
    const baseFactor = SchemaUnit._parseFactor(this)
    if (baseFactor === null || !this.validateUnit(value)) {
      return null
    }
    const modifierFactor =
      this._compoundComponents === null ? this._simpleModifierFactor(value) : this._compoundModifierFactor(value)
    return modifierFactor === null ? null : baseFactor * modifierFactor
  }

  /**
   * Get the combined factor of the modifiers in a form of this compound unit.
   *
   * @param value - A unit string accepted by validateUnit.
   * @returns The factor (1 when no modifier is used), or null if a modifier used has no factor.
   */
  private _compoundModifierFactor(value: string): number | null {
    const components = this._compoundComponents
    const modifiers = this._matchCompound(value)
    if (components === null || modifiers === null) {
      return null
    }
    let factor = 1
    for (const [index, modifier] of modifiers.entries()) {
      if (modifier === '') {
        continue
      }
      const modifierFactor = this._modifierFactors.get(modifier)
      if (modifierFactor === null || modifierFactor === undefined) {
        return null
      }
      const exponent = components[index].exponent
      factor *= modifierFactor ** (index === 0 ? exponent : -exponent)
    }
    return factor
  }

  /**
   * Get the factor of the modifier in a form of this non-compound unit.
   *
   * @param value - A unit string accepted by validateUnit.
   * @returns The factor (1 when no modifier is used), or null if the modifier used has no factor.
   */
  private _simpleModifierFactor(value: string): number | null {
    const plainForms = this._plainForms()
    if (this.isPrefixUnit || plainForms.includes(value)) {
      return 1
    }
    const modifier = [...this._modifierFactors.keys()].find(
      (name) => value.startsWith(name) && plainForms.includes(value.slice(name.length)),
    )
    return modifier === undefined ? null : (this._modifierFactors.get(modifier) ?? null)
  }

  /**
   * Determine whether a unit string is this unit written without an SI modifier.
   *
   * @param value - A unit string.
   * @returns True if the string is this unit's name (a compound unit such as m-per-s included) or, for a unit that
   *     is not a symbol, its plural.
   */
  public isUnmodifiedForm(value: string): boolean {
    if (value === this.name) {
      return true
    }
    return this._compoundComponents === null && this._plainForms().includes(value)
  }

  /**
   * The forms of this non-compound unit without a modifier: the name and, unless it is a symbol, its plural.
   *
   * @returns The unmodified forms.
   */
  private _plainForms(): string[] {
    return this.isUnitSymbol ? [this.name] : [this.name, this._derivativeUnits[1]]
  }
}
