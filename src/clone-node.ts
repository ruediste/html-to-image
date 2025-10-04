import { clonePseudoElements } from './clone-pseudos'
import { resourceToDataURL } from './dataurl'
import { getMimeType } from './mimes'
import type { CloneableElement, Options } from './types'
import {
  createImage,
  findDirectlyMatchingCssRules,
  getStyleProperties,
  isInstanceOfElement,
  toArray,
} from './util'

async function cloneCanvasElement(canvas: HTMLCanvasElement) {
  const dataURL = canvas.toDataURL()
  if (dataURL === 'data:,') {
    return canvas.cloneNode(false) as HTMLCanvasElement
  }
  return createImage(dataURL)
}

async function cloneVideoElement(video: HTMLVideoElement, options: Options) {
  if (video.currentSrc) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = video.clientWidth
    canvas.height = video.clientHeight
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataURL = canvas.toDataURL()
    return createImage(dataURL)
  }

  const poster = video.poster
  const contentType = getMimeType(poster)
  const dataURL = await resourceToDataURL(poster, contentType, options)
  return createImage(dataURL)
}

async function cloneIFrameElement(iframe: HTMLIFrameElement, options: Options) {
  try {
    // replace the iframe element with a div, to get a target for styling
    const wrapperDiv = document.createElement('div')
    if (iframe?.contentDocument?.body) {
      const clonedBody = (await cloneNode(
        iframe.contentDocument.body,
        options,
        true,
      )) as HTMLBodyElement
      wrapperDiv.appendChild(clonedBody)
    }
    return wrapperDiv
  } catch {
    // Failed to clone iframe
  }

  return iframe.cloneNode(false) as HTMLIFrameElement
}

async function cloneSingleNode<T extends CloneableElement>(
  node: T,
  options: Options,
): Promise<CloneableElement> {
  if (isInstanceOfElement(node, HTMLCanvasElement)) {
    return cloneCanvasElement(node)
  }

  if (isInstanceOfElement(node, HTMLVideoElement)) {
    return cloneVideoElement(node, options)
  }

  if (isInstanceOfElement(node, HTMLIFrameElement)) {
    return cloneIFrameElement(node, options)
  }

  return node.cloneNode() as T
}

const isSlotElement = (node: CloneableElement): node is HTMLSlotElement =>
  node.tagName != null && node.tagName.toUpperCase() === 'SLOT'

async function cloneChildren<T extends CloneableElement>(
  nativeNode: T,
  clonedNode: T,
  options: Options,
): Promise<void> {
  let children: CloneableElement[] = []

  if (isSlotElement(nativeNode) && nativeNode.assignedNodes) {
    children = toArray<T>(nativeNode.assignedNodes())
  } else {
    children = toArray<T>((nativeNode.shadowRoot ?? nativeNode).childNodes)
  }

  if (
    children.length === 0 ||
    isInstanceOfElement(nativeNode, HTMLVideoElement)
  ) {
    return
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const child of children) {
    if (child instanceof HTMLStyleElement) continue
    const clonedChild = await cloneNode(child, options)
    if (clonedChild) clonedNode.appendChild(clonedChild)
  }
}

function cloneCSSStyle(
  nativeNode: CloneableElement,
  clonedNode: CloneableElement,
  options: Options,
) {
  const targetStyle = clonedNode.style
  if (!targetStyle) {
    return
  }

  const sourceStyle = window.getComputedStyle(nativeNode)
  if (sourceStyle.cssText) {
    targetStyle.cssText = sourceStyle.cssText
    targetStyle.transformOrigin = sourceStyle.transformOrigin
  } else {
    getStyleProperties(options).forEach((name) => {
      let value = sourceStyle.getPropertyValue(name)

      {
        const fontFamilyAttr = nativeNode.getAttribute('font-family')
        if (fontFamilyAttr != null) {
          // for svg texts, the font-family attribute is used if there is no
          // matching css rule. Therefore, do not copy the computed CSS value, as it
          // would override the fond-family attribute (which is alredy copied somewhere else)
          if (
            !findDirectlyMatchingCssRules(nativeNode).some(
              (x) => x.style.fontFamily !== '',
            )
          )
            return
        }
      }

      if (name === 'font-size' && value.endsWith('px')) {
        const reducedFont =
          Math.floor(parseFloat(value.substring(0, value.length - 2))) - 0.1
        value = `${reducedFont}px`
      }

      if (
        isInstanceOfElement(nativeNode, HTMLIFrameElement) &&
        name === 'display' &&
        value === 'inline'
      ) {
        value = 'block'
      }

      if (name === 'd' && clonedNode.getAttribute('d')) {
        value = `path(${clonedNode.getAttribute('d')})`
      }

      targetStyle.setProperty(
        name,
        value,
        sourceStyle.getPropertyPriority(name),
      )
    })
  }
}

function cloneInputValue(nativeNode: Element, clonedNode: Element) {
  if (isInstanceOfElement(nativeNode, HTMLTextAreaElement)) {
    clonedNode.innerHTML = nativeNode.value
  }

  if (isInstanceOfElement(nativeNode, HTMLInputElement)) {
    clonedNode.setAttribute('value', nativeNode.value)
  }
}

function cloneSelectValue(nativeNode: Element, clonedNode: Element) {
  if (isInstanceOfElement(nativeNode, HTMLSelectElement)) {
    const clonedSelect = clonedNode as any as HTMLSelectElement
    const selectedOption = Array.from(clonedSelect.children).find(
      (child) => nativeNode.value === child.getAttribute('value'),
    )

    if (selectedOption) {
      selectedOption.setAttribute('selected', '')
    }
  }
}

function decorate<T extends CloneableElement>(
  nativeNode: T,
  clonedNode: T,
  options: Options,
): void {
  cloneCSSStyle(nativeNode, clonedNode, options)
  if (
    isInstanceOfElement(clonedNode, HTMLElement) &&
    isInstanceOfElement(nativeNode, HTMLElement)
  ) {
    clonePseudoElements(nativeNode, clonedNode, options)
    cloneInputValue(nativeNode, clonedNode)
    cloneSelectValue(nativeNode, clonedNode)
  }
}

async function ensureSVGSymbols(clone: CloneableElement, options: Options) {
  const uses = clone.querySelectorAll ? clone.querySelectorAll('use') : []
  if (uses.length === 0) {
    return
  }

  const processedDefs: { [key: string]: HTMLElement } = {}
  for (let i = 0; i < uses.length; i++) {
    const use = uses[i]
    const id = use.getAttribute('href') ?? use.getAttribute('xlink:href')
    if (id) {
      const exist = clone.querySelector(id)
      const definition = document.querySelector(id) as HTMLElement
      if (!exist && definition && !processedDefs[id]) {
        // eslint-disable-next-line no-await-in-loop
        processedDefs[id] = (await cloneNode(definition, options, true))!
      }
    }
  }

  const nodes = Object.values(processedDefs)
  if (nodes.length) {
    const ns = 'http://www.w3.org/1999/xhtml'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('xmlns', ns)
    svg.style.position = 'absolute'
    svg.style.width = '0'
    svg.style.height = '0'
    svg.style.overflow = 'hidden'
    svg.style.display = 'none'

    const defs = document.createElementNS(ns, 'defs')
    svg.appendChild(defs)

    for (let i = 0; i < nodes.length; i++) {
      defs.appendChild(nodes[i])
    }

    clone.appendChild(svg)
  }
}

export async function cloneNode<T extends CloneableElement>(
  node: T,
  options: Options,
  isRoot?: boolean,
): Promise<T | null> {
  if (!isRoot && options.filter && !options.filter(node)) {
    return null
  }

  const clonedNode = (await cloneSingleNode(node, options)) as T
  await cloneChildren(node, clonedNode, options)
  await decorate(node, clonedNode, options)
  await ensureSVGSymbols(clonedNode, options)

  return clonedNode
}
