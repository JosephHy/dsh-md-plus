// dsh-md-plus 客户端行为测试：用 happy-dom 搭出 DSH 真实的 code-block DOM，
// 跑一遍浏览器半，断言「不认识的语言被补上高亮、DSH 自己管的语言不碰」。
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const DEBOUNCE_MS = 160;
const RUNTIME_URL = "/dsh-md-plus/highlight-runtime.js";

/** DSH CodeBlock 的 DOM 形状（见 dsh-client-ui-primitives 的 CodeBlock.js）。 */
function codeBlockHtml(lang, code) {
  return (
    '<div class="_block_x md-code-block">' +
    '<div class="_bannerWrap_x"><div class="_banner_x" data-code-block-banner>' +
    `<div class="_infostring_x">${lang}</div>` +
    '<div class="_action_x"><button type="button">复制</button></div>' +
    "</div></div>" +
    '<div class="_content_x" data-code-block-content>' +
    `<pre class="_plain_x"><code>${code}</code></pre>` +
    "</div></div>"
  );
}

let window;
let document;
let api;

before(async () => {
  window = new Window({ url: "http://127.0.0.1:43120/" });
  document = window.document;
  globalThis.window = window;
  globalThis.document = document;
  globalThis.MutationObserver = window.MutationObserver;

  // 真实的构建产物：装上去就等于页面已经加载过运行时
  await import("../lib/highlight-runtime.js");
  // mermaid 渲染真的跑起来要浏览器排版能力（getBBox 等），happy-dom 撑不住。
  // 这里只替换「渲染器」这一个边界，客户端半的识别/插入/切换/回退逻辑仍然全走真的。
  window.__DSH_MD_PLUS_MMD__ = {
    calls: [],
    async render(id, code, dark) {
      this.calls.push({ id, code, dark });
      if (code.includes("BOOM")) throw new Error("Parse error on line 2");
      return `<svg data-stub="1" data-id="${id}"></svg>`;
    },
  };

  let registered = null;
  window.__ModuleLoader__ = {
    load(entry) {
      registered = entry;
    },
  };
  await import("../lib/client.js");
  assert.equal(registered?.id, "dsh-md-plus", "客户端半要以 dsh-md-plus 注册");
  api = registered.factory((name) => {
    throw new Error(`client bundle 不该 require 任何模块，却 require 了 ${name}`);
  });
});

/** 装一次插件，返回 ctx。 */
function mount() {
  const effects = [];
  const ctx = { effect: (fn) => { effects.push(fn()); } };
  document.body.innerHTML = "";
  api.apply(ctx);
  return ctx;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 80));

test("给 DSH 不认识的语言补上高亮", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml(
    "dart",
    "/// 各组件订阅的数据键\nList<String> _textDataKeys = const [];",
  );
  await settle();

  const block = document.querySelector(".md-code-block");
  const host = block.querySelector(".md-plus-hl");
  assert.ok(host, "应该插入了高亮宿主");

  const pre = host.querySelector("pre");
  assert.ok(pre.classList.contains("shiki"), "输出应是 shiki 的 pre");
  assert.ok(pre.classList.contains("md-plus-pre"));
  assert.match(pre.outerHTML, /--shiki-token-comment/, "注释要走 DSH 的 shiki 变量");
  assert.equal(block.getAttribute("data-md-plus"), "done");
});

test("原 <pre> 留在原位，DSH 的复制按钮仍读到纯文本", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "void main() {}");
  await settle();

  const block = document.querySelector(".md-code-block");
  const first = block.querySelector("pre");
  assert.equal(first.classList.contains("md-plus-pre"), false, "第一个 pre 必须还是原始节点");
  assert.equal(first.textContent, "void main() {}", "复制拿到的应是源码原文");
});

test("DSH 自己高亮的语言不碰", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("python", "print(1)");
  await settle();
  assert.equal(document.querySelector(".md-plus-hl"), null);
  assert.equal(document.querySelector(".md-code-block").getAttribute("data-md-plus"), null);
});

test("已被 DSH 上色的块不重复处理", async () => {
  mount();
  document.body.innerHTML =
    '<div class="md-code-block"><div data-code-block-banner><div>rust</div></div>' +
    '<div data-code-block-content><div><pre class="shiki css-variables"><code>fn main() {}</code></pre></div></div></div>';
  await settle();
  assert.equal(document.querySelector(".md-plus-hl"), null);
});

test("mermaid 块画成图形，并且不重复上色", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  await settle();
  assert.equal(document.querySelector(".md-plus-hl"), null, "不该再当普通代码高亮");
  assert.ok(document.querySelector(".md-plus-mmd svg[data-stub]"), "应该渲染出图形");
  assert.equal(document.querySelector(".md-code-block").getAttribute("data-md-plus-mmd"), "diagram");
});

test("graph 写法也能画（dsh-mermaid 漏掉的就是这个）", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml(
    "mermaid",
    "graph LR\nA[我] -->|调用| B[系统]",
  );
  await settle();
  assert.ok(document.querySelector(".md-plus-mmd svg[data-stub]"), "graph 开头的图必须能画");
  assert.match(window.__DSH_MD_PLUS_MMD__.calls.at(-1).code, /^graph LR/);
});

test("mmd / mermaidjs 别名同样处理", async () => {
  for (const lang of ["mmd", "mermaidjs"]) {
    mount();
    document.body.innerHTML = codeBlockHtml(lang, "flowchart TD\n X --> Y");
    await settle();
    assert.ok(document.querySelector(".md-plus-mmd svg"), `${lang} 应该被渲染`);
  }
});

test("mermaid 块的头部是图形/代码切换，不是不换行", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  await settle();
  const block = document.querySelector(".md-code-block");
  assert.ok(block.querySelector(".md-plus-toggle"), "要有图形/代码切换按钮");
  assert.equal(block.querySelector(".md-plus-tool"), null, "不该出现不换行按钮");
});

// ── 缩放 / 拖拽 ───────────────────────────────────────────────────────

function mermaidBlock() {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  return settle().then(() => document.querySelector(".md-code-block"));
}

const stageTransform = (block) => block.querySelector(".md-plus-mmd-stage").style.transform;

test("图形被包进 viewport / stage 两层", async () => {
  const block = await mermaidBlock();
  const viewport = block.querySelector(".md-plus-mmd-viewport");
  assert.ok(viewport, "要有裁剪用的 viewport");
  assert.ok(viewport.querySelector(".md-plus-mmd-stage svg"), "stage 里才是 svg");
});

test("头部四颗按钮：缩小 / 放大 / 切换 / 复制", async () => {
  const block = await mermaidBlock();
  const buttons = [...block.querySelectorAll("[data-code-block-banner] button")];
  assert.deepEqual(
    buttons.map((b) => b.classList.contains("md-plus-btn")),
    [true, true, true, false],
    "最后那颗是 DSH 原生的复制按钮",
  );
  assert.deepEqual(
    buttons.slice(0, 3).map((b) => [...b.classList].filter((c) => c !== "md-plus-btn")),
    [["md-plus-zoom-out"], ["md-plus-zoom-in"], ["md-plus-toggle"]],
  );
});

test("点放大 / 缩小改变 scale", async () => {
  const block = await mermaidBlock();
  assert.match(stageTransform(block), /scale\(1\)$/);
  assert.equal(block.getAttribute("data-md-plus-zoom"), "min", "刚渲染完是最小档");

  block.querySelector(".md-plus-zoom-in").dispatchEvent(new window.Event("click"));
  assert.match(stageTransform(block), /scale\(1\.25\)$/);
  assert.equal(block.getAttribute("data-md-plus-zoom"), "mid");

  block.querySelector(".md-plus-zoom-out").dispatchEvent(new window.Event("click"));
  assert.match(stageTransform(block), /scale\(1\)$/);
  assert.equal(block.getAttribute("data-md-plus-zoom"), "min");
});

test("缩到最小后再点缩小不越界", async () => {
  const block = await mermaidBlock();
  block.querySelector(".md-plus-zoom-out").dispatchEvent(new window.Event("click"));
  assert.match(stageTransform(block), /scale\(1\)$/, "不该被缩到 1 倍以下");
});

test("滚轮上下缩放流程图", async () => {
  const block = await mermaidBlock();
  const viewport = block.querySelector(".md-plus-mmd-viewport");

  viewport.dispatchEvent(new window.WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true }));
  assert.match(stageTransform(block), /scale\(1\.25\)$/, "往上滚 = 放大");

  viewport.dispatchEvent(new window.WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
  assert.match(stageTransform(block), /scale\(1\)$/, "往下滚 = 缩小");
});

test("双击回到 100%", async () => {
  const block = await mermaidBlock();
  const viewport = block.querySelector(".md-plus-mmd-viewport");
  block.querySelector(".md-plus-zoom-in").dispatchEvent(new window.Event("click"));
  block.querySelector(".md-plus-zoom-in").dispatchEvent(new window.Event("click"));
  assert.match(stageTransform(block), /scale\(1\.5625\)$/);

  viewport.dispatchEvent(new window.Event("dblclick"));
  assert.match(stageTransform(block), /scale\(1\)$/);
});

test("1 倍时不接管拖拽，放大后才接管", async () => {
  const block = await mermaidBlock();
  const viewport = block.querySelector(".md-plus-mmd-viewport");
  const down = () =>
    viewport.dispatchEvent(
      new window.PointerEvent("pointerdown", { button: 0, pointerId: 1, bubbles: true }),
    );

  down();
  assert.equal(viewport.hasAttribute("data-dragging"), false, "1 倍时拖拽会挡掉选字，不该接管");

  block.querySelector(".md-plus-zoom-in").dispatchEvent(new window.Event("click"));
  down();
  assert.equal(viewport.getAttribute("data-dragging"), "on", "放大后应该能拖");

  viewport.dispatchEvent(new window.PointerEvent("pointerup", { pointerId: 1, bubbles: true }));
  assert.equal(viewport.hasAttribute("data-dragging"), false, "松手要还回去");
});

test("图重画后缩放归位", async () => {
  const block = await mermaidBlock();
  block.querySelector(".md-plus-zoom-in").dispatchEvent(new window.Event("click"));
  assert.match(stageTransform(block), /scale\(1\.25\)$/);

  document.body.setAttribute("data-ds-dark-theme", "");
  await settle();
  assert.match(stageTransform(block), /scale\(1\)$/, "重画后要回到 100%");
  document.body.removeAttribute("data-ds-dark-theme");
});

test("普通代码块没有缩放按钮", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();
  assert.equal(document.querySelector(".md-plus-zoom-in"), null);
  assert.equal(document.querySelector(".md-plus-zoom-out"), null);
});

test("图形有最低高度，长扁图放大后不是一条缝", async () => {
  mount();
  await settle();
  const css = stylesheet();
  assert.match(css, /--md-plus-mmd-min-height:200px/, "最低高度要可调");
  assert.match(
    css,
    /\.md-plus-mmd-stage\{[^}]*justify-content:center[^}]*min-height:var\(--md-plus-mmd-min-height\)[^}]*\}/,
    "stage 要兜住最低高度并让图垂直居中",
  );
});

// ── 表格 ──────────────────────────────────────────────────────────────

test("表格样式：灰底表头、整张外框、只有横线", async () => {
  mount();
  await settle();
  const css = stylesheet();

  // 抓手是结构选择器，不依赖 DSH 的哈希类名
  assert.match(css, /\[class\*="_markdown_"\] div:has\(> table\)/, "要用结构选择器定位表格");
  // 参考图取样值
  assert.match(css, /--md-plus-tbl-head:#f7f7f7/, "表头底 #f7f7f7");
  assert.match(css, /--md-plus-tbl-line:#ebebeb/, "分隔线 #ebebeb");
  assert.match(css, /--md-plus-tbl-head-fg:#181818/, "表头字 #181818");
  assert.match(css, /> table\{border:1px solid var\(--md-plus-tbl-line\)/, "整张表一个 1px 外框");
  assert.match(css, /> table th\{background:var\(--md-plus-tbl-head\)[^}]*font-weight:600/, "表头要灰底加粗");
});

test("表格只有外圈四角收圆，表头下沿保持直角", async () => {
  mount();
  await settle();
  const css = stylesheet();

  // collapse 模式下 Chrome 会忽略单元格圆角，表头灰底会在四角戳出直角
  assert.match(css, /border-collapse:separate;border-spacing:0/, "必须用 separate 才能收圆角");
  assert.match(css, /--md-plus-tbl-radius:8px/, "外圆角");
  assert.match(css, /--md-plus-tbl-radius-inner:7px/, "内圆角比外圆角少 1px，让开边框");
  assert.match(css, /thead tr:first-child > :first-child\{border-top-left-radius/, "表头左上角");
  assert.match(css, /thead tr:first-child > :last-child\{border-top-right-radius/, "表头右上角");
  assert.match(css, /tbody tr:last-child > :first-child\{border-bottom-left-radius/, "末行左下角");
  assert.match(css, /tbody tr:last-child > :last-child\{border-bottom-right-radius/, "末行右下角");
  // 表头行同时也是 thead 的 last-child：选择器不写明 tbody 就会被一起收成圆角
  assert.doesNotMatch(css, /thead[^{}]*border-bottom-(left|right)-radius/, "表头下沿不许收圆角");
  assert.doesNotMatch(css, /tbody[^{}]*border-top-(left|right)-radius/, "数据区上沿不许收圆角");
});

test("表格把 DSH 清零的首末列内边距还回去", async () => {
  mount();
  await settle();
  const css = stylesheet();
  assert.match(css, /> table th:first-child,.*> table td:first-child\{padding-left:16px/, "首列左边距");
  assert.match(css, /> table th:last-child,.*> table td:last-child\{padding-right:16px/, "末列右边距");
  assert.match(css, /> table tr:last-child td\{border-bottom:0\}/, "末行下边线交给外框，避免双线");
});

test("表格有深色主题的一套值", async () => {
  mount();
  await settle();
  const css = stylesheet();
  assert.match(
    css,
    /body\[data-ds-dark-theme\] \[class\*="_markdown_"\] div:has\(> table\)\{[^}]*--md-plus-tbl-head:#1f1f1f/,
    "深色下要换一套配色",
  );
});

test("表格作用域限定在 markdown 正文里，不碰设置页的表格", async () => {
  mount();
  await settle();
  const css = stylesheet();
  // 每条表格规则都必须带 [class*="_markdown_"] 前缀
  const tableRules = css.split("\n").filter((line) => line.includes("div:has(> table)"));
  assert.ok(tableRules.length >= 6, `应该有若干条表格规则，实际 ${tableRules.length}`);
  for (const rule of tableRules) {
    assert.ok(rule.startsWith('[class*="_markdown_"]') || rule.startsWith('body[data-ds-dark-theme] [class*="_markdown_"]'),
      `表格规则必须带 markdown 作用域：${rule}`);
  }
});

test("点切换按钮在图形与代码之间来回", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  await settle();
  const block = document.querySelector(".md-code-block");
  const toggle = block.querySelector(".md-plus-toggle");

  toggle.dispatchEvent(new window.Event("click"));
  assert.equal(block.getAttribute("data-md-plus-mmd"), "code");
  toggle.dispatchEvent(new window.Event("click"));
  assert.equal(block.getAttribute("data-md-plus-mmd"), "diagram");
});

test("渲染失败退回源码并挂出原因", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n BOOM");
  await settle();
  const block = document.querySelector(".md-code-block");
  assert.equal(block.getAttribute("data-md-plus-mmd"), "failed");
  assert.equal(block.querySelector(".md-plus-mmd"), null, "失败的图不该留在页面上");
  const note = block.querySelector(".md-plus-mmd-error");
  assert.ok(note, "要挂一行失败原因");
  assert.match(note.textContent, /Parse error on line 2/);
});

test("同内容不重复渲染，换主题才重画", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  await settle();
  const before = window.__DSH_MD_PLUS_MMD__.calls.length;

  await settle();
  assert.equal(window.__DSH_MD_PLUS_MMD__.calls.length, before, "内容没变就不该重画");

  document.body.setAttribute("data-ds-dark-theme", "");
  await settle();
  assert.equal(window.__DSH_MD_PLUS_MMD__.calls.length, before + 1, "切主题要重画");
  assert.equal(window.__DSH_MD_PLUS_MMD__.calls.at(-1).dark, true, "重画要知道现在是深色");
  document.body.removeAttribute("data-ds-dark-theme");
});

test("卸载时把图形和失败提示一起摘掉", async () => {
  const effects = [];
  const ctx = { effect: (fn) => { effects.push(fn()); } };
  document.body.innerHTML = "";
  api.apply(ctx);
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  await settle();
  assert.equal(document.querySelectorAll(".md-plus-mmd").length, 1);

  effects[0]();
  assert.equal(document.querySelectorAll(".md-plus-mmd").length, 0, "卸载要摘掉图形");
});

test("流式输出期间不动手，定稿后补上", async () => {
  mount();
  document.body.innerHTML =
    '<div data-streaming="true">' + codeBlockHtml("dart", "List<int> a = [") + "</div>";
  await settle();
  assert.equal(document.querySelector(".md-plus-hl"), null, "流式中不该插入");

  // 流式结束：DSH 会摘掉 data-streaming
  document.querySelector("[data-streaming]").removeAttribute("data-streaming");
  await settle();
  assert.ok(document.querySelector(".md-plus-hl"), "定稿后应该补上高亮");
});

test("源码变了会重新上色", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();
  const before = document.querySelector(".md-plus-hl");

  document.querySelector(".md-code-block code").textContent = "int a = 2;";
  await settle();

  const blocks = document.querySelectorAll(".md-plus-hl");
  assert.equal(blocks.length, 1, "旧宿主要被换掉而不是堆积");
  assert.notEqual(blocks[0], before);
  assert.match(blocks[0].textContent, /a = 2/);
});

test("插自己的节点不会自激成死循环", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();
  await settle();
  assert.equal(document.querySelectorAll(".md-plus-hl").length, 1);
});

test("未知语言安静跳过", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("notalanguage", "???");
  await settle();
  assert.equal(document.querySelector(".md-plus-hl"), null);
});

test("卸载后不留下样式与观察者", async () => {
  const effects = [];
  const ctx = { effect: (fn) => { effects.push(fn()); } };
  document.body.innerHTML = "";
  api.apply(ctx);
  assert.ok(document.querySelector("style[data-md-plus-style]"), "应注入样式");

  effects[0]();
  assert.equal(document.querySelector("style[data-md-plus-style]"), null, "卸载要摘掉样式");
});

// ── 样式层 ────────────────────────────────────────────────────────────

function stylesheet() {
  return document.querySelector("style[data-md-plus-style]").textContent;
}

test("样式表针对所有代码块，不只是补高亮的那些", async () => {
  mount();
  await settle();
  const css = stylesheet();

  assert.match(css, /\.md-code-block \[data-code-block-banner\]\{padding:8px 16px 0/, "头部自身不留下方内边距");
  assert.match(css, /:empty::after\{content:'Plain text'\}/, "没语言要有占位名，否则左边一片空白");
  assert.match(css, /\.md-code-block pre\{padding:6px 16px 16px\}/, "首行代码上方补 6px，别贴着头部");
  assert.match(css, /\{background:transparent\}/, "要去掉 bannerWrap 的白色色带");
  assert.match(css, /md-plus-icon-copy/, "复制按钮要换成图标");
});

test("图标是自包含的 data URI，不依赖外部资源", async () => {
  mount();
  await settle();
  const css = stylesheet();
  assert.match(css, /url\("data:image\/svg\+xml,/, "图标要内联");
  assert.equal(/url\(["']?https?:/.test(css), false, "不该有外链");
});

test("每个代码块都拿到「不换行」按钮，且在复制按钮前面", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();

  const action = document.querySelector("[data-code-block-banner] > :last-child");
  const buttons = [...action.querySelectorAll("button")];
  assert.equal(buttons.length, 2, "应该有「不换行」+「复制」两个按钮");
  assert.ok(buttons[0].classList.contains("md-plus-tool"), "插件的按钮要排在前面");
  assert.equal(buttons[1].textContent, "复制", "原复制按钮要留在后面");
});

test("DSH 自己高亮的语言也有同样的头部样式", async () => {
  mount();
  document.body.innerHTML =
    '<div class="md-code-block"><div data-code-block-banner><div>rust</div>' +
    '<div><button type="button">复制</button></div></div>' +
    '<div data-code-block-content><div><pre class="shiki css-variables"><code>fn main() {}</code></pre></div></div></div>';
  await settle();

  assert.ok(document.querySelector(".md-plus-tool"), "不补高亮也要装饰头部");
  assert.equal(document.querySelector(".md-plus-hl"), null, "但不该重复上色");
});

test("点「不换行」按钮能切换状态", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();

  const block = document.querySelector(".md-code-block");
  const tool = block.querySelector(".md-plus-tool");
  assert.equal(block.hasAttribute("data-md-plus-wrap"), false);

  tool.dispatchEvent(new window.Event("click"));
  assert.equal(block.getAttribute("data-md-plus-wrap"), "on");

  tool.dispatchEvent(new window.Event("click"));
  assert.equal(block.hasAttribute("data-md-plus-wrap"), false);
});

test("插按钮不会自激重扫", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();
  await settle();
  assert.equal(document.querySelectorAll(".md-plus-tool").length, 1);
});

test("卸载时连按钮一起摘掉", async () => {
  const effects = [];
  const ctx = { effect: (fn) => { effects.push(fn()); } };
  document.body.innerHTML = "";
  api.apply(ctx);
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();
  assert.equal(document.querySelectorAll(".md-plus-tool").length, 1);

  effects[0]();
  assert.equal(document.querySelectorAll(".md-plus-tool").length, 0, "卸载要摘掉注入的按钮");
});

