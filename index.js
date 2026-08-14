// dsh-browser — Playwright-backed browser automation service.
// Drives the installed Microsoft Edge directly: no CDP endpoint, no MCP server.
//
// The service owns one shared, lazily launched browser process. Browser state
// (cookies, storage, tabs) is isolated per agent: each agent session gets its
// own BrowserContext keyed by the agent's session id.

import { Service } from '@deepseek-ai/cordis'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

const SNAPSHOT_TEXT_BUDGET = 12000
const SNAPSHOT_ELEMENT_BUDGET = 200

export class BrowserRuntime extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'browser')
    this.channel = config.channel ?? 'msedge'
    this.headless = config.headless ?? false
    this.timeoutMs = config.timeoutMs ?? 30000
    this.screenshotDir = config.screenshotDir ?? join(tmpdir(), 'dsh-browser')
    this.browserPromise = undefined
    this.sessions = new Map()

    // Close one agent's isolated context when that agent is disposed.
    this.ctx.on('agent/disposed', (payload) => {
      void this.closeSession(payload.agent.id)
    })

    // Dispose the shared browser when the service is stopped.
    this.ctx.effect(() => () => {
      void this.dispose()
    })
  }

  async browser() {
    if (this.browserPromise === undefined) {
      this.browserPromise = (async () => {
        const { chromium } = await import('playwright-core')
        try {
          return await chromium.launch({ channel: this.channel, headless: this.headless })
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          throw new Error(
            `could not launch the browser (channel "${this.channel}"): ${message}. `
            + 'Make sure Microsoft Edge is installed and the browser channel is available.',
          )
        }
      })()
    }
    return await this.browserPromise
  }

  async session(id) {
    const existing = this.sessions.get(id)
    if (existing !== undefined) return existing
    const browser = await this.browser()
    const context = await browser.newContext()
    const page = await context.newPage()
    const created = { id, context, page }
    this.sessions.set(id, created)
    return created
  }

  async navigate(id, url) {
    const { page } = await this.session(id)
    const target = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) ? url : `https://${url}`
    try {
      await page.goto(target, { waitUntil: 'load', timeout: this.timeoutMs })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`browser_navigate failed for "${target}": ${message}`)
    }
    return { url: page.url(), title: await page.title() }
  }

  async snapshot(id) {
    const { page } = await this.session(id)
    const raw = await page.evaluate(() => {
      const root = document.body
      const text = (root !== null ? root.innerText : '').trim()
      const elements = []
      const seen = new Set()
      const candidates = root !== null
        ? root.querySelectorAll('a,button,input,textarea,select,[role="button"],[role="link"],[role="textbox"],[contenteditable="true"]')
        : []
      for (const element of Array.from(candidates)) {
        const tag = element.tagName.toLowerCase()
        const id = element.getAttribute('id')
        const name = element.getAttribute('name')
        const label = (element.getAttribute('aria-label') ?? element.getAttribute('placeholder') ?? element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 160)
        const selector = id !== null && id !== '' && !seen.has('#' + id) ? '#' + id : tag
        if (seen.has(selector)) continue
        seen.add(selector)
        elements.push({
          tag,
          ...(id !== null && id !== '' ? { id } : {}),
          ...(name !== null && name !== '' ? { name } : {}),
          text: label,
          selector,
        })
      }
      return { url: location.href, title: document.title, text, elements }
    })
    const elements = raw.elements.slice(0, SNAPSHOT_ELEMENT_BUDGET)
    return {
      url: raw.url,
      title: raw.title,
      text: raw.text.slice(0, SNAPSHOT_TEXT_BUDGET),
      elements,
      truncated: raw.text.length > SNAPSHOT_TEXT_BUDGET || raw.elements.length > SNAPSHOT_ELEMENT_BUDGET,
    }
  }

  async click(id, selector) {
    const { page } = await this.session(id)
    try {
      await page.locator(selector).first().click({ timeout: this.timeoutMs })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`browser_click failed for "${selector}": ${message}`)
    }
  }

  async type(id, selector, text) {
    const { page } = await this.session(id)
    try {
      await page.locator(selector).first().fill(text, { timeout: this.timeoutMs })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`browser_type failed for "${selector}": ${message}`)
    }
  }

  async press(id, key) {
    const { page } = await this.session(id)
    try {
      await page.keyboard.press(key)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`browser_press failed for "${key}": ${message}`)
    }
  }

  async evaluate(id, expression) {
    const { page } = await this.session(id)
    try {
      return await page.evaluate(expression)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`browser_evaluate failed: ${message}`)
    }
  }

  async screenshot(id) {
    const { page } = await this.session(id)
    mkdirSync(this.screenshotDir, { recursive: true })
    const path = join(this.screenshotDir, `browser-${id.slice(0, 8)}-${Date.now()}.png`)
    try {
      await page.screenshot({ path })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`browser_screenshot failed: ${message}`)
    }
    const size = page.viewportSize()
    return { path, width: size ? size.width : 0, height: size ? size.height : 0 }
  }

  async closeSession(id) {
    const session = this.sessions.get(id)
    if (session === undefined) return
    this.sessions.delete(id)
    await session.context.close().catch(() => {})
  }

  async dispose() {
    const sessions = [...this.sessions.values()]
    this.sessions.clear()
    await Promise.all(sessions.map((session) => session.context.close().catch(() => {})))
    if (this.browserPromise !== undefined) {
      const browser = await this.browserPromise.catch(() => undefined)
      if (browser !== undefined) await browser.close().catch(() => {})
      this.browserPromise = undefined
    }
  }
}

export default BrowserRuntime
