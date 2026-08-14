# dsh-browser

Playwright-backed browser automation for the DeepSeek Harness. It drives the installed **Microsoft Edge** directly — no CDP debugging port and no MCP server — and exposes a `browser_*` tool suite to the agent.

## What you get

| Tool | What it does |
| --- | --- |
| `browser_navigate(url)` | Open a URL (bare hosts upgrade to `https://`). |
| `browser_snapshot()` | Read the page: URL, title, text, and interactive elements with CSS selectors. |
| `browser_click(selector)` | Click the first element matching a CSS selector. |
| `browser_type(selector, text)` | Replace the value of an input. |
| `browser_press(key)` | Press a key (`Enter`, `Tab`, `Escape`, `ArrowDown`, …). |
| `browser_evaluate(expression)` | Run a JS expression in the page. |
| `browser_screenshot()` | Save the page as PNG and return its path (view with `read_image`). |
| `browser_close()` | Close this conversation's browser session. |

The browser process is shared; each agent conversation gets an isolated context (tabs, cookies, login state), closed automatically when the conversation ends.

## Requirements

- Node.js 22+ and the DeepSeek Harness CLI.
- **Microsoft Edge** installed (Playwright drives it via the `msedge` channel — no browser download needed).

## Install

From GitHub (the intended way to share it):

```sh
dsh plugin --profile demo add github:you/dsh-browser
```

Or from npm once published:

```sh
dsh plugin --profile demo add dsh-browser
```

Or from a packed tarball (local testing):

```sh
pnpm pack                                   # produces dsh-browser-0.1.0.tgz
dsh plugin --profile demo add ./dsh-browser-0.1.0.tgz
```

Boot the profile:

```sh
dsh --profile demo
```

> **Note on local development:** `dsh plugin add ./dsh-browser` (a bare directory path) installs with a `link:` spec, which symlinks to the checkout *outside* the profile. Node then resolves this package's peer imports (`@deepseek-ai/cordis`, `@deepseek-ai/dsh-tools`) from the checkout instead of the profile's module fallback, so the load fails with `Cannot find package`. Use the tarball (`pnpm pack`) or `file:` form for local testing; `github:`/npm installs materialize the package inside the profile and resolve peers correctly.

## Configuration

The bundle inserts the `browser` service row with these defaults; override them in the profile's `cordis.patch.yml` (a later layer wins per row):

```yaml
- id: browser
  config:
    channel: msedge      # Playwright channel; msedge uses the installed Edge
    headless: false      # set true for a hidden browser window
    timeoutMs: 30000     # per-operation Playwright timeout
```

## Notes

- `headless: false` (default) opens a visible Edge window, matching "open a browser and operate it". Set `headless: true` for headless automation.
- Screenshots are written to the OS temp dir by default; override `screenshotDir` in the `browser` row to choose another location.

## License

MIT
