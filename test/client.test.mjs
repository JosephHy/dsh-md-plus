// dsh-md-plus 客户端行为测试：用 happy-dom 搭出 DSH 真实的 code-block DOM，
// 跑一遍浏览器半，断言「不认识的语言被补上高亮、DSH 自己管的语言不碰」。
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const DEBOUNCE_MS = 160;
const RUNTIME_URL = "/dsh-md-plus/highlight-runtime.js";

/**
 * 元素不能直接交给 assert。断言失败时 Node 会为了打印差异遍历整棵 DOM，
 * 实测一瞬间提交几十 GB（报 Array buffer allocation failed，但内存已提交）——
 * 而且它是堆外分配，--max-old-space-size 拦不住。
 * 这里把元素化成只含标签名的短字符串，断言该过还过、该挂还挂。
 */
const tagOf = (node) => (node === null || node === undefined ? "null" : `<${node.tagName.toLowerCase()}>`);

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

/**
 * DSH CodeBlock 在聊天区的真实形状：头部是 CodeToolbar（`toolbarLabels` 那支），
 * 语言标签走 `supportsHighlighting(lang) ? lang : labels.codeLabel`。
 * 所以 DSH 不认识的语言（mermaid 等）标签是占位文案，读不到围栏语言。
 */
function toolbarBlockHtml(label, code) {
  return (
    '<div class="_block_x md-code-block _card_x">' +
    '<div class="_bannerWrap_x"><div class="_banner_x" data-code-block-banner>' +
    `<div class="_heading_x"><span class="_language_x">${label}</span></div>` +
    '<div class="_actions_x">' +
    '<button type="button" aria-label="自动换行">换行</button>' +
    '<button type="button">复制</button>' +
    "</div></div></div>" +
    '<div class="_content_x" data-code-block-content>' +
    `<pre class="_plain_x"><code>${code}</code></pre>` +
    "</div></div>"
  );
}

let window;
let document;
let api;


/** 假的 mermaid 运行时：只替换渲染器这一个边界，客户端半的逻辑仍然全走真的。 */
const mermaidStub = {
  calls: [],
  async render(id, code, dark, theme) {
    this.calls.push({ id, code, dark, theme });
    if (code.includes("BOOM")) throw new Error("Parse error on line 2");
    return `<svg data-stub="1" data-id="${id}" viewBox="0 0 320 200" width="100%"></svg>`;
  },
};

/** 真实的补高亮运行时对象；卸载回调会清掉这个全局，重装时要能放回去。 */
let hlRuntime;

before(async () => {
  window = new Window({ url: "http://127.0.0.1:43120/" });
  document = window.document;
  document.documentElement.lang = "zh-CN";
  globalThis.window = window;
  globalThis.document = document;
  globalThis.MutationObserver = window.MutationObserver;

  // 真实的构建产物：装上去就等于页面已经加载过运行时
  await import("../lib/highlight-runtime.js");
  hlRuntime = window.__DSH_MD_PLUS_HL__;
  // mermaid 渲染真的跑起来要浏览器排版能力（getBBox 等），happy-dom 撑不住。
  // 这里只替换「渲染器」这一个边界，客户端半的识别/插入/切换/回退逻辑仍然全走真的。
  window.__DSH_MD_PLUS_MMD__ = mermaidStub;

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
  // 卸载回调会清掉运行时全局；重装时把桩放回去（真机上这一步等于重新下载运行时）
  window.__DSH_MD_PLUS_HL__ ??= hlRuntime;
  window.__DSH_MD_PLUS_MMD__ ??= mermaidStub;
  window.localStorage.clear();
  api.apply(ctx);
  return ctx;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 80));

test("给 DSH 不认识的语言补上高亮", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml(
    "gdscript",
    "# 各组件订阅的数据键\nvar _textDataKeys := []",
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
  document.body.innerHTML = codeBlockHtml("gdscript", "func _ready() {}");
  await settle();

  const block = document.querySelector(".md-code-block");
  const first = block.querySelector("pre");
  assert.equal(first.classList.contains("md-plus-pre"), false, "第一个 pre 必须还是原始节点");
  assert.equal(first.textContent, "func _ready() {}", "复制拿到的应是源码原文");
});

test("DSH 自己高亮的语言不碰", async () => {
  // dart / scala / vue 这些是 DSH 后来加进语言表的，插件这边漏一个就会同一份代码画两遍
  for (const lang of ["python", "dart", "scala", "vue", "powershell", "csv", "graphql"]) {
    mount();
    document.body.innerHTML = codeBlockHtml(lang, "int a = 1;");
    await settle();
    assert.equal(tagOf(document.querySelector(".md-plus-hl")), "null", `${lang} 不该补高亮`);
    assert.equal(document.querySelector(".md-code-block").getAttribute("data-md-plus"), null);
  }
});

test("DSH 懒加载语法到位后接管，撤回我们插的副本", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("gdscript", "func _ready() {}");
  await settle();
  const content = document.querySelector("[data-code-block-content]");
  assert.ok(content.querySelector(".md-plus-hl"), "先由插件补色");

  // 语法 import 完成：React 把它那个 plain <pre> 整个换成高亮 <div>
  const replacement = document.createElement("div");
  replacement.innerHTML =
    '<pre class="shiki css-variables"><code>func _ready() {}</code></pre>';
  content.querySelector("pre:not(.md-plus-pre)").replaceWith(replacement);
  await settle();

  const block = document.querySelector(".md-code-block");
  assert.equal(content.querySelectorAll("pre").length, 1, "不能留下两份代码");
  assert.equal(tagOf(content.querySelector(".md-plus-hl")), "null", "副本要撤回");
  assert.equal(block.getAttribute("data-md-plus"), null);
});

test("已被 DSH 上色的块不重复处理", async () => {
  mount();
  document.body.innerHTML =
    '<div class="md-code-block"><div data-code-block-banner><div>rust</div></div>' +
    '<div data-code-block-content><div><pre class="shiki css-variables"><code>fn main() {}</code></pre></div></div></div>';
  await settle();
  assert.equal(tagOf(document.querySelector(".md-plus-hl")), "null");
});

test("mermaid 块画成图形，并且不重复上色", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  await settle();
  assert.equal(tagOf(document.querySelector(".md-plus-hl")), "null", "不该再当普通代码高亮");
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

// ── 头部语言标签被宿主换成占位文案（CodeToolbar）时的识别回归 ──────────
// 真机上 DSH 不认识的语言标签显示占位文案，读不到围栏语言；
// 这两条就是拦住「mermaid 不渲染」和「普通代码被误判成图」的用例。

test("占位文案下，mermaid 仍按正文认出来并出图", async () => {
  mount();
  window.__DSH_MD_PLUS_MMD__.calls.length = 0;
  document.body.innerHTML = toolbarBlockHtml("代码块", "flowchart LR\n A --> B");
  await settle();

  const block = document.querySelector(".md-code-block");
  assert.equal(window.__DSH_MD_PLUS_MMD__.calls.length, 1, "占位标签下也要送去渲染");
  assert.ok(document.querySelector(".md-plus-mmd svg[data-stub]"), "应该渲染出图形");
  assert.equal(block.getAttribute("data-md-plus-mmd"), "diagram");
});

test("正文嗅探会跳过 %% 指令行与 --- frontmatter 块", async () => {
  mount();
  window.__DSH_MD_PLUS_MMD__.calls.length = 0;
  document.body.innerHTML = toolbarBlockHtml(
    "代码块",
    [
      "%%{init: {theme: 'neutral'}}%%",
      "---",
      "config:",
      "  layout: elk",
      "---",
      "erDiagram",
      "  A ||--o{ B : has",
    ].join("\n"),
  );
  await settle();

  assert.equal(window.__DSH_MD_PLUS_MMD__.calls.length, 1, "剥掉指令与 frontmatter 后仍要认出 erDiagram");
  assert.equal(document.querySelector(".md-code-block").getAttribute("data-md-plus-mmd"), "diagram");
});

test("占位文案不会被当成图：普通代码留在代码形态", async () => {
  mount();
  window.__DSH_MD_PLUS_MMD__.calls.length = 0;
  document.body.innerHTML = toolbarBlockHtml("代码块", "void main() {}");
  await settle();

  const block = document.querySelector(".md-code-block");
  assert.equal(window.__DSH_MD_PLUS_MMD__.calls.length, 0, "普通代码不该被送去画图");
  assert.equal(block.hasAttribute("data-md-plus-mmd"), false, "不该标成图块");
  assert.equal(tagOf(block.querySelector(".md-plus-tool")), "null", "DSH 已有原生换行按钮时不应再加一颗");
  assert.equal(block.querySelectorAll("[data-code-block-banner] button").length, 2, "保留原生换行与复制");
  const src = block.querySelector("[data-code-block-content] pre");
  assert.equal(src.textContent, "void main() {}", "源码原样留着，复制仍拿到原文");
});

test("标签本身是 mermaid 系时照旧按标签认（mmd / mermaidjs / menu 里的 mmd）", async () => {
  for (const lang of ["mermaid", "mmd", "mermaidjs"]) {
    mount();
    window.__DSH_MD_PLUS_MMD__.calls.length = 0;
    document.body.innerHTML = toolbarBlockHtml(lang, "graph LR\n  A[入口] --> B[出口]");
    await settle();
    assert.equal(
      window.__DSH_MD_PLUS_MMD__.calls.length,
      1,
      `${lang} 标签下应该渲染`,
    );
  }
});

// ── mermaid 12.x 新增的两个图种：占位标签下也要能认出来 ────────────────

test("12.x 新图种 usecase-beta / agentflow-beta 在占位标签下也认", async () => {
  for (const [keyword, source] of [
    [
      "usecase-beta",
      'usecase-beta\ndirection LR\nactor Customer("用户")\nCheckout("下单")\nCustomer --> Checkout',
    ],
    ["agentflow-beta", "agentflow-beta\n  A --> B"],
  ]) {
    mount();
    window.__DSH_MD_PLUS_MMD__.calls.length = 0;
    document.body.innerHTML = toolbarBlockHtml("代码块", source);
    await settle();

    assert.equal(window.__DSH_MD_PLUS_MMD__.calls.length, 1, `${keyword} 应该送去渲染`);
    assert.equal(
      document.querySelector(".md-code-block").getAttribute("data-md-plus-mmd"),
      "diagram",
      `${keyword} 要标成图块`,
    );
  }
});

test("渲染器吐出错误卡片时，回退源码 + 一行原因（不把卡片当图）", async () => {
  mount();
  // mermaid 画不出来时返回的就是这张卡片，客户端不能把它当图插进卡片里
  const original = window.__DSH_MD_PLUS_MMD__.render;
  window.__DSH_MD_PLUS_MMD__.render = async () =>
    '<svg aria-roledescription="error"><text>Syntax error in text</text></svg>';
  try {
    document.body.innerHTML = codeBlockHtml("mermaid", "flowchart TD\n A -->");
    await settle();

    const block = document.querySelector(".md-code-block");
    const note = document.querySelector(".md-plus-mmd-error");
    assert.equal(tagOf(document.querySelector(".md-plus-mmd svg[aria-roledescription='error']")), "null",
      "错误卡片不该被当成图",
    );
    assert.equal(block.getAttribute("data-md-plus-mmd"), "failed", "要标成失败态");
    assert.ok(note, "要挂一行失败原因");
    assert.match(note.textContent, /^mermaid 渲染失败：/);
  } finally {
    window.__DSH_MD_PLUS_MMD__.render = original;
  }
});

test("mermaid 块的头部是图形/代码切换，不是不换行", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("mermaid", "flowchart LR\n A --> B");
  await settle();
  const block = document.querySelector(".md-code-block");
  assert.ok(block.querySelector(".md-plus-toggle"), "要有图形/代码切换按钮");
  assert.equal(tagOf(block.querySelector(".md-plus-tool")), "null", "不该出现不换行按钮");
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

test("头部六颗按钮：缩小 / 放大 / 切换 / 全屏 / 配色 / 复制", async () => {
  const block = await mermaidBlock();
  const buttons = [...block.querySelectorAll("[data-code-block-banner] button")];
  assert.deepEqual(
    buttons.map((b) => b.classList.contains("md-plus-btn")),
    [true, true, true, true, true, false],
    "最后那颗是 DSH 原生的复制按钮",
  );
  assert.deepEqual(
    buttons.slice(0, 5).map((b) => [...b.classList].filter((c) => c !== "md-plus-btn")),
    [["md-plus-zoom-out"], ["md-plus-zoom-in"], ["md-plus-toggle"], ["md-plus-expand"], ["md-plus-theme"]],
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

test("全屏查看复制当前图，按 Esc 关闭", async () => {
  const block = await mermaidBlock();
  block.querySelector(".md-plus-expand").dispatchEvent(new window.Event("click"));

  const modal = document.querySelector(".md-plus-mmd-modal");
  assert.ok(modal, "点全屏应该挂出覆盖层");
  const clone = modal.querySelector(".md-plus-mmd-modal-stage svg");
  assert.ok(clone, "覆盖层里要有图的副本");
  assert.equal(clone.getAttribute("width"), "320", "副本按 viewBox 恢复原始宽度");
  assert.equal(clone.getAttribute("height"), "200", "副本按 viewBox 恢复原始高度");
  assert.equal(modal.querySelector(".md-plus-expand"), null, "覆盖层里不该再套一个全屏按钮");
  assert.deepEqual(
    [...modal.querySelectorAll(".md-plus-mmd-modal-actions button")].slice(0, 3).map((b) => b.textContent),
    ["适应整图", "下载 SVG", "下载 PNG"],
    "工具栏要提供两种导出",
  );

  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(tagOf(document.querySelector(".md-plus-mmd-modal")), "null", "Esc 要关闭覆盖层");
});

test("Mermaid 配色按钮循环并重画", async () => {
  const block = await mermaidBlock();
  block.querySelector(".md-plus-theme").dispatchEvent(new window.Event("click"));
  await settle();

  assert.equal(window.localStorage.getItem("dsh-md-plus-mermaid-theme"), "neutral");
  assert.equal(window.__DSH_MD_PLUS_MMD__.calls.at(-1).theme, "neutral", "重画时要传入选中的配色");
});

test("宿主按钮已有 SVG 图标时不再叠加复制图标", async () => {
  mount();
  await settle();
  const css = stylesheet();
  assert.match(css, /button:last-child:not\(:has\(svg\)\)::before/, "只给旧版没有 SVG 的复制按钮补图标");
  assert.match(css, /\.md-plus-btn::before\{content:'';width:15px/, "插件按钮保留自己的图标底座");
  assert.doesNotMatch(css, /\[data-code-block-banner\] button::before/, "不能对所有原生按钮硬加复制图标");
});

test("长代码块超过阈值时出现展开按钮", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("bash", "echo hello\n".repeat(80));
  const content = document.querySelector("[data-code-block-content]");
  Object.defineProperty(content, "scrollHeight", { value: 900, configurable: true });
  await settle();

  assert.equal(content.getAttribute("data-md-plus-fold"), "on");
  const toggle = content.querySelector(".md-plus-fold-toggle");
  assert.ok(toggle, "折叠后要有展开按钮");
  toggle.dispatchEvent(new window.Event("click"));
  assert.equal(content.getAttribute("data-md-plus-fold"), "off");
  assert.equal(toggle.textContent, "收起");
});

test("长表格超过阈值时出现展开按钮", async () => {
  mount();
  document.body.innerHTML =
    '<div class="_markdown_x"><div id="long-table"><table><tbody><tr><td>x</td></tr></tbody></table></div></div>';
  const table = document.querySelector("#long-table");
  Object.defineProperty(table, "scrollHeight", { value: 900, configurable: true });
  await settle();

  assert.equal(table.getAttribute("data-md-plus-fold"), "on");
  assert.ok(table.querySelector(".md-plus-fold-toggle"), "折叠后要有展开按钮");
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
  assert.equal(tagOf(document.querySelector(".md-plus-zoom-in")), "null");
  assert.equal(tagOf(document.querySelector(".md-plus-zoom-out")), "null");
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
  assert.equal(tagOf(block.querySelector(".md-plus-mmd")), "null", "失败的图不该留在页面上");
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
    '<div data-streaming="true">' + codeBlockHtml("gdscript", "var a = [") + "</div>";
  await settle();
  assert.equal(tagOf(document.querySelector(".md-plus-hl")), "null", "流式中不该插入");

  // 流式结束：DSH 会摘掉 data-streaming
  document.querySelector("[data-streaming]").removeAttribute("data-streaming");
  await settle();
  assert.ok(document.querySelector(".md-plus-hl"), "定稿后应该补上高亮");
});

test("源码变了会重新上色", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("gdscript", "var a = 1");
  await settle();
  const before = document.querySelector(".md-plus-hl");

  document.querySelector(".md-code-block code").textContent = "var a = 2";
  await settle();

  const blocks = document.querySelectorAll(".md-plus-hl");
  assert.equal(blocks.length, 1, "旧宿主要被换掉而不是堆积");
  assert.ok(blocks[0] !== before, "旧宿主要被换掉而不是堆积");
  assert.match(blocks[0].textContent, /a = 2/);
});

test("插自己的节点不会自激成死循环", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("gdscript", "var a = 1");
  await settle();
  await settle();
  assert.equal(document.querySelectorAll(".md-plus-hl").length, 1);
});

test("未知语言安静跳过", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("notalanguage", "???");
  await settle();
  assert.equal(tagOf(document.querySelector(".md-plus-hl")), "null");
});

test("卸载后不留下样式与观察者", async () => {
  const effects = [];
  const ctx = { effect: (fn) => { effects.push(fn()); } };
  document.body.innerHTML = "";
  api.apply(ctx);
  assert.ok(document.querySelector("style[data-md-plus-style]"), "应注入样式");

  effects[0]();
  assert.equal(tagOf(document.querySelector("style[data-md-plus-style]")), "null", "卸载要摘掉样式");
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
  assert.match(css, /\.md-code-block pre\{padding:6px 16px 16px;font-size:var\(--md-plus-code-font-size,inherit\)\}/, "首行代码上方补 6px，别贴着头部");
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
  assert.equal(tagOf(document.querySelector(".md-plus-hl")), "null", "但不该重复上色");
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

// ── 表格增强、图片放大、设置面板与国际化 ─────────────────────────────

function tableHtml() {
  return (
    '<div class="_markdown_x"><div id="copy-table"><table>' +
    "<thead><tr><th>名称</th><th>数量</th></tr></thead>" +
    "<tbody><tr><td>苹果</td><td>2</td></tr><tr><td>香蕉, 大</td><td>3</td></tr></tbody>" +
    "</table></div></div>"
  );
}

function stubClipboard() {
  const copied = [];
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text) => copied.push(text) },
  });
  return copied;
}

test("表格表头吸顶", async () => {
  mount();
  await settle();
  const css = stylesheet();
  assert.match(
    css,
    /div:has\(> table\) > table thead th\{position:sticky;top:0;z-index:1\}/,
    "表头要 sticky 在滚动容器顶部",
  );
  assert.doesNotMatch(
    css,
    /div:has\(> table\) > table\{[^}]*overflow:hidden/,
    "表格自身不能 overflow:hidden，否则 sticky 没有可用的滚动祖先",
  );
});

test("表格复制 CSV / Markdown", async () => {
  mount();
  const copied = stubClipboard();
  document.body.innerHTML = tableHtml();
  await settle();

  const tools = document.querySelector("#copy-table > table > .md-plus-table-tools");
  assert.ok(tools, "表格要挂出复制按钮");
  const buttons = [...tools.querySelectorAll("button")];
  assert.deepEqual(buttons.map((b) => b.textContent), ["CSV", "Markdown"]);

  buttons[0].dispatchEvent(new window.Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(copied.at(-1), "名称,数量\n苹果,2\n\"香蕉, 大\",3");

  buttons[1].dispatchEvent(new window.Event("click"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(
    copied.at(-1),
    "| 名称 | 数量 |\n| --- | --- |\n| 苹果 | 2 |\n| 香蕉, 大 | 3 |",
  );
});

test("点开 Markdown 图片放大，Esc 关闭", async () => {
  mount();
  document.body.innerHTML =
    '<div class="_markdown_x"><p><img src="http://127.0.0.1:43120/pic.png" alt="截图"></p></div>';
  await settle();

  document.querySelector("img").dispatchEvent(new window.Event("click", { bubbles: true }));
  const modal = document.querySelector(".md-plus-img-modal");
  assert.ok(modal, "点图片要打开放大层");
  assert.match(modal.querySelector("img").src, /pic\.png$/);
  assert.equal(modal.querySelector("img").alt, "截图");

  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(tagOf(document.querySelector(".md-plus-img-modal")), "null", "Esc 要关闭图片层");
});

test("宿主原生图片预览按钮里的图片不重复接管", async () => {
  mount();
  document.body.innerHTML =
    '<div class="_markdown_x"><p><button type="button" class="_imageButton_x">' +
    '<img src="http://127.0.0.1:43120/native.png" alt="原生预览"></button></p></div>';
  await settle();

  document.querySelector("img").dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(
    tagOf(document.querySelector(".md-plus-img-modal")),
    "null",
    "图片已经在宿主的 imageButton 里时，插件不能再开自己的预览层",
  );
});

test("链接里的图片不抢点击", async () => {
  mount();
  document.body.innerHTML =
    '<div class="_markdown_x"><p><a href="http://127.0.0.1:43120/target">' +
    '<img src="http://127.0.0.1:43120/linked.png" alt="链接图片"></a></p></div>';
  await settle();

  document.querySelector("img").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
  assert.equal(
    tagOf(document.querySelector(".md-plus-img-modal")),
    "null",
    "链接图片的点击应该留给链接本身",
  );
});

test("设置面板保存字号、折叠阈值、配色和默认视图", async () => {
  mount();
  document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
  await settle();

  const gear = document.querySelector(".md-plus-settings-btn");
  assert.ok(gear, "要有一个设置入口");
  gear.dispatchEvent(new window.Event("click"));
  const modal = document.querySelector(".md-plus-settings-modal");
  assert.ok(modal, "点设置要打开面板");

  const [font, foldCode, foldTable, foldDiagram] = modal.querySelectorAll("input");
  font.value = "15";
  foldCode.value = "600";
  foldTable.value = "700";
  foldDiagram.value = "800";
  modal.querySelector("select").value = "forest";
  modal.querySelectorAll("select")[1].value = "code";
  modal.querySelector(".md-plus-settings-modal-primary").dispatchEvent(new window.Event("click"));

  assert.equal(
    window.localStorage.getItem("dsh-md-plus-settings"),
    JSON.stringify({ codeFontSize: 15, diagramView: "code", foldCode: 600, foldTable: 700, foldDiagram: 800 }),
  );
  assert.equal(window.localStorage.getItem("dsh-md-plus-mermaid-theme"), "forest");
  assert.equal(document.documentElement.style.getPropertyValue("--md-plus-code-font-size"), "15px");
  assert.equal(tagOf(document.querySelector(".md-plus-settings-modal")), "null", "保存后要关闭面板");
});

test("英文界面下按钮文案切换", async () => {
  document.documentElement.lang = "en-US";
  try {
    mount();
    document.body.innerHTML = codeBlockHtml("dart", "int a = 1;");
    await settle();
    const block = document.querySelector(".md-code-block");
    assert.equal(block.querySelector(".md-plus-tool").title, "No wrap (horizontal scroll)");
  } finally {
    document.documentElement.lang = "zh-CN";
  }
});

