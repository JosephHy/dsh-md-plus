// 预览生成：把插件真实跑一遍（happy-dom）拿到它注入的样式和 DOM，再拼上 DSH
// 的真实主题 token 与代码块规则，导出静态页面交给 headless Chrome 截图。
//
// mermaid 图不能在本进程里画（happy-dom 没有排版能力），所以先用 Chrome 跑一趟
// 独立小页面把 SVG 渲出来，再静态内联进预览页——预览页里因此没有任何异步脚本，
// 截图时机不会再出岔子。
//
// 示例内容一律用中性模板（本插件自己的对照表、公开的语法片段），不含任何真实
// 项目信息，所以生成的图可以直接进仓库。
//
//   npm run preview   →  preview.html
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEBOUNCE_MS = 160;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

/** DSH 桌面端应用目录：环境变量优先，其次按常见安装名探测。 */
const APP = [
  process.env.DSH_APP_DIR,
  "D:/develops/DSH Desktop/resources/app",
  "D:/develops/DSH Desktop Beta/resources/app",
]
  .filter((dir) => dir !== undefined)
  .find((dir) => existsSync(join(dir, "node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js")));
if (APP === undefined) throw new Error("找不到 DSH 应用目录，请用 DSH_APP_DIR 指定");

const APP_MODULES = join(APP, "node_modules/@deepseek-ai");

/** shell 样式表的文件名带构建哈希，每版都会变，所以按前缀找。 */
function shellCssFile() {
  const dir = join(APP_MODULES, "dsh-web-frontend/dist/assets");
  const name = readdirSync(dir).find((file) => file.startsWith("index-") && file.endsWith(".css"));
  if (name === undefined) throw new Error(`在 ${dir} 里找不到 index-*.css`);
  return join(dir, name);
}

/** 从 JS bundle 里把内联的 CSS 字符串抠出来。 */
function inlineCss(source, marker) {
  const out = [];
  for (const match of source.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    if (!match[1].includes(marker)) continue;
    try {
      out.push(JSON.parse(`"${match[1]}"`));
    } catch {
      /* 不是合法 JSON 字符串就跳过 */
    }
  }
  return out.join("\n");
}

/** 从 shell 样式表里挑出 markdown 正文（代码块 + 表格）相关的规则。 */
function markdownRules(css) {
  return (css.match(/[^{}]+\{[^{}]*\}/g) ?? []).filter((rule) =>
    /md-code-block|md-table-wide|_(block|banner|bannerWrap|infostring|action|copyButton|content|plain|numbered|line|markdown|tableScroll|tableFill|linkIcon|image|imageAlt|fileMention)_[a-z0-9]+_\d+/.test(
      rule,
    ),
  );
}

/** DSH 的 CSS-in-JS 类名形如 _name_hash_N：名字和序号稳定，hash 每版都会变。 */
function classModules(css) {
  const modules = new Map();
  for (const match of css.matchAll(/\._([A-Za-z]+)_([a-z0-9]+)_(\d+)/g)) {
    if (!modules.has(match[2])) modules.set(match[2], new Map());
    modules.get(match[2]).set(match[1], `_${match[1]}_${match[2]}_${match[3]}`);
  }
  return [...modules.values()];
}

/** 按「必须同时认得这些类名」挑出模块，从而拿到当前 hash 下的完整类名。 */
function classModule(required) {
  const found = MODULES.find((mod) => required.every((name) => mod.has(name)));
  if (found === undefined) throw new Error(`当前 DSH 样式表里找不到含 ${required.join(" / ")} 的模块`);
  return found;
}

const themeCss = inlineCss(readFileSync(join(APP_MODULES, "dsh-client-ui-theme/lib/client.js"), "utf8"), "--dsw-alias-");
const shellCssRaw = readFileSync(shellCssFile(), "utf8");
const shellCss = markdownRules(shellCssRaw).join("\n");
const MODULES = classModules(shellCssRaw);

// 代码块模块认 infostring / copyButton，markdown 正文模块认 tableScroll
const CB = classModule(["block", "bannerWrap", "infostring", "copyButton", "content", "plain"]);
const MD = classModule(["markdown", "tableScroll"]);

/** 预览页里的小标题。 */
function caption(text) {
  return `<div class="_md-plus-cap">${text}</div>`;
}

// ── 1. 让插件在模拟 DOM 里真跑一遍，拿到 CSS 与普通代码块的 DOM ────────
const window = new Window({ url: "http://127.0.0.1:43120/" });
globalThis.window = window;
globalThis.document = window.document;
globalThis.MutationObserver = window.MutationObserver;

await import("../lib/highlight-runtime.js");

let registered = null;
window.__ModuleLoader__ = { load: (entry) => { registered = entry; } };
await import("../lib/client.js");
const plugin = registered.factory(() => {
  throw new Error("client bundle 不该 require 任何模块");
});

/** DSH CodeBlock 的 DOM 形状。 */
function block(lang, code, bodyHtml) {
  return (
    `<div class="${CB.get("block")} md-code-block">` +
    `<div class="${CB.get("bannerWrap")}"><div class="${CB.get("banner")}" data-code-block-banner>` +
    `<div class="${CB.get("infostring")}">${lang}</div>` +
    `<div class="${CB.get("action")}"><button type="button" class="${CB.get("copyButton")}">复制</button></div>` +
    "</div></div>" +
    `<div class="${CB.get("content")}" data-code-block-content>` +
    (bodyHtml ?? `<pre class="${CB.get("plain")}"><code>${code}</code></pre>`) +
    "</div></div>"
  );
}

// 三个示例片段都是中性内容：插件自己的元数据、通用 widget 骨架、仓库结构
const JSON_CODE = [
  "{",
  '  "name": "dsh-md-plus",',
  '  "version": "0.1.0",',
  '  "engines": { "node": ">=22.19.0" }',
  "}",
].join("\n");

const DART_CODE = [
  "class CodeCard extends StatelessWidget {",
  "  const CodeCard({super.key, required this.language});",
  "",
  "  final String language;",
  "}",
].join("\n");

const TREE_CODE = [
  "dsh-md-plus/",
  "├─ src/client.js          浏览器半：注入样式 + 装饰代码块头部",
  "├─ src/mermaid-theme.js   图形配色 token",
  "└─ scripts/build.mjs      产出 lib/ 四个文件",
].join("\n");

// DSH 自己会高亮的 json：用同一套 css-variables 主题预生成，效果等价
const { createHighlighterCore, createCssVariablesTheme } = await import("shiki/core");
const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript");
const theme = createCssVariablesTheme({ name: "css-variables", variablePrefix: "--shiki-", fontStyle: true });
const highlighter = await createHighlighterCore({
  themes: [theme],
  langs: [(await import("@shikijs/langs/json")).default].flat(),
  engine: createJavaScriptRegexEngine({ forgiving: true }),
});
const jsonHtml = highlighter.codeToHtml(JSON_CODE, { lang: "json", theme });

document.body.innerHTML =
  caption("JSON：DSH 自己高亮的语言，照样吃同一套卡片外观") +
  block("JSON", "", `<div>${jsonHtml}</div>`) +
  caption("dart：DSH 内置的 26 种语言之外，由插件用 Shiki 补上颜色") +
  block("dart", DART_CODE) +
  caption("没有写语言：头部照样有图标和 Plain text，不再是一整片空白") +
  block("", TREE_CODE);

plugin.apply({ effect: (fn) => fn() });
await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 400));

const pluginCss = document.querySelector("style[data-md-plus-style]").textContent;
const codeBlocksHtml = document.body.innerHTML;

// ── 2. 借 Chrome 把 mermaid 真渲出来（这一步绕不开浏览器排版）────────
// 两块图：LR 是长扁的长链（用来验最低高度）；TD 用来跟参考图对样式。
const MMD_CARDS = [
  {
    id: "preview-mmd-lr",
    source: [
      "flowchart LR",
      "A[用户提问] --> B[DSH 组装上下文] --> C[模型流式输出] --> D[解析 markdown] --> E[代码块扫描]",
      "E --> F[识别围栏语言] --> G[Shiki 补高亮] --> H[mermaid 画成图形] --> I[插入卡片] --> J[你看到成品]",
    ].join("\n"),
  },
  {
    id: "preview-mmd-td",
    source: [
      "flowchart TD",
      "A[界面处理输入超时] --> B[系统确认应用无响应]",
      "B --> C[开始采集卡顿现场]",
      "C --> D[应用收到提前通知]",
      "D --> E[安排稍后重新启动]",
      "E --> F[立即结束当前进程]",
      "F --> G[调试连接断开]",
      "F --> H[卡顿现场采集中断]",
    ].join("\n"),
  },
];

/** 渲染工作页：把每张图的 SVG 以 base64 写进 out-N，方便从 dump 里抠。 */
function workPage(cards) {
  const calls = cards
    .map(
      ({ source }, index) => `  api.render("work-${index}", ${JSON.stringify(source)}, false)
    .then(function (svg) { document.getElementById("out-${index}").textContent = encode(svg); })
    .catch(function (e) { document.getElementById("out-${index}").textContent = "ERR:" + (e && e.message); });`,
    )
    .join("\n");
  return `<!doctype html><meta charset="utf-8"><body>
${cards.map((_, index) => `<div id="out-${index}"></div>`).join("\n")}
<script src="${pathToFileURL(join(ROOT, "lib/mermaid-runtime.js")).href}"></script>
<script>
function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
var api = window.__DSH_MD_PLUS_MMD__;
if (api === undefined) { document.body.insertAdjacentText("beforeend", "运行时未加载"); }
else {
${calls}
}
</script></body>`;
}

function renderViaChrome(cards) {
  const work = join(ROOT, "_mmd-work.html");
  writeFileSync(work, workPage(cards));
  const dom = execFileSync(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      "--allow-file-access-from-files",
      "--virtual-time-budget=30000",
      "--dump-dom",
      pathToFileURL(work).href,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return cards.map((_, index) => {
    const found = new RegExp(`<div id="out-${index}">([A-Za-z0-9+/=]*)</div>`).exec(dom);
    const value = found?.[1] ?? "";
    if (value === "" || value.startsWith("ERR")) {
      throw new Error(`mermaid 第 ${index} 张图没渲出来：${value || "空"}`);
    }
    return Buffer.from(value, "base64").toString("utf8");
  });
}

const svgs = renderViaChrome(MMD_CARDS);

// ── 3. 拼静态预览页 ──────────────────────────────────────────────────
function mermaidCard({ id }, svg) {
  return (
    `<div class="${CB.get("block")} md-code-block" data-md-plus-mmd="diagram" data-md-plus-zoom="min">` +
    `<div class="${CB.get("bannerWrap")}"><div class="${CB.get("banner")}" data-code-block-banner>` +
    `<div class="${CB.get("infostring")}">mermaid</div>` +
    `<div class="${CB.get("action")}">` +
    '<button type="button" class="md-plus-btn md-plus-zoom-out" title="缩小"></button>' +
    '<button type="button" class="md-plus-btn md-plus-zoom-in" title="放大"></button>' +
    '<button type="button" class="md-plus-btn md-plus-toggle" title="切换图形 / 代码"></button>' +
    `<button type="button" class="${CB.get("copyButton")}">复制</button>` +
    "</div></div></div>" +
    `<div class="${CB.get("content")}" data-code-block-content>` +
    `<div class="md-plus-mmd" id="${id}">` +
    '<div class="md-plus-mmd-viewport"><div class="md-plus-mmd-stage">' +
    svg +
    "</div></div></div>" +
    `<pre class="${CB.get("plain")}"><code></code></pre>` +
    "</div></div>"
  );
}

// ── 4. 表格：内容用本插件自己的改前 / 改后对照 ───────────────────────
const TABLE_HEAD = ["元素", "改前（DSH 原生）", "改后（dsh-md-plus）"];
const TABLE_ROWS = [
  ["头部左侧", "无语言时整片空白", "</> 图标 + 语言名"],
  ["头部右侧", "文字「复制」", "图标：不换行 + 复制"],
  ["顶栏背景", "纯白，与卡片拉开一条带", "与卡片同色，整块一张卡片"],
  ["间距", "卡顶 13px / 头部→代码 34px", "卡顶 15px / 头部→代码 17px"],
  ["覆盖范围", "只有 DSH 内置的那 26 种", "所有语言统一外观"],
];

const tableHtml =
  `<div class="${MD.get("tableScroll")} md-table-wide"><table>` +
  "<thead><tr>" +
  TABLE_HEAD.map((cell) => `<th>${cell}</th>`).join("") +
  "</tr></thead><tbody>" +
  TABLE_ROWS.map(
    (row) => "<tr>" + row.map((cell) => `<td>${cell}</td>`).join("") + "</tr>",
  ).join("") +
  "</tbody></table></div>";

writeFileSync(
  join(ROOT, "preview.html"),
  `<!doctype html>
<meta charset="utf-8">
<title>dsh-md-plus preview</title>
<style>
/* 主题 token（从 dsh-client-ui-theme 抠出来的真实值） */
${themeCss}
/* DSH 自己的代码块样式（从 shell 样式表抠出来的真实规则） */
${shellCss}
/* 页面外壳，模拟聊天区 */
body{--ds-font-family-code:"SF Mono","JetBrains Mono","Fira Code",Consolas,Menlo,monospace;
  margin:0;padding:28px 32px;background:var(--dsw-alias-bg-base);
  font:var(--dsw-font-markdown-base);color:var(--dsw-alias-label-primary)}
.wrap{max-width:760px;margin:0 auto}
h2{font:var(--dsw-font-markdown-h2);margin:0 0 4px}
.sub{font:var(--dsw-font-markdown-small);color:var(--dsw-alias-label-secondary);margin:0 0 4px}
._md-plus-cap{font:var(--dsw-font-markdown-small);color:var(--dsw-alias-label-secondary);margin:24px 0 8px}
/* ↓↓↓ 插件注入的样式 ↓↓↓ */
${pluginCss}
</style>
<div class="wrap">
<h2>dsh-md-plus 显示效果预览</h2>
<p class="sub">代码块卡片 · 补语法高亮 · mermaid 图形 · 表格样式</p>
<div class="${MD.get("markdown")}">
${codeBlocksHtml}
${caption("表格：灰底表头、只有横线、外框收圆角，首末列各留 16px 内边距")}
${tableHtml}
${caption("mermaid：插件自己渲染的图形。上面这张横排长链在 100% 下只有几十像素高（所以才有最低高度和滚轮缩放），下面这张是分叉图")}
</div>
${MMD_CARDS.map((card, index) => mermaidCard(card, svgs[index])).join("\n")}
</div>
`,
);
console.log(`dsh-md-plus: wrote preview.html（含 ${svgs.length} 张真渲出来的 mermaid 图 + 1 张表格）`);
