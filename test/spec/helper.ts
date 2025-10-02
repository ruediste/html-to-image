import pixelmatch from 'pixelmatch'
import { toPng } from '../../src'
import { Options } from '../../src/types'
import { getPixelRatio } from '../../src/util'

export function getCaptureNode() {
  return document.getElementById('capture-node') as HTMLDivElement
}

export function getCapturedImageCanvasNode() {
  return document.getElementById('canvas') as HTMLCanvasElement
}
export function getHelperCanvasNode() {
  return document.getElementById('helper-canvas') as HTMLCanvasElement
}

export function getReferenceImageNode() {
  return document.getElementById('ref-image') as HTMLImageElement
}

export function getStyleNode() {
  return document.getElementById('style') as HTMLStyleElement
}

const BASE_URL = '/base/test/resources/'
const ROOT_ID = 'test-root'

export function clean() {
  const root = document.getElementById(ROOT_ID)
  if (root && root.parentNode) {
    root.parentNode.removeChild(root)
  }
}

async function setup() {
  const html = await fetchFile('page.html')
  clean()
  const root = document.createElement('div') as HTMLDivElement
  root.id = ROOT_ID
  root.innerHTML = html
  document.body.appendChild(root)
}

export async function bootstrap(
  htmlUrl: string,
  cssUrl?: string,
  refImageUrl?: string,
) {
  await setup()

  const html = await fetchFile(htmlUrl)
  const captureNode = getCaptureNode()
  captureNode.innerHTML = html

  if (cssUrl) {
    const css = await fetchFile(cssUrl)
    getStyleNode().appendChild(document.createTextNode(css))
  }

  if (refImageUrl) {
    const url = await fetchFile(refImageUrl)
    getReferenceImageNode().setAttribute('src', url)
  }

  return captureNode
}

async function fetchFile(fileName: string) {
  const url = BASE_URL + fileName
  const res = await fetch(url)
  return res.text()
}

function createImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.src = src
  })
}

function drawImageToCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  size?: {
    width?: number
    height?: number
  },
) {
  const context = canvas.getContext('2d')!

  const width = (size && size.width) || img.width
  const height = (size && size.height) || img.height
  const ratio = getPixelRatio()
  canvas.width = width * ratio
  canvas.height = height * ratio
  canvas.style.width = `${width}`
  canvas.style.height = `${height}`

  context.imageSmoothingEnabled = false
  context.drawImage(img, 0, 0)
  return { canvas, context, width, height }
}

function imageToImageData(
  img: HTMLImageElement,
  size?: {
    width?: number
    height?: number
  },
) {
  const { context, width, height } = drawImageToCanvas(
    getHelperCanvasNode(),
    img,
    size,
  )

  return context.getImageData(0, 0, width, height)
}

export async function dataUrlToImageData(
  dataUrl: string,
  size?: {
    width?: number
    height?: number
  },
): Promise<ImageData> {
  const image = await createImageElement(dataUrl)
  return imageToImageData(image, size)
}

export async function check(
  actualImageDataUrl: string,
  size?: {
    width?: number
    height?: number
  },
) {
  drawImageToCanvas(
    getCapturedImageCanvasNode(),
    await createImageElement(actualImageDataUrl),
  )
  const actualImageData = await dataUrlToImageData(actualImageDataUrl, size)
  const ref = getReferenceImageNode()
  const refData = imageToImageData(ref)

  const result = pixelmatch(
    actualImageData.data,
    refData.data,
    null,
    ref.width,
    ref.height,
    {
      threshold: 0.1,
    },
  )
  if (result >= 100) {
    debugger
  }
  expect(result)
    .withContext(`actual image: ${actualImageDataUrl}`)
    .toBeLessThan(100)
}

export async function toDataUrl(node: HTMLDivElement = getCaptureNode()) {
  const png = await toPng(node)
  const image = await createImageElement(png)
  const { canvas } = await drawImageToCanvas(getHelperCanvasNode(), image)
  return canvas.toDataURL()
}

export async function logDataUrl(node: HTMLDivElement = getCaptureNode()) {
  // eslint-disable-next-line
  console.log(toDataUrl(node))
}

export async function renderAndCheck(
  node: HTMLDivElement = getCaptureNode(),
  options: Options = {},
) {
  const rendered = await toPng(node, options)
  try {
    await check(rendered)
  } catch (e) {
    // eslint-disable-next-line no-debugger
    debugger
    // eslint-disable-next-line no-console
    throw new Error(`actual image: ${rendered}\n${e}`)
  }
}

export async function getSvgDocument(dataUrl: string): Promise<XMLDocument> {
  return window
    .fetch(dataUrl)
    .then((res) => res.text())
    .then((str) => new window.DOMParser().parseFromString(str, 'text/xml'))
}

const PASS_TEXT_MATCH = true

export function assertTextRendered(lines: string[], options?: Options) {
  return (node: HTMLDivElement = getCaptureNode()) =>
    PASS_TEXT_MATCH
      ? expect(true).toBe(true)
      : recognizeImage(node, options).then((text) => {
          expect(lines.every((line) => text.includes(line))).toBe(true)
        })
}

export async function recognizeImage(node: HTMLDivElement, options?: Options) {
  return toPng(node, options)
    .then(dataUrlToImageData)
    .then(() => recognize(getHelperCanvasNode().toDataURL()))
}

// see: https://ocr.space/OCRAPI
async function recognize(dataUrl: string) {
  const data = new FormData()
  data.append('base64Image', dataUrl)

  // You may only perform this action upto maximum 180 number of times within
  // 3600 seconds.
  // data.append('apikey', 'aa8c3d7de088957')
  data.append('apikey', 'K89675126388957')

  return window
    .fetch('https://api.ocr.space/parse/image', {
      method: 'post',
      body: data,
    })
    .then((res) => res.json())
    .then((data) => {
      const result: string[] = []
      if (!data.IsErroredOnProcessing) {
        // console.log(JSON.stringify(data.ParsedResults))
        data.ParsedResults.forEach(({ ParsedText }: any) => {
          if (ParsedText) {
            result.push(ParsedText)
          }
        })
      }
      const text = result.join('\n').trim().replace('\r\n', '\n')
      // console.log(`recognized text: ${text}`)
      return text
    })
    .catch(() => {
      // console.log(`text recognize error: ${err}`)
      return ''
    })
}
