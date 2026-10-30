// 生成能力展示页：复用真实 DSH 主题变量和代码块 DOM 结构，插件本身跑在浏览器里。
//
// 页面由本地静态服务器托管，/lib/*.js 直接引用构建产物，所以看到的是插件真实行为，
// 不是另写一套模拟样式。
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const APP = [
  process.env.DSH_APP_DIR,
  "D:/develops/DSH Desktop/resources/app",
  "D:/develops/DSH Desktop Beta/resources/app",
]
  .filter((dir) => dir !== undefined)
  .find((dir) => existsSync(join(dir, "node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js")));
if (APP === undefined) throw new Error("找不到 DSH 应用目录，请用 DSH_APP_DIR 指定");

const APP_MODULES = join(APP, "node_modules/@deepseek-ai");

function shellCssFile() {
  const dir = join(APP_MODULES, "dsh-web-frontend/dist/assets");
  const name = readdirSync(dir).find((file) => file.startsWith("index-") && file.endsWith(".css"));
  if (name === undefined) throw new Error(`在 ${dir} 里找不到 index-*.css`);
  return join(dir, name);
}

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

function markdownRules(css) {
  return (css.match(/[^{}]+\{[^{}]*\}/g) ?? []).filter((rule) =>
    /md-code-block|md-table-wide|_(block|banner|bannerWrap|infostring|action|copyButton|content|plain|numbered|line|markdown|tableScroll|tableFill|linkIcon|image|imageAlt|fileMention)_[a-z0-9]+_\d+/.test(
      rule,
    ),
  );
}

function classModules(css) {
  const modules = new Map();
  for (const match of css.matchAll(/\._([A-Za-z]+)_([a-z0-9]+)_(\d+)/g)) {
    if (!modules.has(match[2])) modules.set(match[2], new Map());
    modules.get(match[2]).set(match[1], `_${match[1]}_${match[2]}_${match[3]}`);
  }
  return [...modules.values()];
}

const themeCss = inlineCss(readFileSync(join(APP_MODULES, "dsh-client-ui-theme/lib/client.js"), "utf8"), "--dsw-alias-");
const shellCssRaw = readFileSync(shellCssFile(), "utf8");
const shellCss = markdownRules(shellCssRaw).join("\n");
const MODULES = classModules(shellCssRaw);

function classModule(required) {
  const found = MODULES.find((mod) => required.every((name) => mod.has(name)));
  if (found === undefined) throw new Error(`当前 DSH 样式表里找不到含 ${required.join(" / ")} 的模块`);
  return found;
}

const CB = classModule(["block", "bannerWrap", "infostring", "copyButton", "content", "plain"]);
const TB = classModule(["card", "header", "heading", "language", "actions"]);
const MD = classModule(["markdown", "tableScroll"]);

const { createHighlighterCore, createCssVariablesTheme } = await import("shiki/core");
const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript");
const shikiTheme = createCssVariablesTheme({ name: "css-variables", variablePrefix: "--shiki-", fontStyle: true });
const highlighter = await createHighlighterCore({
  themes: [shikiTheme],
  langs: [
    (await import("@shikijs/langs/json")).default,
    (await import("@shikijs/langs/javascript")).default,
  ].flat(),
  engine: createJavaScriptRegexEngine({ forgiving: true }),
});

/** 一块接近 DSH CodeBlock 真实结构的代码块。 */
function block({ label, code, bodyHtml, ariaLabel }) {
  return (
    `<div class="${CB.get("block")} md-code-block">` +
    `<div class="${CB.get("bannerWrap")}"><div class="${TB.get("header")}" data-code-block-banner>` +
    `<div class="${TB.get("heading")}">${label}</div>` +
    `<div class="${TB.get("actions")}">` +
    `<button type="button" class="${CB.get("copyButton")}" aria-label="复制代码">` +
    `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><rect x="4.5" y="4.5" width="8" height="8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 10.5V3.8c0-.7.6-1.3 1.3-1.3h6.7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>` +
    `</button>` +
    "</div></div></div>" +
    `<div class="${CB.get("content")}" data-code-block-content aria-label="${ariaLabel ?? "代码"}">` +
    (bodyHtml ?? `<pre class="${CB.get("plain")}"><code>${escapeHtml(code ?? "")}</code></pre>`) +
    "</div></div>"
  );
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function section(id, number, title, desc, body) {
  return `<section class="showcase-section" id="${id}">
    <header class="section-head"><span class="section-no">${number}</span><div><h2>${title}</h2><p>${desc}</p></div></header>
    ${body}
  </section>`;
}

const JSON_CODE = [
  "{",
  '  "name": "dsh-md-plus",',
  '  "version": "0.4.2",',
  '  "engines": { "node": ">=22.19.0" },',
  '  "features": ["code", "mermaid", "table", "image", "settings"]',
  "}",
].join("\n");

const GDSCRIPT_CODE = [
  "extends CharacterBody2D",
  "",
  "@export var speed: float = 240.0",
  "@export var jump_velocity: float = -420.0",
  "",
  "var gravity: float = ProjectSettings.get_setting(\"physics/2d/default_gravity\")",
  "",
  "func _physics_process(delta: float) -> void:",
  "\tif not is_on_floor():",
  "\t\tvelocity.y += gravity * delta",
  "",
  "\tif Input.is_action_just_pressed(\"jump\") and is_on_floor():",
  "\t\tvelocity.y = jump_velocity",
  "",
  "\tvar direction := Input.get_axis(\"move_left\", \"move_right\")",
  "\tvelocity.x = direction * speed",
  "\tmove_and_slide()",
].join("\n");

const LONG_CODE = Array.from({ length: 42 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `export function step${n}(input) { return normalize(input) + ${i}; } // 第 ${n} 行：长代码用来演示折叠`;
}).join("\n");

const jsonHtml = highlighter.codeToHtml(JSON_CODE, { lang: "json", theme: shikiTheme });
const jsHtml = highlighter.codeToHtml(LONG_CODE, { lang: "javascript", theme: shikiTheme });

const TREE_CODE = [
  "dsh-md-plus/",
  "├─ src/client.js          浏览器半：注入样式 + 装饰代码块头部",
  "├─ src/mermaid-theme.js   图形配色 token",
  "├─ src/languages.js       Shiki 语言包清单",
  "└─ scripts/build.mjs      产出 lib/ 四个文件",
].join("\n");

const SHORT_TABLE_ROWS = [
  ["代码块卡片", "统一外观", "所有语言共用一套样式"],
  ["语法高亮", "按需加载", "DSH 不认的语言由插件上色"],
  ["Mermaid", "自渲染 SVG", "支持缩放、全屏、导出"],
  ["表格", "复制 + 吸顶", "CSV / Markdown 一键复制"],
  ["图片", "旧宿主兜底", "原生预览和链接图片不抢"],
];

const LONG_TABLE_ROWS = Array.from({ length: 15 }, (_, i) => [
  `第 ${i + 1} 项`,
  i % 2 === 0 ? "说明较长的内容，用来把表格撑高，触发长内容折叠" : "短说明",
  `状态 ${i % 3 === 0 ? "正常" : "观察中"}`,
]);

function table(rows, head) {
  return (
    `<div class="${MD.get("tableScroll")} md-table-wide"><table><thead><tr>` +
    head.map((cell) => `<th>${cell}</th>`).join("") +
    "</tr></thead><tbody>" +
    rows.map((row) => "<tr>" + row.map((cell) => `<td>${cell}</td>`).join("") + "</tr>").join("") +
    "</tbody></table></div>"
  );
}

const MMD_FLOW = [
  "flowchart TD",
  "A[用户提问] --> B[DSH 组装上下文]",
  "B --> C[模型流式输出]",
  "C --> D[解析 Markdown]",
  "D --> E{围栏语言?}",
  "E -->|mermaid| F[插件渲染 SVG]",
  "E -->|其它| G[代码块卡片]",
  "F --> H[全屏 / 缩放 / 导出]",
  "G --> I[补高亮 / 折叠 / 复制]",
].join("\n");

const MMD_SEQ = [
  "sequenceDiagram",
  "participant U as 用户",
  "participant D as DSH",
  "participant P as dsh-md-plus",
  "U->>D: 发出一条消息",
  "D->>P: 渲染 Markdown DOM",
  "P->>P: 扫描代码块 / 表格 / 图片",
  "P-->>D: 注入卡片按钮与样式",
  "D-->>U: 看到成品",
].join("\n");

const imageUrl = "showcase-image.svg";

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dsh-md-plus 能力展示</title>
<style>
${themeCss}
${shellCss}
:root{--showcase-accent:#4c6ef5;--showcase-ink:#15171c;--showcase-muted:#69707d}
*{box-sizing:border-box}
body{margin:0;background:#f5f6f8;color:var(--dsw-alias-label-primary,#1f2329);
  font-family:var(--dsw-font-family-sans,"Segoe UI",system-ui,sans-serif)}
button{font-family:inherit}
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:16px;
  padding:12px 28px;background:rgb(255 255 255 / 82%);backdrop-filter:blur(12px);
  border-bottom:1px solid rgb(20 24 36 / 8%)}
.brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:15px;letter-spacing:.2px}
.brand-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#15171c;color:#fff;font:600 13px/1 ui-monospace,monospace}
.topbar nav{display:flex;gap:4px;margin-left:12px}
.topbar nav a{padding:5px 10px;border-radius:7px;color:#59606c;text-decoration:none;font-size:13px}
.topbar nav a:hover{background:#eef0f4;color:#15171c}
.topbar .spacer{flex:1}
.dark-toggle{appearance:none;border:1px solid #d9dce3;background:#fff;border-radius:8px;padding:5px 10px;font-size:12px;color:#454b57;cursor:pointer}
.dark-toggle:hover{border-color:#b9bec9}
.page{max-width:940px;margin:0 auto;padding:34px 24px 130px}
.hero{padding:34px 36px;border-radius:18px;background:#f7f8fb;border:1px solid #e6e9f1;margin-bottom:26px}
.hero .eyebrow{font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.12em;color:#5b6ee1;text-transform:uppercase}
.hero h1{margin:8px 0 10px;font-size:34px;line-height:1.18;letter-spacing:-.02em;color:#14161c}
.hero p{margin:0;max-width:620px;color:#5e6572;font-size:14px;line-height:1.75}
.hero .tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:18px}
.hero .tags span{padding:5px 10px;border-radius:999px;background:#fff;border:1px solid #e4e7ee;font-size:12px;color:#4c5360}
.showcase-section{margin:0 0 18px;padding:24px 28px 26px;background:#fff;border:1px solid #e7e9ef;border-radius:16px;scroll-margin-top:72px}
.section-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:18px}
.section-no{flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#eef1ff;color:#4c6ef5;font:600 12px/1 ui-monospace,monospace}
.section-head h2{margin:1px 0 3px;font-size:18px;letter-spacing:-.01em}
.section-head p{margin:0;color:#6b7280;font-size:12.5px;line-height:1.6}
.note{margin:0 0 12px;color:#8a909c;font-size:12px;line-height:1.6}
.note code{padding:1px 5px;border-radius:4px;background:#f1f2f5;font-size:11px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media (max-width:760px){.split{grid-template-columns:1fr}.topbar nav{display:none}}
.demo-image{display:block;width:min(600px,100%);border:1px solid #e4e7ee;border-radius:12px;cursor:zoom-in}
.settings-hint{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px dashed #d8dce6;border-radius:10px;color:#6b7280;font-size:12.5px}
.settings-hint kbd{padding:2px 7px;border:1px solid #d5d9e2;border-bottom-width:2px;border-radius:5px;background:#fafbfc;font:11px/1.4 ui-monospace,monospace;color:#4b5160}
body[data-ds-dark-theme]{background:#111318;color:#e8eaf0}
body[data-ds-dark-theme] .topbar{background:rgb(20 22 28 / 84%);border-color:rgb(255 255 255 / 9%)}
body[data-ds-dark-theme] .brand{color:#eef0f6}
body[data-ds-dark-theme] .topbar nav a{color:#a6adbb}
body[data-ds-dark-theme] .topbar nav a:hover{background:#242833;color:#fff}
body[data-ds-dark-theme] .dark-toggle{background:#1c1f27;border-color:#323744;color:#d7dbe5}
body[data-ds-dark-theme] .hero{background:#171a22;border-color:#282d3a}
body[data-ds-dark-theme] .hero h1{color:#f4f6fb}
body[data-ds-dark-theme] .hero p{color:#a9b0bf}
body[data-ds-dark-theme] .hero .tags span{background:#1c2029;border-color:#303542;color:#b5bdcc}
body[data-ds-dark-theme] .showcase-section{background:#171a21;border-color:#282d38}
body[data-ds-dark-theme] .section-head h2{color:#eef1f7}
body[data-ds-dark-theme] .section-head p,body[data-ds-dark-theme] .note{color:#929aa9}
body[data-ds-dark-theme] .note code{background:#232833}
body[data-ds-dark-theme] .settings-hint{border-color:#343a47;color:#9ca4b3}
body[data-ds-dark-theme] .settings-hint kbd{background:#1d212a;border-color:#3a404e;color:#c7cdd9}
body[data-ds-dark-theme] .demo-image{border-color:#2c313d}
/* 演示页里给代码内容一个真实盒模型，方便观察插件按高度触发的折叠；DSH 聊天区由宿主样式决定。 */
.md-code-block > [data-code-block-content]{display:block}
</style>
</head>
<body>
<div class="topbar">
  <div class="brand"><span class="brand-mark">&lt;/&gt;</span> dsh-md-plus</div>
  <nav>
    <a href="#code">代码块</a><a href="#mermaid">Mermaid</a><a href="#table">表格</a><a href="#image">图片</a><a href="#settings">设置</a>
  </nav>
  <span class="spacer"></span>
  <button class="dark-toggle" id="dark-toggle" type="button">切换深色</button>
</div>
<div class="page ${MD.get("markdown")}">
  <header class="hero">
    <div class="eyebrow">DSH 插件 · dsh-md-plus</div>
    <h1>dsh-md-plus 能做什么</h1>
    <p>这个页面把插件现在的功能都摆出来了。往下翻能看到代码块、Mermaid 图、表格、图片和设置面板，很多地方可以直接点开试。</p>
    <div class="tags"><span>代码块</span><span>代码高亮</span><span>Mermaid 图</span><span>表格复制</span><span>图片放大</span><span>深浅主题</span></div>
  </header>

  ${section(
    "code",
    "01",
    "代码块卡片",
    "头部统一成 </> 图标 + 语言名，按钮收成图标；JSON 这类宿主自己高亮的语言也吃同一套外观。",
    `<p class="note">下面分别是宿主已高亮的 <code>JSON</code>、插件补高亮的 <code>GDScript</code>，以及没有写语言的纯文本块。</p>
     ${block({ label: "JSON", code: "", bodyHtml: `<div>${jsonHtml}</div>` })}
     ${block({ label: "GDScript", code: GDSCRIPT_CODE })}
     ${block({ label: "", code: TREE_CODE })}`,
  )}

  ${section(
    "fold",
    "02",
    "长内容折叠",
    "代码块、表格、Mermaid 图卡超过阈值就折叠，底部出现「展开 / 收起」，长日志不再把聊天撑成一整屏。",
    `<p class="note">这块 42 行的代码超过默认 480px 阈值，已经自动折叠；点下面的「展开」可以看完整内容。</p>
     ${block({ label: "JavaScript", code: "", bodyHtml: `<div>${jsHtml}</div>` })}`,
  )}

  ${section(
    "mermaid",
    "03",
    "Mermaid 图形",
    "围栏内容直接在卡片里渲染成 SVG，支持图形 / 代码切换、缩放、拖拽、四套配色、全屏查看和 SVG / PNG 导出。",
    `<p class="note">头部语言名被宿主占位成「代码块」也没关系，插件会从正文的 <code>flowchart</code> / <code>sequenceDiagram</code> 类型声明识别。</p>
     <div class="split">
       ${block({ label: "代码块", code: MMD_FLOW })}
       ${block({ label: "代码块", code: MMD_SEQ })}
     </div>`,
  )}

  ${section(
    "table",
    "04",
    "表格样式与复制",
    "表头灰底、只有横线、外圈圆角；表头吸顶，长表往下翻时列名不丢；右上角可复制为 CSV / Markdown。",
    `<p class="note">短表展示完整样式；下面的长表超过默认 520px 阈值，会自动出现折叠按钮。</p>
     ${table(SHORT_TABLE_ROWS, ["能力", "关键词", "说明"])}
     ${table(LONG_TABLE_ROWS, ["项目", "说明", "状态"])}`,
  )}

  ${section(
    "image",
    "05",
    "图片点击放大",
    "旧宿主没有原生预览按钮时才由插件兜底：点击打开暗色预览，Esc 或点遮罩关闭；新版 DSH 的原生预览、头像、图标、代码块和链接图片都不接管。",
    `<img class="demo-image" src="${imageUrl}" alt="dsh-md-plus 能力展示配图">`,
  )}

  ${section(
    "settings",
    "06",
    "设置面板",
    "右下角的低调齿轮，点开可调 Mermaid 配色、代码字号、图表默认视图和三类折叠阈值；设置存在 localStorage，刷新后保持。",
    `<div class="settings-hint"><kbd>齿轮</kbd> 点右下角按钮打开设置；把代码字号改成 16px、折叠阈值改成 0，再回来看看效果。</div>`,
  )}
</div>

<script src="../lib/highlight-runtime.js"></script>
<script src="../lib/mermaid-runtime.js"></script>
<script>
  try {
    if (localStorage.getItem("dsh-md-plus-settings") === null) {
      localStorage.setItem(
        "dsh-md-plus-settings",
        JSON.stringify({ codeFontSize: 0, diagramView: "diagram", foldCode: 480, foldTable: 520, foldDiagram: 0 }),
      );
    }
  } catch {}
  window.__ModuleLoader__ = {
    load(entry) {
      window.__DSH_MD_PLUS__ = entry.factory(function () {
        throw new Error("client bundle 不该 require 任何模块");
      });
    },
  };
</script>
<script src="../lib/client.js"></script>
<script>
  window.__DSH_MD_PLUS__.apply({ effect: function (fn) { return fn(); } });
  document.getElementById("dark-toggle").addEventListener("click", function () {
    document.body.toggleAttribute("data-ds-dark-theme");
  });
</script>
</body>
</html>
`;

writeFileSync(join(ROOT, "docs/showcase.html"), html);
console.log("wrote docs/showcase.html");
