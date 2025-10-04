/* eslint-disable promise/no-callback-in-promise */

import { toSvg } from '../../src'
import { bootstrap, getSvgDocument, renderAndCheck } from '../spec/helper'
import '../spec/setup'

describe('work with svg element', () => {
  it('should render nested svg with broken namespace', (done) => {
    bootstrap('svg-ns/node.html', 'svg-ns/style.css', 'svg-ns/image')
      .then(renderAndCheck)
      .then(done)
      .catch(done)
  })

  it('should render svg `<rect>` with width and heigth', (done) => {
    bootstrap('svg-rect/node.html', 'svg-rect/style.css', 'svg-rect/image')
      .then(renderAndCheck)
      .then(done)
      .catch(done)
  })

  it('should render svg `<rect>` with applied css styles', async () => {
    await bootstrap(
      'svg-color/node.html',
      'svg-color/style.css',
      'svg-color/image',
    )
    await renderAndCheck()
  })

  it('should include a viewBox attribute', (done) => {
    bootstrap('small/node.html', 'small/style.css', 'small/image')
      .then(toSvg)
      .then(getSvgDocument)
      .then((doc) => {
        const width = doc.documentElement.getAttribute('width')
        const height = doc.documentElement.getAttribute('height')
        const viewBox = doc.documentElement.getAttribute('viewBox')
        expect(viewBox).toEqual(`0 0 ${width} ${height}`)
      })
      .then(done)
      .catch(done)
  })

  it('should render svg `<image>` with href', (done) => {
    bootstrap('svg-image/node.html', 'svg-image/style.css', 'svg-image/image')
      .then(renderAndCheck)
      .then(done)
      .catch(done)
  })

  it('should render SVG use tags', async () => {
    await bootstrap(
      'svg-use-tag/node.html',
      'svg-use-tag/style.css',
      'svg-use-tag/image',
    )
    await renderAndCheck()
  })

  it('should support foreign object inline and stylesheet styling', async () => {
    await bootstrap(
      'svg-foreign-object-styling/node.html',
      'svg-foreign-object-styling/style.css',
      'svg-foreign-object-styling/image',
    )
    await renderAndCheck()
  })

  it('should handle font-family correctly', async () => {
    await bootstrap(
      'svg-text-font-family/node.html',
      'svg-text-font-family/style.css',
      'svg-text-font-family/image',
    )
    await renderAndCheck()
  })
})
