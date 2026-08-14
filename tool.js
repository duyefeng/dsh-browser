// dsh-browser/tool — model-facing browser_* tools over ctx.browser.

import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-browser'
export const inject = ['tools', 'browser', 'systemPrompt']

const DEFAULT_TIMEOUT_MS = 120000

function browserKey(exec) {
  if (exec.agent === undefined) throw new Error('tool-browser: no agent is driving this tool call')
  return exec.agent.id
}

function formatSnapshot(value) {
  const parts = []
  parts.push(`URL: ${value.url}`)
  if (value.title.length > 0) parts.push(`Title: ${value.title}`)
  if (value.elements.length > 0) {
    const lines = value.elements.map((element, index) => {
      const id = element.id !== undefined ? `#${element.id}` : ''
      const name = element.name !== undefined ? `[name="${element.name}"]` : ''
      const text = element.text.length > 0 ? ` — ${element.text}` : ''
      return `${index + 1}. <${element.tag}${id}${name}>${text} [selector: ${element.selector}]`
    })
    parts.push(`Interactive elements:\n${lines.join('\n')}`)
  }
  if (value.text.length > 0) parts.push(`Text:\n${value.text}`)
  if (value.truncated) parts.push('(Content truncated to the snapshot budget.)')
  return parts.join('\n\n')
}

function textBlock(text) {
  return [{ type: 'text', text }]
}

export function apply(ctx, config = {}) {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS

  ctx.systemPrompt.section({
    name: 'tool:browser',
    order: 120,
    text: 'Use the browser_* tools to open and operate a real web browser (driven directly, no CDP or MCP). Prefer browser_snapshot to read the page, then browser_click / browser_type / browser_press to act, and browser_screenshot to inspect pixels. Close the browser with browser_close when done.',
  })

  ctx.tools.register(defineTool({
    name: 'browser_navigate',
    description: 'Open a URL (or navigate the current tab) in the browser. Accepts a bare host, which is upgraded to https://. Returns the final URL and page title.',
    parameters: {
      url: { type: 'string', required: true, description: 'The URL or bare host to open, e.g. https://example.com or example.com.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
      },
      render: (_args, value) => textBlock(`Navigated to ${value.url} — "${value.title}"`),
    },
    timeoutMs,
    async execute(args, exec) {
      return await ctx.browser.navigate(browserKey(exec), args.url)
    },
    presentCall: (args) => ({ card: 'generic', title: args.url, kind: 'other' }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_snapshot',
    description: 'Read the current page: URL, title, visible text, and a list of interactive elements with suggested CSS selectors. Use this to see what is on screen before clicking or typing.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
          text: { type: 'string', required: true },
          elements: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                tag: { type: 'string', required: true },
                id: { type: 'string' },
                name: { type: 'string' },
                text: { type: 'string', required: true },
                selector: { type: 'string', required: true },
              },
            },
          },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => textBlock(formatSnapshot(value)),
    },
    timeoutMs,
    async execute(_args, exec) {
      const snapshot = await ctx.browser.snapshot(browserKey(exec))
      return {
        url: snapshot.url,
        title: snapshot.title,
        text: snapshot.text,
        elements: snapshot.elements.map((element) => ({
          tag: element.tag,
          ...(element.id !== undefined ? { id: element.id } : {}),
          ...(element.name !== undefined ? { name: element.name } : {}),
          text: element.text,
          selector: element.selector,
        })),
        truncated: snapshot.truncated,
      }
    },
    presentCall: () => ({ card: 'generic', title: 'Read the current page', kind: 'other' }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_click',
    description: 'Click the first element matching a CSS selector on the current page.',
    parameters: {
      selector: { type: 'string', required: true, description: 'CSS selector of the element to click.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true } } },
      render: () => textBlock('Clicked.'),
    },
    timeoutMs,
    async execute(args, exec) {
      await ctx.browser.click(browserKey(exec), args.selector)
      return { ok: true }
    },
    presentCall: (args) => ({ card: 'generic', title: `Click ${args.selector}`, kind: 'other' }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_type',
    description: 'Replace the value of the first element matching a CSS selector (input, textarea, etc.) with the given text.',
    parameters: {
      selector: { type: 'string', required: true, description: 'CSS selector of the input element.' },
      text: { type: 'string', required: true, description: 'The text to type.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true } } },
      render: () => textBlock('Typed.'),
    },
    timeoutMs,
    async execute(args, exec) {
      await ctx.browser.type(browserKey(exec), args.selector, args.text)
      return { ok: true }
    },
    presentCall: (args) => ({ card: 'generic', title: `Type into ${args.selector}`, kind: 'other', rawInput: args.text }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_press',
    description: 'Press a keyboard key on the current page, e.g. Enter, Tab, Escape, ArrowDown, Backspace.',
    parameters: {
      key: { type: 'string', required: true, description: 'Key to press, e.g. Enter, Tab, Escape, ArrowDown.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true } } },
      render: () => textBlock('Pressed.'),
    },
    timeoutMs,
    async execute(args, exec) {
      await ctx.browser.press(browserKey(exec), args.key)
      return { ok: true }
    },
    presentCall: (args) => ({ card: 'generic', title: `Press ${args.key}`, kind: 'other' }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_evaluate',
    description: 'Evaluate a JavaScript expression in the current page and return its JSON value.',
    parameters: {
      expression: { type: 'string', required: true, description: 'A JavaScript expression evaluated in the page, e.g. document.title or document.querySelectorAll("a").length.' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => textBlock(typeof value === 'string' ? value : JSON.stringify(value)),
    },
    timeoutMs,
    async execute(args, exec) {
      const value = await ctx.browser.evaluate(browserKey(exec), args.expression)
      return value === undefined ? null : value
    },
    presentCall: (args) => ({ card: 'generic', title: 'Evaluate in page', kind: 'other', rawInput: args.expression }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_screenshot',
    description: 'Capture the current page as a PNG image and return its filesystem path. Read the image back with the read_image tool to see the pixels.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          width: { type: 'integer', required: true },
          height: { type: 'integer', required: true },
        },
      },
      render: (_args, value) => textBlock(`Screenshot saved to ${value.path} (${value.width}x${value.height}). Use read_image to view it.`),
    },
    timeoutMs,
    async execute(_args, exec) {
      return await ctx.browser.screenshot(browserKey(exec))
    },
    presentCall: () => ({ card: 'generic', title: 'Take a screenshot', kind: 'other' }),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_close',
    description: 'Close the browser session for this conversation, discarding its tabs, cookies, and login state.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true } } },
      render: () => textBlock('Browser closed.'),
    },
    timeoutMs,
    async execute(_args, exec) {
      await ctx.browser.closeSession(browserKey(exec))
      return { ok: true }
    },
    presentCall: () => ({ card: 'generic', title: 'Close the browser', kind: 'other' }),
  }))
}
