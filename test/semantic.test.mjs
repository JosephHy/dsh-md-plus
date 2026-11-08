// 代码块语义视图的 DOM 集成测试：真实构建产物 + happy-dom。
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

const DEBOUNCE_MS = 160;

let window;
let document;
let api;

const mermaidStub = {
  async render() {
    return '<svg data-stub="1" viewBox="0 0 320 200" width="100%"></svg>';
  },
};

before(async () => {
  window = new Window({ url: "http://127.0.0.1:43120/" });
  document = window.document;
  document.documentElement.lang = "zh-CN";
  globalThis.window = window;
  globalThis.document = document;
  globalThis.MutationObserver = window.MutationObserver;

  let registered = null;
  window.__ModuleLoader__ = {
    load(entry) {
      registered = entry;
    },
  };
  await import("../lib/client.js");
  api = registered.factory((name) => {
    throw new Error(`client bundle 不该 require 任何模块，却 require 了 ${name}`);
  });
});

function makeBlock(lang, code, options = {}) {
  const block = document.createElement("div");
  block.className = "_block_x md-code-block";
  const bannerWrap = document.createElement("div");
  bannerWrap.className = "_bannerWrap_x";
  const banner = document.createElement("div");
  banner.className = "_banner_x";
  banner.setAttribute("data-code-block-banner", "");
  const info = document.createElement("div");
  info.className = "_infostring_x";
  info.textContent = lang;
  const action = document.createElement("div");
  action.className = "_action_x";
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.textContent = "换行";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "复制";
  action.appendChild(wrap);
  action.appendChild(copy);
  banner.appendChild(info);
  banner.appendChild(action);
  bannerWrap.appendChild(banner);
  block.appendChild(bannerWrap);

  const content = document.createElement("div");
  content.className = "_content_x";
  content.setAttribute("data-code-block-content", "");
  const pre = document.createElement("pre");
  pre.className = options.shiki ? "shiki css-variables" : "_plain_x";
  const codeNode = document.createElement("code");
  codeNode.textContent = code;
  pre.appendChild(codeNode);
  content.appendChild(pre);
  block.appendChild(content);
  return block;
}

function mount(options = {}) {
  const effects = [];
  const ctx = { effect: (fn) => { effects.push(fn()); } };
  document.body.innerHTML = "";
  window.__DSH_MD_PLUS_MMD__ = mermaidStub;
  if (options.preserveStorage !== true) window.localStorage.clear();
  api.apply(ctx);
  return effects;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 80));

function stylesheet() {
  return document.querySelector("style[data-md-plus-style]").textContent;
}

function click(node) {
  node.dispatchEvent(new window.Event("click"));
}

test("JSON 块有语义视图按钮，点击后出现树，再点回源码", async () => {
  mount();
  const block = makeBlock("json", '{"name":"dsh","count":2,"ok":true,"list":[1,null]}');
  document.body.appendChild(block);
  await settle();

  const toggle = block.querySelector(".md-plus-semantic-toggle");
  assert.ok(toggle, "json 块应该有语义视图按钮");
  assert.equal(block.hasAttribute("data-md-plus-semantic"), false, "默认保持源码");

  click(toggle);
  assert.equal(block.getAttribute("data-md-plus-semantic"), "on");
  const view = block.querySelector(".md-plus-semantic-json");
  assert.ok(view, "点击后应出现 JSON 树");
  assert.match(view.textContent, /"dsh"/);
  assert.match(view.textContent, /name/);
  assert.ok(block.querySelector(".md-plus-json-toggle"), "对象节点要有展开按钮");

  click(toggle);
  assert.equal(block.getAttribute("data-md-plus-semantic"), "off");
});

test("DSH 自己高亮的 pre.shiki 也能打开语义视图", async () => {
  mount();
  const block = makeBlock("json", '{"nested":{"a":[1,2,3]}}', { shiki: true });
  document.body.appendChild(block);
  await settle();

  const toggle = block.querySelector(".md-plus-semantic-toggle");
  assert.ok(toggle, "pre.shiki 也必须补语义按钮");
  click(toggle);
  assert.ok(block.querySelector(".md-plus-semantic-json"));
});

test("坏 JSON 不切换，只闪提示", async () => {
  mount();
  const block = makeBlock("json", "{oops}");
  document.body.appendChild(block);
  await settle();
  const toggle = block.querySelector(".md-plus-semantic-toggle");
  click(toggle);

  assert.equal(block.hasAttribute("data-md-plus-semantic"), false);
  assert.equal(block.querySelector(".md-plus-semantic-json"), null);
  assert.equal(toggle.title, "无法解析，已显示源码");
});

test("CSV 视图正确渲染引号、逗号和字段内换行", async () => {
  mount();
  const block = makeBlock("csv", 'name,note\n"Smith, John","line1\nline2"');
  document.body.appendChild(block);
  await settle();
  click(block.querySelector(".md-plus-semantic-toggle"));

  const view = block.querySelector(".md-plus-semantic-table");
  assert.ok(view);
  assert.match(view.textContent, /1 行 × 2 列/);
  const rows = view.querySelectorAll("tbody tr");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cells[0].textContent, "Smith, John");
  assert.equal(rows[0].cells[1].textContent, "line1\nline2");
});

test("CSV 语义表格不会被 Markdown 表格装饰器重复接管", async () => {
  mount();
  const block = makeBlock("csv", "a,b\n1,2");
  document.body.appendChild(block);
  await settle();
  click(block.querySelector(".md-plus-semantic-toggle"));
  assert.equal(block.querySelector(".md-plus-table-tools"), null);
});

test("TSV 用制表符解析", async () => {
  mount();
  const block = makeBlock("tsv", "a\tb\n1\t2");
  document.body.appendChild(block);
  await settle();
  click(block.querySelector(".md-plus-semantic-toggle"));

  const cells = [...block.querySelectorAll(".md-plus-semantic-table tbody td")].map((cell) => cell.textContent);
  assert.deepEqual(cells, ["1", "2"]);
});

test("日志视图按级别着色并可筛选", async () => {
  mount();
  const block = makeBlock(
    "log",
    [
      "2026-01-01 10:00:00 INFO 启动",
      "2026-01-01 10:00:01 WARN 变慢",
      "2026-01-01 10:00:02 ERROR 失败",
    ].join("\n"),
  );
  document.body.appendChild(block);
  await settle();
  click(block.querySelector(".md-plus-semantic-toggle"));

  const view = block.querySelector(".md-plus-semantic-log");
  assert.ok(view);
  assert.equal(view.querySelectorAll(".md-plus-log-line").length, 3);
  const buttons = [...view.querySelectorAll(".md-plus-semantic-actions button")];
  assert.deepEqual(buttons.map((button) => button.textContent), ["全部 3", "错误 1", "警告 1", "信息 1", "调试 0"]);

  click(buttons[1]);
  const levels = [...view.querySelectorAll(".md-plus-log-line")].map((line) => line.getAttribute("data-level"));
  assert.deepEqual(levels, ["error"]);
});

test("Diff 默认单栏，可切并排，行号和统计正确", async () => {
  mount();
  const block = makeBlock(
    "diff",
    ["@@ -1,2 +1,2 @@", " one", "-two", "+two!"].join("\n"),
  );
  document.body.appendChild(block);
  await settle();
  click(block.querySelector(".md-plus-semantic-toggle"));

  const view = block.querySelector(".md-plus-semantic-diff");
  assert.ok(view);
  assert.match(view.textContent, /\+1/);
  assert.match(view.textContent, /−1/);
  assert.equal(view.querySelectorAll(".md-plus-diff-line").length, 3);

  const splitButton = [...view.querySelectorAll(".md-plus-semantic-actions button")].find(
    (button) => button.textContent === "并排",
  );
  click(splitButton);
  const splitRows = view.querySelectorAll(".md-plus-diff-split-row");
  assert.ok(splitRows.length >= 2, "并排模式要出双栏行");
  const changedRow = splitRows[1];
  assert.equal(changedRow.children[0].querySelector(".md-plus-diff-num").textContent, "2", "左侧删除行用旧行号");
  assert.equal(changedRow.children[1].querySelector(".md-plus-diff-num").textContent, "2", "右侧新增行用新行号");
});

test("设置里的语义默认值生效，并尊重手动切换", async () => {
  window.localStorage.setItem("dsh-md-plus-settings", JSON.stringify({ semanticDefaultView: "semantic" }));
  mount({ preserveStorage: true });
  const block = makeBlock("json", '{"a":1}');
  document.body.appendChild(block);
  await settle();

  assert.equal(block.getAttribute("data-md-plus-semantic"), "on", "默认语义应自动展开");
  assert.ok(block.querySelector(".md-plus-semantic-json"));

  click(block.querySelector(".md-plus-semantic-toggle"));
  assert.equal(block.getAttribute("data-md-plus-semantic"), "off");
  assert.equal(block.getAttribute("data-md-plus-semantic-manual"), "1");
});

test("设置面板能改语义视图默认值", async () => {
  mount();
  const block = makeBlock("json", '{"a":1}');
  document.body.appendChild(block);
  await settle();
  click(document.querySelector(".md-plus-settings-btn"));

  const modal = document.querySelector(".md-plus-settings-modal");
  const selects = modal.querySelectorAll("select");
  assert.equal(selects.length, 3, "配色、图表视图、语义视图三个下拉");
  assert.deepEqual(
    [...selects[2].options].map((option) => option.textContent),
    ["源码优先", "语义视图优先"],
  );
  selects[2].value = "semantic";
  click(modal.querySelector(".md-plus-settings-modal-primary"));

  assert.equal(JSON.parse(window.localStorage.getItem("dsh-md-plus-settings")).semanticDefaultView, "semantic");
  assert.equal(block.getAttribute("data-md-plus-semantic"), "on", "保存后当前块应立即切换");
});

test("Mermaid 块不出现语义视图按钮", async () => {
  mount();
  const block = makeBlock("mermaid", "flowchart LR\n A --> B");
  document.body.appendChild(block);
  await settle();
  assert.equal(block.querySelector(".md-plus-semantic-toggle"), null);
});

test("卸载时摘掉语义视图容器和属性", async () => {
  const effects = mount();
  const block = makeBlock("json", '{"a":1}');
  document.body.appendChild(block);
  await settle();
  click(block.querySelector(".md-plus-semantic-toggle"));
  assert.ok(block.querySelector(".md-plus-semantic-json"));

  effects[0]();
  assert.equal(document.querySelectorAll(".md-plus-semantic").length, 0);
  assert.equal(block.hasAttribute("data-md-plus-semantic"), false);
  assert.equal(block.hasAttribute("data-md-plus-semantic-manual"), false);
});

test("语义视图样式作用域和暗色变量都在", async () => {
  mount();
  await settle();
  const css = stylesheet();
  assert.match(css, /\[data-md-plus-semantic="on"\] > \[data-code-block-content\] pre\{display:none\}/);
  assert.match(css, /md-plus-icon-semantic/);
  assert.match(css, /body\[data-ds-dark-theme\] \.md-plus-semantic\{--md-plus-tbl-line:#2f2f2f/);
  assert.match(css, /\.md-plus-semantic-table td\{[^}]*text-align:center/);
  assert.match(css, /\.md-plus-semantic-number\{text-align:center/);
});
