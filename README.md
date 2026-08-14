# dsh-browser

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的浏览器插件。装上之后，AI 就能直接开一个真实的 Edge 浏览器去逛网页、点按钮、填表单、截图——**不用配 CDP、也不用跑 MCP**，装完就能用。

底层是 Playwright，直接驱动你电脑上已经装好的 Edge，所以页面行为和真人浏览完全一致（cookie、JS、登录态都在）。

## 怎么用

一行命令安装：

```sh
pnpm dsh plugin --profile web add github:duyefeng/dsh-browser
```

然后启动：

```sh
pnpm dsh web
```

> 小提醒：装完之后要**重启**一下 profile。插件是在启动时读取的，光重启不 `add` 等于没装。

装好之后，直接在对话里说人话就行，比如：

- “打开 example.com，读一下正文，告诉我标题”
- “打开百度搜‘天气’，把第一条结果的标题给我”
- “打开这个登录页，填好账号密码，截个图给我看”

AI 会自动调用对应的浏览器工具。

## 有哪些工具

| 工具 | 干嘛的 |
| --- | --- |
| `browser_navigate(url)` | 打开网址 |
| `browser_snapshot()` | 读取当前页面（标题、正文、可点元素） |
| `browser_click(selector)` | 点击某个元素 |
| `browser_type(selector, text)` | 往输入框里填字 |
| `browser_press(key)` | 按键盘（Enter、Tab、Esc…） |
| `browser_evaluate(expression)` | 在页面里跑一段 JS |
| `browser_screenshot()` | 截图，返回图片路径 |
| `browser_close()` | 关掉本次会话的浏览器 |

## 想改默认行为

在 profile 自己的 `cordis.patch.yml` 里覆盖 `browser` 这一行就行：

```yaml
- id: browser
  config:
    channel: msedge      # 浏览器渠道，msedge = 用已装的 Edge
    headless: false      # false = 弹窗（能看到浏览器），true = 无头后台跑
    timeoutMs: 30000     # 单次操作的超时（毫秒）
```

## 环境要求

- Node.js 22+
- 装了 Microsoft Edge（没有其他浏览器也行，就是需要 Edge）
- 有 `dsh` 命令行（或源码 checkout 里用 `pnpm dsh`）

## License

[MIT](./LICENSE)
