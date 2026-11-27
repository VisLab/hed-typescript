/**
 * XML parsing utilities.
 * @module
 */

import { XMLParser, XMLValidator } from 'fast-xml-parser'

import { type HedSchemaXMLObject, type HedSchemaRootElement, type NodeElement } from '../schema/xmlType'
import { IssueError } from '../issues/issues'

/**
 * The section elements every schema file has, empty or not (HED specification A.3.1). The sources, prefixes and
 * external annotations sections may be missing.
 */
const requiredSections = [
  'schema',
  'unitClassDefinitions',
  'unitModifierDefinitions',
  'valueClassDefinitions',
  'schemaAttributeDefinitions',
  'propertyDefinitions',
] as const

/**
 * Parse the schema XML data.
 *
 * @param data - The XML data.
 * @returns The schema XML data.
 * @throws {IssueError} If the data is not well-formed XML or lacks a required section.
 */
export default function parseSchemaXML(data: string): HedSchemaXMLObject {
  const validation = XMLValidator.validate(data)
  if (validation !== true) {
    IssueError.generateAndThrow('schemaXmlNotWellFormed', {
      error: validation.err.msg,
      line: String(validation.err.line),
    })
  }
  const alwaysArray = new Set([
    'node',
    'property',
    'attribute',
    'value',
    'unit',
    'propertyDefinition',
    'schemaAttributeDefinition',
    'valueClassDefinition',
    'unitModifierDefinition',
    'unitClassDefinition',
  ])
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    alwaysCreateTextNode: true,
    textNodeName: '_',
    ignoreDeclaration: true,
    ignorePiTags: true,
    attributesGroupName: '$',
    // Header flags such as unmerged are written "True" by the schema tools; accept any case.
    attributeValueProcessor: (_, attrValue) => {
      if (attrValue.toLowerCase() === 'true') {
        return true
      }
      if (attrValue.toLowerCase() === 'false') {
        return false
      }
      return attrValue
    },
    isArray: (name) => {
      if (alwaysArray.has(name)) {
        // console.log(`Making ${name} an array`)
        return true
      }
      return false
    },
  })

  const xmlData = parser.parse(data) as HedSchemaXMLObject
  checkSections(xmlData)
  setParent(xmlData.HED)
  return xmlData
}

/**
 * Check that the root element is HED and has every required section.
 *
 * @param xmlData - The parsed XML data.
 * @throws {IssueError} If the HED element or a required section is missing.
 */
function checkSections(xmlData: HedSchemaXMLObject): void {
  const root: unknown = xmlData?.HED
  if (root === undefined) {
    IssueError.generateAndThrow('missingSchemaSection', { section: 'HED' })
  }
  for (const section of requiredSections) {
    if (typeof root !== 'object' || root === null || !(section in root)) {
      IssueError.generateAndThrow('missingSchemaSection', { section })
    }
  }
}

/**
 * Handle top level of parent-setting recursion before passing to setNodeParent.
 *
 * @param rootElement - The root element of the XML tree.
 */
function setParent(rootElement: HedSchemaRootElement): void {
  const childNodes = rootElement.schema.node ?? []
  for (const child of childNodes) {
    setNodeParent(child, null)
  }
}

/**
 * Recursively set a field on each node of the tree pointing to the node's parent.
 *
 * @param node - The child node.
 * @param parent - The parent node.
 */
function setNodeParent(node: NodeElement, parent: NodeElement | null): void {
  // Assume that we've already run this function if so.
  if ('$parent' in node) {
    return
  }
  node.$parent = parent
  const childNodes = node.node ?? []
  for (const child of childNodes) {
    setNodeParent(child, node)
  }
}
