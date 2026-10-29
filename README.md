# dsh-md-plus

给 DeepSeek Harness Web / Desktop 的 Markdown 阅读增强插件：重做代码块卡片、给 DSH 不认识的语言补语法高亮、自己渲染 mermaid 图形、重做表格样式并支持复制、图片点击放大，以及一个调整显示参数的设置面板。

![dsh-md-plus 显示效果预览](<docs/preview.png>)

## 功能

- **代码块**：统一成完整卡片，头部显示 `</>` 图标和语言名（无语言显示 `Plain text`），保留宿主原生的换行与复制按钮，顶栏与卡片同色。
- **Mermaid**：围栏渲染成 SVG，可在「图形 / 代码」间切换；支持全屏查看（滚轮缩放、拖拽、双击适应、Esc 关闭）、四套配色，以及下载 SVG / PNG。
- **长内容折叠**：代码块、表格、图表超过阈值自动折叠，底部出现「展开 / 收起」，长日志和长表格不会撑满聊天。
- **表格**：浅色 / 深色两套样式，表头吸顶；每张表上方右侧有「CSV / Markdown」复制按钮。
- **图片放大**：只在旧宿主没有原生预览按钮时兜底，点击图片打开暗色预览，Esc 或点遮罩关闭；新版 DSH 的原生预览、头像、图标、代码块和链接里的图片都不接管。
- **设置面板**：右下角齿轮可调 Mermaid 配色、代码字号、图表默认视图和三类折叠阈值，阈值下方会注明按高度判断。设置存在 `localStorage`，界面文案跟随页面 `<html lang>` 切换中英文。

## 安装与卸载

```powershell
dsh plugin --profile desktop add dsh-md-plus      # 也可以用 github:JosephHy/dsh-md-plus
dsh plugin --profile desktop remove dsh-md-plus
```

## 开发

需要 Node.js ≥ 22.19。

```powershell
npm install       # 顺带跑 prepare → build
npm run build     # 产出 lib/ 下四个文件
npm run check     # 语法检查 + 65 条测试（先 build 再跑，check 不含 build）
npm run preview   # 生成 preview.html（含真渲出来的 mermaid 图）
npm run shot      # 用 headless Chrome 把 preview.html 截成 docs/preview.png
```

## 已知限制

- DSH 0.2.0-rc.2 上，头部语言名由宿主决定：不认这门语言就显示占位文案「代码块」，插件读不到围栏语言，补高亮基本失效。mermaid 因此改看正文里的类型声明来识别。
- `DSH_LANGS` 是 DSH 语言表的快照（108 条）。宿主加语言后这份快照会落后，落后只会多一次无效处理，不会出现双份高亮。
- mermaid 12 的新图种（`usecase-beta`、`agentflow-beta`）标识符只认字母数字下划线，中文得写进标签：`actor Customer("用户")` 可以，`actor 用户` 会解析失败。
- 高亮约 6.4 MB、mermaid 约 5.0 MB，按需下载，第一次用到时多花约 100ms 解析。
- 依赖宿主 `.md-code-block`、`[data-code-block-content]`、`[data-code-block-banner]`、`data-streaming` 等钩子，DSH 改版后要同步调整 `src/client.js`。

目前只影响代码块、mermaid、表格、正文图片和显示设置，不改 Markdown 的解析结果。

## 许可证

MIT，见 [LICENSE](./LICENSE)。
