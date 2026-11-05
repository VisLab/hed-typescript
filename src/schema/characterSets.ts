/** The HED character sets of specification section 2.2, loaded from the specification's own file.
 *
 * src/data/json/characterSets.json is a verbatim copy of the character_sets.json that the HED specification
 * publishes (docs/source/_static/character_sets.json); the character_sets.yml workflow fails when it drifts. Both
 * validators load the same file, so the named sets, the per-class defaults, the whole-value rules and the
 * characters forbidden in a HED string cannot drift between them or from the specification text. A file whose
 * file_version major number is not 1 is refused (Appendix A.6.1).
 *
 * @module schema/characterSets
 */
import semver from 'semver'

import characterSetsData from '../data/json/characterSets.json'
import { checkFileVersion } from '../utils/specFiles'

/**
 * A named character set of the file.
 */
interface CharacterSetEntry {
  regex: string
  description?: string
}

/**
 * The default character set names of a standard value class from a standard schema version on.
 */
interface ValueClassDefault {
  from: string
  sets: string[]
}

/**
 * The characters no HED string may contain: listed characters and inclusive code point ranges.
 */
interface ForbiddenCharacters {
  characters?: string[]
  code_ranges?: Array<[number, number]> | number[][]
}

/**
 * The shape of a character_sets.json file. Only the named sets are required.
 */
export interface CharacterSetsData {
  file_version?: string
  specification_version?: string
  sets: Record<string, CharacterSetEntry>
  aliases?: Record<string, string>
  value_class_defaults?: Record<string, ValueClassDefault[]>
  value_class_words?: Record<string, { regex: string }>
  hed_string?: { forbidden?: ForbiddenCharacters }
  declaration_wins_from?: { standard_version?: string }
}

/**
 * The U+XXXX form of a single character, for messages.
 *
 * @param character - A single character (one code point).
 * @returns The code point, for example "U+003F".
 */
export function codePoint(character: string): string {
  return 'U+' + (character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Escape a character for use in a Unicode-mode regular expression, outside a character class.
 *
 * Unicode mode allows an escape only before a syntax character or "/", so "-" is left as it is.
 *
 * @param character - A single character.
 * @returns The escaped character.
 */
const escapeRegExp = (character: string): string => character.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&')

/**
 * The value of an object's own property, or undefined: a name such as "constructor" or "toString" (a library value
 * class may be called anything) must not find a property inherited from Object.prototype.
 *
 * @param object - The object.
 * @param key - The property name.
 * @returns The own property's value, or undefined.
 */
const own = <T>(object: Record<string, T>, key: string): T | undefined =>
  Object.hasOwn(object, key) ? object[key] : undefined

/**
 * A read-only view of character_sets.json: named sets, aliases, defaults, whole-value rules and exclusions.
 */
export class CharacterSets {
  /**
   * The named character sets: name -> {regex, description}.
   */
  public readonly sets: Record<string, CharacterSetEntry>

  /**
   * The aliases of set names: alias -> canonical name.
   */
  public readonly aliases: Record<string, string>

  /**
   * The default character set names of the standard value classes, by standard schema version.
   */
  public readonly valueClassDefaults: Record<string, ValueClassDefault[]>

  /**
   * The whole-value rules of value classes.
   */
  public readonly valueClassWords: Record<string, { regex: string }>

  /**
   * The characters no HED string may contain.
   */
  public readonly forbidden: ForbiddenCharacters

  /**
   * The standard schema version from which a value class's own declaration defines its characters.
   */
  public readonly declarationWinsFrom: string

  /**
   * The compiled regular expressions, by joined names.
   */
  private readonly _regexCache: Map<string, RegExp>

  /**
   * Constructor.
   *
   * @param data - The parsed content of a character_sets.json file.
   * @throws {IssueError} An internalError if the file's file_version major number is not 1.
   */
  public constructor(data: CharacterSetsData) {
    checkFileVersion(data, 'file_version', 'character_sets.json')
    this.sets = data.sets
    this.aliases = data.aliases ?? {}
    this.valueClassDefaults = data.value_class_defaults ?? {}
    this.valueClassWords = data.value_class_words ?? {}
    this.forbidden = data.hed_string?.forbidden ?? {}
    this.declarationWinsFrom = data.declaration_wins_from?.standard_version ?? '8.5.0'
    this._regexCache = new Map()
  }

  /**
   * Resolve an alias ("slash" -> "forward-slash"); any other name is returned unchanged.
   *
   * @param name - A character set name.
   * @returns The canonical name.
   */
  public canonicalName(name: string): string {
    return own(this.aliases, name) ?? name
  }

  /**
   * The character set names of an allowedCharacter declaration.
   *
   * Each value of the attribute is one name; a value that is not a single character may also hold several names
   * separated by commas. A single character, a comma included, names itself (literal_names).
   *
   * @param values - The values of the attribute.
   * @returns The names, in declaration order.
   */
  public declaredNames(values: Iterable<unknown>): string[] {
    return [...values].flatMap((value) => {
      const text = String(value)
      if ([...text].length === 1) {
        return [text]
      }
      return text
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '')
    })
  }

  /**
   * Whether a name is a set, an alias, or a single literal character (section 2.2, literal names).
   *
   * @param name - A character set name.
   * @returns Whether the name is known.
   */
  public isKnownName(name: string): boolean {
    return Object.hasOwn(this.sets, this.canonicalName(name)) || [...name].length === 1
  }

  /**
   * The regular expression source matching one character of a named set or a literal character.
   *
   * @param name - A set name, an alias, or a single character.
   * @returns The regular expression source.
   * @throws {Error} If the name is none of these.
   */
  private _regexPart(name: string): string {
    const canonical = this.canonicalName(name)
    if (Object.hasOwn(this.sets, canonical)) {
      return this.sets[canonical].regex
    }
    if ([...name].length === 1) {
      return escapeRegExp(name)
    }
    throw new Error(`Unknown character set name "${name}".`)
  }

  /**
   * A regular expression matching exactly one character that any of the names allows.
   *
   * @param names - Set names, aliases, or single literal characters.
   * @returns The expression (Unicode mode, so a character outside the BMP is one character).
   */
  public regexFor(names: string[]): RegExp {
    const key = names.join('\u0000')
    let regex = this._regexCache.get(key)
    if (regex === undefined) {
      const parts = names.map((name) => `(?:${this._regexPart(name)})`)
      regex = new RegExp(`^(?:${parts.join('|')})$`, 'u')
      this._regexCache.set(key, regex)
    }
    return regex
  }

  /**
   * The characters of a text that none of the names allows.
   *
   * @param text - The text to check.
   * @param names - Set names, aliases, or single literal characters. No names means no constraint.
   * @returns [index, character] pairs; the index counts UTF-16 code units, as JavaScript string indices do.
   */
  public problemCharacters(text: string, names: string[]): Array<[number, string]> {
    if (names.length === 0) {
      return []
    }
    const regex = this.regexFor(names)
    const problems: Array<[number, string]> = []
    let index = 0
    for (const character of text) {
      if (!regex.test(character)) {
        problems.push([index, character])
      }
      index += character.length
    }
    return problems
  }

  /**
   * Say what the names allow, for an error message.
   *
   * A single named set is followed by its description without the markdown backticks; several names are listed
   * as written; a literal punctuation character is quoted.
   *
   * @param names - Set names, aliases, or single literal characters.
   * @returns The description.
   */
  public describe(names: string[]): string {
    if (names.length === 1) {
      const entry = own(this.sets, this.canonicalName(names[0]))
      if (entry === undefined) {
        return this._literalName(names[0])
      }
      const description = (entry.description ?? '').replaceAll('`', '').replace(/\.$/, '')
      return description ? `${names[0]} (${description})` : names[0]
    }
    return names.map((name) => this._literalName(name)).join(', ')
  }

  /**
   * Quote a single punctuation character used as its own name; leave set names, letters and digits alone.
   *
   * @param name - A name.
   * @returns The name as written in a message.
   */
  private _literalName(name: string): string {
    if ([...name].length === 1 && !Object.hasOwn(this.sets, name) && !/^[\p{L}\p{N}]$/u.test(name)) {
      return `"${name}"`
    }
    return name
  }

  /**
   * The default character names of a standard value class for a standard schema version.
   *
   * @param className - A value class name.
   * @param standardVersion - The standard schema version in force; null picks the newest entry.
   * @returns The names; empty when the file has no defaults for the class.
   */
  public defaultsFor(className: string, standardVersion: string | null): string[] {
    let chosen: string[] = []
    for (const entry of own(this.valueClassDefaults, className) ?? []) {
      if (!standardVersion || !semver.lt(standardVersion, entry.from)) {
        chosen = entry.sets
      }
    }
    return [...chosen]
  }

  /**
   * The whole-value regular expression of a value class, if it has one.
   *
   * @param className - A value class name.
   * @returns The expression, or null.
   */
  public wordRule(className: string): RegExp | null {
    const entry = own(this.valueClassWords, className)
    return entry === undefined ? null : new RegExp(entry.regex, 'u')
  }

  /**
   * Whether no HED string may contain a character (hed_string.forbidden: listed characters and code ranges).
   *
   * @param character - A single character.
   * @returns Whether the character is forbidden.
   */
  public isForbidden(character: string): boolean {
    if ((this.forbidden.characters ?? []).includes(character)) {
      return true
    }
    const code = character.codePointAt(0) ?? 0
    return (this.forbidden.code_ranges ?? []).some(([low, high]) => low <= code && code <= high)
  }
}

/**
 * The character sets of the specification, shared by every parser.
 */
export const characterSets = new CharacterSets(characterSetsData)
