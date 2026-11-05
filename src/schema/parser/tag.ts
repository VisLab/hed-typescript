import flattenDeep from 'lodash/flattenDeep'
import zip from 'lodash/zip'

import { getElementName, type HedSchemaXMLCollection, type HedSchemaXMLObject, type NodeElement } from '../xmlType'
import { SchemaEntryWithAttributesParser } from './schemaEntry'
import type SchemaEntryManager from '../entries/schemaEntryManager'

import type SchemaUnitClass from '../entries/unitClass'
import type SchemaValueClass from '../entries/valueClass'
import type SchemaAttribute from '../entries/attribute'
import SchemaTag from '../entries/tag'
import SchemaValueTag from '../entries/valueTag'

import { IssueError } from '../../issues/issues'

const lc = (str: string) => str.toLowerCase()

export default class TagParser extends SchemaEntryWithAttributesParser<SchemaTag> {
  private readonly unitClasses: SchemaEntryManager<SchemaUnitClass>
  private readonly valueClasses: SchemaEntryManager<SchemaValueClass>
  private schemaTags: Map<string, SchemaTag>

  public constructor(
    xmlCollection: HedSchemaXMLCollection,
    attributes: SchemaEntryManager<SchemaAttribute>,
    unitClasses: SchemaEntryManager<SchemaUnitClass>,
    valueClasses: SchemaEntryManager<SchemaValueClass>,
  ) {
    super(xmlCollection, attributes)
    this.unitClasses = unitClasses
    this.valueClasses = valueClasses
  }

  /**
   * Parse the schema's tags.
   */
  protected override _parseSchema(schemaXml: HedSchemaXMLObject): void {
    const tags = this.getAllTags(schemaXml)
    const shortTags = this.getShortTags(tags)
    // Two tags of one name, or of names that differ only by case ("Item" under "Item"), would collapse into one entry
    // or make a tag its own parent; report them first.
    const tagKeys = [...shortTags.values()].map(lc)
    if (new Set(tagKeys).size !== tagKeys.length) {
      IssueError.generateAndThrow('duplicateTagsInSchema')
    }
    const parentMap = this.generateParentMap(shortTags)
    const [booleanAttributeDefinitions, valueAttributeDefinitions, descriptions] = this._parseAttributeElements(
      tags.keys(),
      (element: NodeElement) => shortTags.get(element) ?? '',
    )
    // A library never extends a tag of its partner by naming it again, so every tag of an unmerged file is marked;
    // one that redeclares a partner tag is then rejected as in the merged form (addEntry).
    this._addInLibrary(schemaXml, valueAttributeDefinitions, () => false)
    this.processRootedElements(parentMap, valueAttributeDefinitions)

    const tagUnitClassDefinitions = this.processTagUnitClasses(shortTags, valueAttributeDefinitions)
    const tagValueClassDefinitions = this.processTagValueClasses(shortTags, valueAttributeDefinitions)
    this.processRecursiveAttributes(parentMap, booleanAttributeDefinitions)

    this.createSchemaTags(
      booleanAttributeDefinitions,
      valueAttributeDefinitions,
      descriptions,
      tagUnitClassDefinitions,
      tagValueClassDefinitions,
      parentMap,
    )
    this.mergeSchemaEntries()
  }

  /**
   * Retrieve all the tags in the schema.
   *
   * @returns The tag names and XML elements.
   */
  private getAllTags(schemaXml: HedSchemaXMLObject): Map<NodeElement, string> {
    const nodeRoot = schemaXml.HED.schema
    const tagElements = []
    const tagElementChildren = nodeRoot.node
    tagElements.push(...flattenDeep(tagElementChildren.map((child) => this.getAllChildTags(child, false))))
    const tags = tagElements.map((element) => getElementName(element))
    return new Map(zip(tagElements, tags) as [NodeElement, string][])
  }

  private getAllChildTags(parentElement: NodeElement, excludeTakeValueTags = true): NodeElement[] {
    if (excludeTakeValueTags && getElementName(parentElement) === '#') {
      return []
    }
    const childTags = [parentElement]
    const tagElementChildren = parentElement.node ?? []
    return childTags.concat(
      flattenDeep(tagElementChildren.map((child) => this.getAllChildTags(child, excludeTakeValueTags))),
    )
  }

  /**
   * Generate the map from tag elements to shortened tag names.
   *
   * @param tags - The map from tag elements to tag strings.
   * @returns The map from tag elements to shortened tag names.
   */
  private getShortTags(tags: Map<NodeElement, string>): Map<NodeElement, string> {
    const shortTags = new Map<NodeElement, string>()
    for (const tagElement of tags.keys()) {
      const shortKey =
        getElementName(tagElement) === '#' ? TagParser.getParentTagName(tagElement) + '-#' : getElementName(tagElement)
      shortTags.set(tagElement, shortKey)
    }
    return shortTags
  }

  private static getParentTagName(tagElement: NodeElement): string {
    const parentTagElement = tagElement.$parent
    if (parentTagElement) {
      return getElementName(parentTagElement)
    } else {
      return ''
    }
  }

  /**
   * Generate a map from each tag name to its parent tag name.
   *
   * @param shortTags - The map from tag elements to shortened tag names.
   * @returns A map from each tag name to its parent tag name.
   */
  private generateParentMap(shortTags: Map<NodeElement, string>): Map<string, string> {
    const parentMap = new Map<string, string>()
    for (const tagElement of shortTags.keys()) {
      if (!tagElement.$parent) {
        continue
      }

      const tagName = lc(shortTags.get(tagElement) ?? '')
      const parentTagName = lc(shortTags.get(tagElement.$parent) ?? '')
      parentMap.set(tagName, parentTagName)
    }
    return parentMap
  }

  private processRootedElements(
    parentMap: Map<string, string>,
    valueAttributeDefinitions: Map<string, Map<SchemaAttribute, string[]>>,
  ): void {
    const rootedAttribute = this.attributes.getEntry('rooted')
    if (!rootedAttribute) {
      return
    }
    for (const [shortName, valueAttributes] of valueAttributeDefinitions) {
      const root = valueAttributes.get(rootedAttribute)
      if (root) {
        if (root.length !== 1) {
          IssueError.generateAndThrow('invalidSchema', {
            error: `Tag "${shortName}" has rooted attribute but incorrect attribute value count`,
          })
        }
        parentMap.set(lc(shortName), lc(root[0]))
        valueAttributes.delete(rootedAttribute)
      }
    }
  }

  /**
   * Process unit classes in tags.
   *
   * @param shortTags - The map from tag elements to shortened tag names.
   * @param valueAttributeDefinitions - The map from shortened tag names to their value schema attributes.
   * @returns The map from shortened tag names to their unit classes.
   */
  private processTagUnitClasses(
    shortTags: Map<NodeElement, string>,
    valueAttributeDefinitions: Map<string, Map<SchemaAttribute, string[]>>,
  ): Map<string, SchemaUnitClass[]> {
    const tagUnitClassAttribute = this.attributes.getEntry('unitClass')
    const tagUnitClassDefinitions = new Map<string, SchemaUnitClass[]>()
    if (!tagUnitClassAttribute) {
      return tagUnitClassDefinitions
    }

    for (const tagName of shortTags.values()) {
      const valueAttributes = valueAttributeDefinitions.get(tagName)
      if (valueAttributes?.has(tagUnitClassAttribute)) {
        const tagUnitClasses =
          valueAttributes
            ?.get(tagUnitClassAttribute)
            ?.map((unitClassName) => {
              return this.unitClasses.getEntry(unitClassName)
            })
            .filter((unitClass) => unitClass !== undefined) ?? []
        tagUnitClassDefinitions.set(tagName, tagUnitClasses)
        valueAttributes.delete(tagUnitClassAttribute)
      }
    }

    return tagUnitClassDefinitions
  }

  /**
   * Process value classes in tags.
   *
   * @param shortTags - The map from tag elements to shortened tag names.
   * @param valueAttributeDefinitions - The map from shortened tag names to their value schema attributes.
   * @returns The map from shortened tag names to their value classes.
   */
  private processTagValueClasses(
    shortTags: Map<NodeElement, string>,
    valueAttributeDefinitions: Map<string, Map<SchemaAttribute, string[]>>,
  ): Map<string, SchemaValueClass[]> {
    const tagValueClassAttribute = this.attributes.getEntry('valueClass')
    const tagValueClassDefinitions = new Map<string, SchemaValueClass[]>()
    if (!tagValueClassAttribute) {
      return tagValueClassDefinitions
    }

    // A value class the schema does not define is a compliance fault, and older published schemas have such faults
    // (HED 8.0.0 gives Parameter-label/# and Timbre/# the undefined labelClass). The schema is never refused for
    // one: the reference is treated as textClass, or dropped if the schema has no textClass.
    const textClass = this.valueClasses.getEntry('textClass')
    for (const tagName of shortTags.values()) {
      const valueAttributes = valueAttributeDefinitions.get(tagName)
      if (valueAttributes?.has(tagValueClassAttribute)) {
        const tagValueClasses = new Set<SchemaValueClass>()
        for (const valueClassName of valueAttributes.get(tagValueClassAttribute) ?? []) {
          const valueClass = this.valueClasses.getEntry(valueClassName) ?? textClass
          if (valueClass !== undefined) {
            tagValueClasses.add(valueClass)
          }
        }
        tagValueClassDefinitions.set(tagName, [...tagValueClasses])
        // TODO: Uncomment once value validation uses value classes.
        // valueAttributes.delete(tagValueClassAttribute)
      }
    }

    return tagValueClassDefinitions
  }

  /**
   * Propagate recursive boolean attributes to descendant tags.
   *
   * @remarks
   * Descendants follow the parent map, which includes the tags placed by a "rooted" attribute, so a tag whose parent an
   * earlier schema of the group declared (a rooted tag of an unmerged library) inherits from that parent tag. "#"
   * children inherit nothing.
   *
   * @param parentMap - The parent map (lowercase short names), with the rooted tags placed.
   * @param booleanAttributeDefinitions - The boolean attributes by short name, modified in place.
   */
  private processRecursiveAttributes(
    parentMap: Map<string, string>,
    booleanAttributeDefinitions: Map<string, Set<SchemaAttribute>>,
  ): void {
    const recursiveAttributes = new Set(this.attributes.filter(([, attribute]) => attribute.recursive).values())
    // The names are unique apart from case (_parseSchema).
    const namesByKey = new Map([...booleanAttributeDefinitions.keys()].map((name) => [lc(name), name]))
    const passedDown = new Map<string, Set<SchemaAttribute>>()
    // The recursive attributes a tag passes to its children: its own and those it inherits.
    const passedDownBy = (key: string): Set<SchemaAttribute> => {
      const known = passedDown.get(key)
      if (known !== undefined) {
        return known
      }
      // Marked before recursing, so a cycle in the parent map (rooted tags anchored on each other) ends.
      passedDown.set(key, new Set<SchemaAttribute>())
      const name = namesByKey.get(key)
      let attributes: Set<SchemaAttribute>
      if (name === undefined) {
        // A parent from an earlier schema of the group already carries everything it inherited.
        attributes =
          this.entryTypeMap.get(key)?.booleanAttributes.intersection(recursiveAttributes) ?? new Set<SchemaAttribute>()
      } else {
        const own = booleanAttributeDefinitions.get(name)!.intersection(recursiveAttributes)
        const parentKey = parentMap.get(key)
        attributes = parentKey === undefined ? own : own.union(passedDownBy(parentKey))
      }
      passedDown.set(key, attributes)
      return attributes
    }
    for (const name of booleanAttributeDefinitions.keys()) {
      const parentKey = parentMap.get(lc(name))
      if (parentKey !== undefined && !name.endsWith('-#')) {
        booleanAttributeDefinitions.set(name, booleanAttributeDefinitions.get(name)!.union(passedDownBy(parentKey)))
      }
    }
  }

  /**
   * Create the {@link SchemaTag} objects.
   *
   * @param booleanAttributeDefinitions - The map from shortened tag names to their boolean schema attributes.
   * @param valueAttributeDefinitions - The map from shortened tag names to their value schema attributes.
   * @param descriptions - The map from shortened tag names to their descriptions.
   * @param tagUnitClassDefinitions - The map from shortened tag names to their unit classes.
   * @param tagValueClassDefinitions - The map from shortened tag names to their value classes.
   * @param parentMap - The map from each tag name to its parent tag name.
   * @returns The map from lowercase shortened tag names to their tag objects.
   */
  private createSchemaTags(
    booleanAttributeDefinitions: Map<string, Set<SchemaAttribute>>,
    valueAttributeDefinitions: Map<string, Map<SchemaAttribute, string[]>>,
    descriptions: Map<string, string | undefined>,
    tagUnitClassDefinitions: Map<string, SchemaUnitClass[]>,
    tagValueClassDefinitions: Map<string, SchemaValueClass[]>,
    parentMap: Map<string, string>,
  ): void {
    this.schemaTags = new Map<string, SchemaTag>()

    for (const [name, valueAttributes] of valueAttributeDefinitions) {
      const booleanAttributes = booleanAttributeDefinitions.get(name) ?? new Set<SchemaAttribute>()
      const description = descriptions.get(name)
      const unitClasses = tagUnitClassDefinitions.get(name) ?? []
      const valueClasses = tagValueClassDefinitions.get(name) ?? []
      const parentTagName = parentMap.get(lc(name))
      // A tag hangs under the parent an earlier schema of the group declared, which mergeSchemaEntries keeps over this
      // schema's equivalent copy. A "#" child keeps this schema's copy: under a kept parent it is either a duplicate,
      // compared as part of its parent in addEntry, or a new value child, which is rejected below.
      const parentTag =
        parentTagName === undefined
          ? undefined
          : name.endsWith('-#')
            ? (this.schemaTags.get(parentTagName) ?? this.entryTypeMap.get(parentTagName))
            : (this.entryTypeMap.get(parentTagName) ?? this.schemaTags.get(parentTagName))

      if (name.endsWith('-#')) {
        if (this.entryTypeMap.has(parentTagName!) && !this.entryTypeMap.has(lc(name))) {
          IssueError.generateAndThrow('lazyPartneredSchemasShareTag', { tag: name.replace('-#', '/#') })
        }
        this.schemaTags.set(
          lc(name),
          new SchemaValueTag(
            name,
            description,
            parentTag,
            booleanAttributes,
            valueAttributes,
            unitClasses,
            valueClasses,
          ),
        )
      } else {
        this.schemaTags.set(
          lc(name),
          new SchemaTag(name, description, parentTag, booleanAttributes, valueAttributes, unitClasses, valueClasses),
        )
      }
    }
  }

  /**
   * Merge the per-schema tag map into the main tag map.
   */
  private mergeSchemaEntries(): void {
    for (const [shortTagName, newTag] of this.schemaTags) {
      this.addEntry(shortTagName, newTag)
    }
  }

  /**
   * Add a new tag while checking for duplicates.
   *
   * Override of {@link SchemaEntryParser.addEntry} to change the issue message.
   *
   * @param shortTagName - The short tag name.
   * @param newTag - The new tag object to add.
   */
  protected override addEntry(shortTagName: string, newTag: SchemaTag): void {
    const lowercaseName = lc(shortTagName)
    if (this.entryTypeMap.has(lowercaseName)) {
      const existingTag = this.entryTypeMap.get(lowercaseName)!
      if (newTag.hasAttribute('inLibrary') && !existingTag.hasAttribute('inLibrary')) {
        IssueError.generateAndThrow('lazyPartneredSchemaOverloadsStandardTag', { tag: newTag.name.replace('-#', '/#') })
      }
      if (!newTag.equivalent(existingTag)) {
        IssueError.generateAndThrow('lazyPartneredSchemasShareTag', { tag: newTag.name.replace('-#', '/#') })
      }
    } else {
      this.entryTypeMap.set(lowercaseName, newTag)
    }
  }
}
