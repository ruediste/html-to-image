/* eslint-disable promise/no-callback-in-promise */

import { sleep } from '../../src/util'
import { bootstrap, renderAndCheck } from './helper'
import './setup'

describe('work with iframe element', () => {
  it('should render iframe element', async () => {
    await bootstrap('iframe/node.html', 'iframe/style.css', 'iframe/image')
    await sleep(100)
    await renderAndCheck()
  })
})
