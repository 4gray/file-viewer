import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, webkit } from 'playwright'
import { startRegressionDemo } from './regression-demo-server.mjs'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const output = resolve(root, '.release/structured-preview-issues')
await mkdir(output, { recursive: true })
const demo = await startRegressionDemo(root)
const buildInfo = JSON.parse(await readFile(resolve(root, 'apps/viewer-demo/dist/build-info.json'), 'utf8'))
const report = { buildInfo, origin: demo.origin, cases: [] }
const fixture = name => readFile(resolve(root, 'apps/viewer-demo/public/example', name), 'utf8')
const sha256 = text => createHash('sha256').update(text).digest('hex')

async function assertWatermarkUncovered(bpmn) {
  const mark = bpmn.locator('.bjs-powered-by')
  assert.ok(await mark.isVisible())
  const visible = await mark.evaluate(element => {
    const rect = element.getBoundingClientRect()
    if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight) return false
    return [[0.1, 0.1], [0.9, 0.1], [0.5, 0.5], [0.1, 0.9], [0.9, 0.9]].every(([x, y]) => {
      const left = rect.left + rect.width * x
      const top = rect.top + rect.height * y
      let hit = document.elementFromPoint(left, top)
      while (hit?.shadowRoot) {
        const nested = hit.shadowRoot.elementFromPoint(left, top)
        if (!nested || nested === hit) break
        hit = nested
      }
      return hit === element || element.contains(hit)
    })
  })
  assert.ok(visible, 'The bpmn.io watermark must not be covered by Demo controls')
}

async function sample(page, filename, family) {
  await page.locator('.viewer-file-identity').hover()
  await page.locator('.rail-nav-button--samples:not([aria-hidden="true"])').click()
  const groups = page.locator(`.sample-menu .sample-group[data-family="${family}"]`)
  for (const group of await groups.all()) {
    const header = group.locator('.sample-group-header')
    if (await header.getAttribute('aria-expanded') !== 'true') await header.click()
    const card = group.locator('.sample-card').filter({ has: page.locator('.sample-card-copy > span', { hasText: new RegExp(`^${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) })
    if (await card.count()) {
      await card.click()
      await page.locator('.sample-menu').waitFor({ state: 'hidden' })
      return
    }
  }
  throw new Error(`Missing visible sample: ${filename}`)
}

try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    if (process.env.STRUCTURED_PREVIEW_BROWSERS && !process.env.STRUCTURED_PREVIEW_BROWSERS.split(',').includes(name)) continue
    const browser = await engine.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 820 } })
    const page = await context.newPage()
    page.setDefaultTimeout(30000)
    const errors = []
    const requests = []
    const externalRequests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requests.push(request.url()))
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin === demo.origin) return route.continue()
      externalRequests.push(route.request().url())
      return route.abort()
    })
    try {
      await page.goto(`${demo.origin}/?locale=en-US`)
      await sample(page, 'simple-process.bpmn', 'drawing')
      const bpmn = page.locator('.fv-bpmn[data-bpmn-status="ready"]')
      await bpmn.waitFor({ state: 'visible' })
      assert.ok(await bpmn.locator('.djs-element').count() >= 7)
      await assertWatermarkUncovered(bpmn)
      const source = await fixture('simple-process.bpmn')
      await bpmn.locator('[data-bpmn-action="source"]').click()
      assert.equal(await bpmn.locator('.fv-bpmn-source').textContent(), source)
      await bpmn.locator('[data-bpmn-action="diagram"]').click()
      const zoom = await bpmn.locator('output').textContent()
      await bpmn.locator('[data-bpmn-action="zoom-in"]').click()
      assert.notEqual(await bpmn.locator('output').textContent(), zoom)
      await page.screenshot({ path: resolve(output, `${name}-bpmn.png`) })
      await page.setViewportSize({ width: 390, height: 844 })
      await bpmn.locator('[data-bpmn-action="fit"]').click()
      await assertWatermarkUncovered(bpmn)
      await page.screenshot({ path: resolve(output, `${name}-bpmn-narrow.png`) })
      await page.setViewportSize({ width: 1280, height: 820 })

      await sample(page, 'invoice-valid.xml', 'code')
      const xml = page.locator('.xml-profile-viewer[data-xml-profile="invoice-v1"]')
      await xml.waitFor({ state: 'visible' })
      const frame = page.frameLocator('.xml-profile-rendered')
      await frame.locator('h1').waitFor({ state: 'visible' })
      assert.equal(await frame.locator('h1').textContent(), 'Invoice INV-1001')
      assert.equal(await page.locator('.xml-profile-rendered').getAttribute('sandbox'), '')
      const countBeforeToggle = requests.length
      const invoice = await fixture('xml-profiles/invoice-valid.xml')
      await xml.locator('button[data-xml-view="source"]').click()
      assert.equal(await xml.locator('code').textContent(), invoice)
      await xml.locator('button[data-xml-view="rendered"]').click()
      assert.equal(requests.length, countBeforeToggle, 'Toggling must reuse the loaded source and transformation')
      await page.screenshot({ path: resolve(output, `${name}-xml.png`) })

      await sample(page, 'invoice-invalid.xml', 'code')
      await page.locator('.xml-profile-diagnostics').filter({ hasText: 'xsd-invalid' }).waitFor({ state: 'visible' })
      assert.equal(await page.locator('.xml-profile-rendered').count(), 0)
      assert.equal(await page.locator('.xml-profile-source code').textContent(), await fixture('xml-profiles/invoice-invalid.xml'))

      await sample(page, 'change.patch', 'code')
      const panes = page.locator('.patch-viewer .d2h-file-side-diff')
      await panes.first().waitFor({ state: 'visible' })
      const left = await panes.nth(0).boundingBox()
      const right = await panes.nth(1).boundingBox()
      assert.ok(left && right && Math.abs(left.y - right.y) < 1 && right.x > left.x)
      const row = await panes.nth(0).locator('tr').last().boundingBox()
      assert.ok(row.height < 35, `Patch row height was ${row.height}`)
      await page.screenshot({ path: resolve(output, `${name}-patch.png`) })
      assert.deepEqual(errors, [])
      assert.deepEqual(externalRequests, [])
      report.cases.push({ browser: name, version: browser.version(), bpmnSha256: sha256(source), xmlSha256: sha256(invoice), patchRowHeight: row.height, passed: true })
    } catch (error) {
      await page.screenshot({ path: resolve(output, `${name}-failure.png`) })
      report.cases.push({ browser: name, passed: false, error: String(error), errors, externalRequests, diagnostics: await page.locator('.xml-profile-diagnostics').allTextContents(), text: await page.locator('body').innerText() })
      throw error
    } finally { await context.close(); await browser.close() }
  }
} finally {
  await writeFile(resolve(output, 'CURRENT.json'), JSON.stringify(report, null, 2) + '\n')
  await demo.close()
}
console.log(`Built Demo: BPMN/source/zoom, XML WASM/rendered/source/fallback and Patch layout passed in ${report.cases.map(result => result.browser).join(', ')}.`)
