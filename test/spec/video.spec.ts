/* eslint-disable promise/no-callback-in-promise */

import { sleep } from '../../src/util'
import { bootstrap, renderAndCheck } from './helper'
import './setup'

describe('work with video element', () => {
  it('should render video element', async () => {
    const node = await bootstrap(
      'video/node.html',
      'video/style.css',
      'video/image',
    )
    await sleep(1000)
    await renderAndCheck(node)
  })

  it('should render wide video', async () => {
    await bootstrap(
      'video/node_wide.html',
      'video/style.css',
      'video/image-wide',
    )
    await sleep(1000)
    await renderAndCheck()
  })

  it('should render narrow video', async () => {
    await bootstrap(
      'video/node_narrow.html',
      'video/style.css',
      'video/image-narrow',
    )
    await sleep(1000)
    await renderAndCheck()
  })

  fit('should render video element with poster', async () => {
    await bootstrap(
      'video/poster.html',
      'video/style.css',
      'video/image-poster',
    )
    await sleep(1000)
    await renderAndCheck()
  })
})
