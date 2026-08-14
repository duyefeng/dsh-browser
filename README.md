# dsh-browser

> Playwright-backed browser automation for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Drive a real Microsoft Edge browser from your agent — **no CDP endpoint, no MCP server**.

`dsh-browser` is a DeepSeek Harness **bundle** (an installable plugin). Install it into a profile, and the agent gains a `browser_*` tool suite that opens a real browser, reads pages, clicks, types, and screenshots — driven in-process by Playwright over the installed Edge.

---

## Why

- **Zero extra infra.** It launches Edge directly through Playwright's `msedge` channel. You don't set up a Chrome DevTools port and you don't run an MCP server.
- **Real browser.** Because it drives Edge, pages behave exactly like the user's own browsing (cookies, JS, redirects, login).
- **Per-conversation isolation.** One shared browser process, but each agent conversation gets its own context — tabs, cookies, and login state never leak between sessions, and they're cleaned up when the conversation ends.

## Requirements

- Node.js 22+
- The `dsh` CLI (or a source checkout run as `pnpm dsh`)
- **Microsoft Edge** installed (Playwright uses it via the `msedge` channel — no browser download)

## Install

Install into a profile:

```sh
# from GitHub
dsh plugin --profile <profile> add github:duyefeng/dsh-browser

# or from npm, once published
dsh plugin --profile <profile> add dsh-browser
```

Then boot the profile:

```sh
dsh --profile <profile>
```

For the web UI surface, use the `web` profile:

```sh
dsh plugin --profile web add github:duyefeng/dsh-browser
dsh web
```

> **Note:** install into the profile, then restart it. The bundle layer is read at boot — a plain `dsh web` restart without the `add` does nothing.

## Tools

| Tool | Description |
| --- | --- |
| `browser_navigate(url)` | Open a URL (bare hosts upgrade to `https://`). Returns the final URL and page title. |
| `browser_snapshot()` | Read the current page: URL, title, visible text, and interactive elements with CSS selectors. |
| `browser_click(selector)` | Click the first element matching a CSS selector. |
| `browser_type(selector, text)` | Replace the value of an input / textarea. |
| `browser_press(key)` | Press a key (`Enter`, `Tab`, `Escape`, `ArrowDown`, …). |
| `browser_evaluate(expression)` | Run a JavaScript expression in the page and return its JSON value. |
| `browser_screenshot()` | Capture the page as a PNG and return its path (view with `read_image`). |
| `browser_close()` | Close this conversation's browser session. |

### Example prompt

> Open https://example.com, read the page, and tell me the title and body.

The agent calls `browser_navigate` → `browser_snapshot` and answers from the returned content.

## Configuration

The bundle inserts a `browser` service row with these defaults. Override them in the profile's own `cordis.patch.yml` (a later layer wins per row):

```yaml
- id: browser
  config:
    channel: msedge      # Playwright channel; msedge = installed Edge
    headless: false      # false = visible browser window, true = headless
    timeoutMs: 30000     # per-operation Playwright timeout (ms)
    screenshotDir: null  # where screenshots land; null = OS temp dir
```

## How it works

The bundle contributes two host-plane rows through its `cordis.patch.yml`:

- `browser` — the `ctx.browser` service. Owns one shared, lazily launched Playwright browser and a per-agent `BrowserContext` keyed by the agent's session id.
- `tool-browser` — registers the `browser_*` tools into the host `tools` registry, visible to every session.

Because the tools register at the host plane, they're available in every agent session without any preset wiring — installing this one bundle is all that's needed.

## Local development

The `@deepseek-ai/cordis` / `@deepseek-ai/dsh-tools` imports resolve from the harness installation at runtime, so this package never fetches them from npm. A local `pnpm install` therefore installs only `playwright-core`:

```sh
pnpm install
pnpm pack          # produces dsh-browser-0.1.0.tgz
dsh plugin --profile demo add ./dsh-browser-0.1.0.tgz
dsh --profile demo
```

> **Gotcha:** `dsh plugin add ./dsh-browser` (a bare directory path) installs with a `link:` spec that symlinks to the checkout *outside* the profile, which breaks resolution of the harness peers (`Cannot find package '@deepseek-ai/…'`). Always `pnpm pack` and add the tarball (or use `github:`/npm) instead.

## Verify it's mounted

```sh
dsh --profile demo --dump-config
```

The output should contain:

```
# == dsh-browser
- id: browser
  name: dsh-browser
- id: tool-browser
  name: dsh-browser/tool
```

## License

[MIT](./LICENSE)
