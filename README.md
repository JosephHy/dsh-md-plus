# dsh-md-plus

给 DeepSeek Harness Web / Desktop 的 Markdown 显示增强插件，做四件事：重做代码块卡片、给 DSH 不认识的语言补语法高亮、自己渲染 mermaid 图形、重做表格样式。

![dsh-md-plus 显示效果预览](<docs/preview.png>)

## 它解决什么

### 代码块样式

DSH 原生的头部是「小灰字 + 文字复制按钮」，没写语言时左边空一片，卡顶到第一行代码之间还留着大段空白。重做成一张完整的卡片：

| 元素 | 改前 | 改后 |
|---|---|---|
| 头部左侧 | 空（无语言时） | `</>` 图标 + 语言名，无语言显示 `Plain text` |
| 头部右侧 | 文字「复制」 | 图标按钮：不换行 + 复制 |
| 顶栏背景 | 与卡片之间有一条白带 | 与卡片同色 |
| 卡顶到代码 | 一大段空白 | 约一行代码高 |

样式是纯 CSS 打在 `.md-code-block` 上，所以所有语言（包括 DSH 自己高亮的 JSON/TS/Python）都吃同一套外观。想调间距，改 `src/client.js` 里 banner 的 `padding` 末位和 pre 的 `padding` 首位。



### mermaid 图形

mermaid 围栏由插件渲染成 SVG，头部右侧可在「图形 / 代码」之间切换，复制按钮复制的仍是图源。配色和节点圆角在 `src/mermaid-theme.js`。

复杂时序图、长流程图可以点右上角的全屏图标：在覆盖层里默认「适应整图」，也支持滚轮缩放、拖拽和双击适应，按 Esc 关闭。聊天内的普通缩放仍然保留。

认图先看头部语言名（`mermaid` / `mmd` / `mermaidjs`），认不出再看正文里的类型声明（`flowchart`、`graph`、`sequenceDiagram` 等）。0.2.0-rc.2 上头部是占位文案，走的就是正文这条。

### 表格样式

DSH 原生表格无边框、分隔线半透明、表头没底色，首列还贴着左边缘。重做成：

| 元素 | 取值 |
|---|---|
| 表头底 / 字 | `#f7f7f7` / `#181818` 加粗 |
| 边框 | `#ebebeb` 1px，只有横线 |
| 圆角 | 外 8px / 内 7px，只收外圈四角 |
| 首 / 末列内边距 | 16px（DSH 原本清零） |
| 悬停行 | `#fafafa` |

深色主题另有一套（`#1f1f1f` 表头 / `#2f2f2f` 线）。抓手用结构选择器 `div:has(> table)` 而不是 DSH 的哈希类名，DSH 换哈希也不失效。

## 安装与卸载

```powershell
dsh plugin --profile desktop add dsh-md-plus      # 也可以用 github:JosephHy/dsh-md-plus
dsh plugin --profile desktop remove dsh-md-plus
```

## 开发

```powershell
npm install       # 顺带跑 prepare → build
npm run build     # 产出 lib/ 下四个文件
npm run check     # 语法检查 + 53 条测试
npm run preview   # 生成 preview.html（含真渲出来的 mermaid 图）
npm run shot      # 用 headless Chrome 把 preview.html 截成 docs/preview.png
```

测试跑的是 `lib/` 里的产物，所以先 `npm run build` 再 `npm test`（`npm run check` 不含 build）。

测试和预览页里的代码块都按聊天区的真实头部形状搭（`CodeToolbar`，语言名走占位回退）。

## 已知边界

- 0.2.0-rc.2 起，头部那行语言名由宿主决定显示什么：认这门语言就显示语言名，不认就显示本地化占位文案（中文「代码块」）。认不出来就读不到围栏语言，插件无法转化，且还不报错。mermaid 这条改看正文：跳过 `%%` 注释和开头的 `---` frontmatter，正文里有行以 mermaid 类型关键字开头就当图。这条只管认图，不参与补高亮的判断。
- 同一个原因让补高亮在 0.2.0-rc.2 上基本失效：`gdscript`、`nushell` 这类 DSH 不认的语言，头部是占位文案，插件问不到 Shiki 该用哪套语法，只能没颜色。反过来 DSH 认得的那 108 种（`dart`、`vue`、`scala` …）由 DSH 自己上色，插件不碰。
- `DSH_LANGS` 是 DSH `LANG_ALIASES` 的快照（对齐 108 条）。DSH 加语言后这份快照会落后，落后只会让它多管一门 DSH 也在管的高亮 —— 撤回兜底能保证不出现双份，但会白干一次高亮；想干净就跟着同步。
- mermaid 12 的新图种（`usecase-beta`、`agentflow-beta`）标识符只认字母数字下划线，中文得写进标签：`actor Customer("用户")` 可以，`actor 用户` 会解析失败。
- 高亮约 6.4 MB、mermaid 约 5.0 MB，按需下载，第一次用到时多花约 100ms 解析。
- 依赖宿主 `.md-code-block`、`[data-code-block-content]`、`[data-code-block-banner]`、`data-streaming` 这几个钩子，DSH 改了要跟着改 `src/client.js` 顶部的常量和 `MMD_TYPE`。
- 目前只管代码块、mermaid 和表格。

## 许可证

MIT，见 [LICENSE](./LICENSE)。
