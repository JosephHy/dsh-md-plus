# dsh-md-plus

给 DeepSeek Harness Web / Desktop 的 Markdown 显示增强插件。目前做四件事：**代码块卡片重做**（含消掉头部空白）、**补上 DSH 不认识的语言的语法高亮**、**自己渲染 mermaid 图形**、**表格样式重做**。

![dsh-md-plus 显示效果预览](<docs/preview.png>)

## 它解决什么

### 一、代码块样式

DSH 原生的代码块头部是「小灰字 + 文字复制按钮」，没写语言时左边整片是空的，卡顶到第一行代码之间还留着一大段纯空白。本插件把它重做成一张完整的卡片：

| 元素 | 改前 | 改后 |
|---|---|---|
| 头部左侧 | 空（无语言时） | `</>` 图标 + 语言名；无语言显示 `Plain text` |
| 头部右侧 | 文字「复制」 | 图标按钮：不换行 + 复制 |
| 顶栏背景 | 与卡片之间有一条白带 | 与卡片同色，整块一个卡片 |
| 卡顶到代码 | 一大段空白 | 约一行代码高 |

样式是纯 CSS 打在 `.md-code-block` 上，所以**所有语言**（包括 DSH 自己高亮的 JSON/TS/Python…）都吃同一套外观。想微调间距就改 `src/client.js` 里 `banner` 的 `padding` 末位和 `pre` 的 `padding` 首位。

### 二、语法高亮

DSH 只认死 26 种语言，其余走 `pre.plain` 纯文本回退——**没有颜色，看上去就是一堆源码**。`dart` 就不在表里：

```dart
class CodeCard extends StatelessWidget {
  const CodeCard({super.key, required this.language});

  final String language;
}
```

本插件把这类块捡出来用自带的 Shiki 重新上色；DSH 认的语言一律不碰（但样式照样吃）。

### 三、mermaid 图形

mermaid 围栏由本插件自己渲染成 SVG，**不需要 dsh-mermaid**。头部右侧可以在「图形 / 代码」之间切换，复制按钮复制的仍是图源。配色与节点圆角 token 都在 `src/mermaid-theme.js`。

顺带修掉了 dsh-mermaid 一个真 bug：它靠**代码第一个词**判断图类型，而那 25 个词的名单里漏了 `graph`（`graph LR` 和 `flowchart LR` 等价），所以 `graph LR` 的图它一律画不出来。本插件改成读头部显示的语言名，两种写法都能画。

### 四、表格样式

DSH 原生的表格是「无边框 + 半透明分隔线 + 表头没有底色」，表头和数据分不开，首列还贴着左边缘。照参考图重做成：

| 元素 | 取值 |
|---|---|
| 表头底 / 字 | `#f7f7f7` / `#181818` 加粗 |
| 边框 | `#ebebeb` 1px，只有横线、无竖线 |
| 圆角 | 外 8px / 内 7px，只收外圈四角 |
| 首 / 末列内边距 | 16px（DSH 原本清零） |
| 悬停行 | `#fafafa` 轻微高亮 |

两个坑：`border-collapse: collapse` 下 Chrome 会忽略单元格圆角，所以走 `separate` + `border-spacing: 0`；另外裸写 `tr:last-child` 会连表头一起收圆（表头行是 `thead` 的唯一一行），四个角必须按上沿 `thead`、下沿 `tbody` 分开写。想调圆角改 `TABLE_VARS` 里的 `--md-plus-tbl-radius`（内圆角跟着减 1px）。

深色主题另配了一套（`#1f1f1f` 表头 / `#2f2f2f` 线）。抓手用的是结构选择器 `div:has(> table)` 而不是 DSH 的哈希类名，所以 DSH 换哈希也不会失效。

## 安装

```powershell
dsh plugin --profile desktop add dsh-md-plus
```

或者：

```powershell
dsh plugin --profile desktop add github:JosephHy/dsh-md-plus
```


## 卸载

```powershell
dsh plugin --profile desktop remove dsh-md-plus
```

## 开发

```powershell
npm install       # 会顺带跑 prepare → build，装完 lib/ 就是新的
npm run build     # 产出 lib/ 下四个文件
npm run check     # 语法检查 + 45 条 host/client 行为测试
npm run preview   # 离线生成 preview.html（含真渲出来的 mermaid 图）
npm run shot      # 用 headless Chrome 把 preview.html 截成 docs/preview.png
```


注意测试跑的是 `lib/` 里的构建产物，所以顺序永远是 **先 `npm run build` 再 `npm test`**（`npm run check` 不含 build）。


## 已知边界

- 两个运行时按需加载：高亮约 6.5 MB（171 门语言语法），mermaid 约 3.4 MB。都只在真正用到时才下载；**首次**遇到新语言时多花约 100ms 解析。
- 依赖 DSH 的 `.md-code-block`、`[data-code-block-content]`、`[data-code-block-banner]`、`data-streaming` 这几个稳定钩子。DSH 升级若改了它们，需要跟着改 `src/client.js` 顶部的选择器常量。
- 头部图标按钮里那个「不换行」是插件自己加的（`decorate()` 往 `.action` 里插一个 `<button>`）。参考图里那个 `→|` 图标原功能未知，先做成了横向滚动切换，要换功能改一处即可。
- **滚轮缩放会接管页面滚动**：鼠标悬在图上时滚轮用来缩放，页面不会跟着滚。想改成按住 `Ctrl/⌘` 才缩放，只需在 `bindViewport()` 的 wheel 回调开头加一句 `if (!event.ctrlKey && !event.metaKey) return;`。
- 很宽的图会被缩到容器宽度，字会变小；放大后靠拖拽看细节。
- 目前只做代码块、mermaid 与表格。引用、列表间距、标题层级、目录等属于后续阶段。

## 许可证

MIT，见 [LICENSE](./LICENSE)。
