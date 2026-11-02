/**
 * XML parsing utilities.
 * @module
 */

import { XMLParser } from 'fast-xml-parser'

import { type HedSchemaXMLObject, type HedSchemaRootElement, type NodeElement } from '../schema/xmlType'

/**
 * Parse the schema XML data.
 *
 * @param data - The XML data.
 * @returns The schema XML data.
 */
export default function parseSchemaXML(data: string): HedSchemaXMLObject {
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
  setParent(xmlData.HED)
  return xmlData
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
