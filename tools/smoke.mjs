#!/usr/bin/env node
/*
 * Real-browser acceptance test for the production build.
 *
 *   npm run build
 *   npm run preview -- --port 4321
 *   node tools/smoke.mjs http://127.0.0.1:4321/
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const url = process.argv[2] ?? 'http://127.0.0.1:4321/'
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
assert(existsSync(chrome), `Chrome not found at ${chrome}; set CHROME_PATH`)

const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({ executablePath: chrome, headless: true })
const existingContext = process.env.CDP_URL ? browser.contexts()[0] : null
const context = existingContext ?? await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const page = await context.newPage()
await page.setViewportSize({ width: 390, height: 844 })
await page.bringToFront()
page.setDefaultTimeout(15000)

const errors = []
const step = (message) => console.log(`[smoke] ${message}`)
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

const state = () => page.evaluate(() => window.__SWITCHSHOT__?.state())
const active = () => page.evaluate(() => window.__SWITCHSHOT__?.active())
const waitScene = (key) => page.waitForFunction(
  (expected) => window.__SWITCHSHOT__?.active() === expected, key, { timeout: 15000, polling: 100 },
)

/* Real CDP touch events, so Phaser treats them exactly like a phone finger. */
const cdp = await context.newCDPSession(page)
let canvasBox = null
const refreshBox = async () => {
  canvasBox = await page.evaluate(() => {
    const canvas = document.querySelector('#game canvas')
    if (!canvas) throw new Error('canvas missing')
    const box = canvas.getBoundingClientRect()
    return { left: box.left, top: box.top, width: box.width, height: box.height }
  })
}
const clientOf = (gameX, gameY) => ({
  x: canvasBox.left + (gameX / 720) * canvasBox.width,
  y: canvasBox.top + (gameY / 1280) * canvasBox.height,
})
const sendTouch = async (type, points) => {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point) => ({
      ...clientOf(point.gx, point.gy),
      id: point.id,
      radiusX: 4,
      radiusY: 4,
      force: 1,
    })),
  })
}
const touchEnd = () => sendTouch('touchEnd', [])

const dragPad = async (fromX, fromY, toX, toY, pointerId = 1, steps = 4) => {
  await sendTouch('touchStart', [{ gx: fromX, gy: fromY, id: pointerId }])
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps
    await sendTouch('touchMove', [{ gx: fromX + (toX - fromX) * t, gy: fromY + (toY - fromY) * t, id: pointerId }])
    await page.waitForTimeout(24)
  }
}

try {
  step(`opening ${url}`)
  const target = url.includes('?') ? `${url}&touch=1` : `${url}?touch=1`
  await page.goto(target, { waitUntil: 'domcontentloaded' })
  await page.bringToFront()
  await page.waitForFunction(() => Boolean(document.querySelector('#game canvas')), null, { polling: 100 })
  await page.waitForFunction(() => Boolean(window.__SWITCHSHOT__), null, { polling: 100 })
  await page.waitForTimeout(1100)
  assert.equal(await active(), 'Menu', 'game boots into the menu')
  const arcade = await page.evaluate(() => ({
    installed: Boolean(window.LittleJoyArcade?.__installed),
    gameId: window.LittleJoyArcade?.gameId ?? null,
    dataset: document.documentElement.dataset.game ?? null,
  }))
  assert.equal(arcade.installed, true, 'the Little Joy Arcade drop-in client installed')
  assert.equal(arcade.dataset, 'switchshot-adventures', 'the page identifies itself to the arcade')
  step(`menu ready; arcade client installed (${arcade.gameId ?? 'id not exposed'})`)
  await page.screenshot({ path: '/tmp/switchshot-menu.png' })

  await page.evaluate(() => window.__SWITCHSHOT__.launch('w1-1', 'journey'))
  await waitScene('Game')
  await page.waitForTimeout(500)
  let game = await state()
  assert.equal(game.levelId, 'w1-1')
  assert.equal(game.health, 3)
  assert.equal(game.switches.length > 0, true, 'the room has a shootable switch')
  step('level 1 ready')

  const fit = await page.evaluate(() => {
    const canvas = document.querySelector('#game canvas')
    const box = canvas.getBoundingClientRect()
    return {
      left: box.left, right: box.right, top: box.top, bottom: box.bottom,
      width: box.width, height: box.height,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
    }
  })
  assert(fit.width >= fit.viewportWidth - 1, `canvas covers the viewport width (${fit.width} vs ${fit.viewportWidth})`)
  assert(fit.height >= fit.viewportHeight - 1, `canvas covers the viewport height (${fit.height} vs ${fit.viewportHeight})`)
  assert(Math.abs((fit.left + fit.right) / 2 - fit.viewportWidth / 2) <= 1.5, 'canvas centred horizontally')
  assert(Math.abs((fit.top + fit.bottom) / 2 - fit.viewportHeight / 2) <= 1.5, 'canvas centred vertically')
  step(`canvas fills and centres: ${fit.width.toFixed(1)}x${fit.height.toFixed(1)} in ${fit.viewportWidth}x${fit.viewportHeight}`)
  await refreshBox()

  // Thumb Glide: drag the lower-left pad right and hold.
  const x0 = game.player.x
  await dragPad(158, 1108, 268, 1108, 1, 4)
  await page.waitForTimeout(320)
  game = await state()
  assert(game.player.x > x0 + 8, `thumb drag moved Pip (${x0} -> ${game.player.x})`)
  await touchEnd()
  await page.waitForTimeout(260)
  step(`thumb glide moved Pip ${x0} -> ${game.player.x}`)

  // Flick up on the same pad to jump; the finger keeps the movement role.
  const beforeJump = await state()
  await dragPad(158, 1140, 158, 1030, 2, 3)
  await page.waitForTimeout(140)
  const duringJump = await state()
  assert(
    duringJump.player.vy < 0 || duringJump.player.y < beforeJump.player.y - 6,
    `upward flick jumped (vy ${duringJump.player.vy}, y ${beforeJump.player.y} -> ${duringJump.player.y})`,
  )
  await touchEnd()
  step('upward flick jumps')

  // Two fingers: one holds the movement pad, the other taps the room to fire.
  await page.waitForTimeout(360)
  const shotsBefore = (await state()).shots
  const xBeforeMulti = (await state()).player.x
  await sendTouch('touchStart', [{ gx: 150, gy: 1110, id: 5 }, { gx: 520, gy: 620, id: 6 }])
  await sendTouch('touchMove', [{ gx: 230, gy: 1110, id: 5 }, { gx: 520, gy: 620, id: 6 }])
  await page.waitForTimeout(280)
  game = await state()
  assert(game.shots > shotsBefore, `second finger fired (${shotsBefore} -> ${game.shots})`)
  assert(game.player.x !== xBeforeMulti, 'movement continued while the second finger fired')
  await touchEnd()
  step('tap-to-shoot works during movement')

  // Climb to the top stair, then tap the room's first switch for real. The
  // projectile has to travel through the room and collide to open the hatch.
  await page.evaluate(() => window.__SWITCHSHOT__.standOnStair())
  await page.waitForTimeout(900)
  let switchHit = false
  for (let attempt = 0; attempt < 3 && !switchHit; attempt += 1) {
    game = await state()
    const switchTarget = game.switches[0]
    const screenY = switchTarget.y - game.cameraScrollY
    assert(screenY > 60 && screenY < 1180, `the switch is on screen (y ${Math.round(screenY)})`)
    const shotsBeforeTap = game.shots
    await sendTouch('touchStart', [{ gx: switchTarget.x, gy: screenY, id: 7 + attempt }])
    await touchEnd()
    await page.waitForTimeout(380)
    const after = await state()
    assert(after.shots > shotsBeforeTap, 'the tap fired a projectile')
    switchHit = after.switchesHit > 0
  }
  game = await state()
  assert.equal(switchHit, true, 'a tapped shot activated the switch')
  assert.equal(game.hatchesOpen > 0, true, 'the switch opened its hatch')
  step(`switch hit by tap; ${game.hatchesOpen} hatch open`)

  // Pause and resume with the real HUD controls.
  await sendTouch('touchStart', [{ gx: 620, gy: 56, id: 9 }])
  await touchEnd()
  await page.waitForTimeout(260)
  assert.equal((await state()).paused, true, 'pause overlay opens')
  await page.screenshot({ path: '/tmp/switchshot-pause.png' })
  await sendTouch('touchStart', [{ gx: 360, gy: 540, id: 10 }])
  await touchEnd()
  await page.waitForTimeout(260)
  assert.equal((await state()).paused, false, 'resume button closes the overlay')
  step('pause/resume OK')

  // Complete the room through the real objective path.
  await page.evaluate(() => window.__SWITCHSHOT__.collectGems())
  await page.waitForTimeout(300)
  game = await state()
  assert.equal(game.gems, game.gemsTotal, 'all required gems collected')
  assert.equal(game.exitReady, true, 'exit portal is lit')
  await page.screenshot({ path: '/tmp/switchshot-game.png' })
  await page.evaluate(() => window.__SWITCHSHOT__.teleportToExit())
  await waitScene('Results')
  await page.waitForTimeout(900)
  await page.screenshot({ path: '/tmp/switchshot-results.png' })
  step('results shown')

  const saveAfterLevel = await page.evaluate(() => JSON.parse(localStorage.getItem('switchshot-adventures-save-v1') ?? '{}'))
  assert.equal(saveAfterLevel.levels?.['w1-1']?.completed, true, 'journey clear saved')
  assert(saveAfterLevel.levels['w1-1'].stars >= 1, 'stars saved')
  assert(saveAfterLevel.stats?.gems > 0, 'gem statistics saved')

  // Endless Tower boots into a generated floor.
  await page.evaluate(() => window.__SWITCHSHOT__.launch('w1-1', 'endless'))
  await waitScene('Game')
  await page.waitForTimeout(450)
  const endless = await state()
  assert.equal(endless.mode, 'endless')
  assert.equal(endless.bossStage, 0)
  step('endless tower floor ready')

  // A guardian room: three weak points, then the exit.
  await page.evaluate(() => window.__SWITCHSHOT__.launch('w1-50', 'journey'))
  await waitScene('Game')
  await page.waitForTimeout(700)
  const bossStart = await state()
  assert.equal(bossStart.exitReady, false, 'the guardian seals the exit')
  await page.evaluate(() => window.__SWITCHSHOT__.defeatBoss())
  await page.waitForFunction(() => window.__SWITCHSHOT__?.state()?.exitReady === true, null, { timeout: 6000, polling: 100 })
  await page.screenshot({ path: '/tmp/switchshot-boss.png' })
  await page.evaluate(() => window.__SWITCHSHOT__.teleportToExit())
  await waitScene('Results')
  await page.waitForTimeout(900)
  const saveAfterBoss = await page.evaluate(() => JSON.parse(localStorage.getItem('switchshot-adventures-save-v1') ?? '{}'))
  assert.equal(saveAfterBoss.levels?.['w1-50']?.completed, true, 'guardian clear saved')
  assert(saveAfterBoss.stats?.bossesDefeated >= 1, 'boss statistic saved')
  step('guardian cleared and saved')

  // The save must survive a reload.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.__SWITCHSHOT__), null, { polling: 100 })
  await page.waitForTimeout(900)
  const saveAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('switchshot-adventures-save-v1') ?? '{}'))
  assert.equal(saveAfterReload.levels?.['w1-1']?.completed, true, 'progress survives a reload')

  assert.deepEqual(errors, [], `browser errors: ${errors.join('\n')}`)
  step('all assertions passed')
  console.log(JSON.stringify({
    ok: true,
    viewport: '390x844 touch',
    canvas: {
      width: Math.round(fit.width), height: Math.round(fit.height),
      viewport: `${fit.viewportWidth}x${fit.viewportHeight}`,
    },
    level: {
      id: 'w1-1',
      gems: game.gems,
      gemsTotal: game.gemsTotal,
      stars: saveAfterLevel.levels['w1-1'].stars,
      shots: game.shots,
      hatchesOpen: game.hatchesOpen,
      movedToX: game.player.x,
    },
    boss: {
      cleared: saveAfterBoss.levels['w1-50'].completed,
      bossesDefeated: saveAfterBoss.stats.bossesDefeated,
    },
    screenshots: [
      '/tmp/switchshot-menu.png', '/tmp/switchshot-game.png',
      '/tmp/switchshot-results.png', '/tmp/switchshot-boss.png',
    ],
    consoleErrors: errors,
  }, null, 2))
} catch (error) {
  console.error('[smoke] FAILED', error)
  console.error('[smoke] browser errors', errors)
  await page.screenshot({ path: '/tmp/switchshot-failure.png' }).catch(() => undefined)
  throw error
} finally {
  if (!process.env.CDP_URL) await browser.close()
}
