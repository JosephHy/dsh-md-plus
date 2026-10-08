// dsh-md-plus 的 mermaid 运行时：打包成 lib/mermaid-runtime.js，由宿主半经同源路由按需下发。
// 只有检测到 mermaid 围栏时才会加载——没用到就不下载这 3MB。
import mermaid from "mermaid";
import { buildConfig, NODE_RADIUS } from "./mermaid-theme.js";

let configuredFor = null;
let queue = Promise.resolve();

/**
 * mermaid 是单例，render 期间会往 body 插临时节点；并发调用会互相踩。
 * 排成一条链，一次只画一张，画完让出一次主线程。
 */
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.then(
    () => {},
    () => {},
  );
  return run;
}

function ensureConfigured(dark) {
  const key = dark ? "dark" : "light";
  if (configuredFor === key) return;
  configuredFor = key;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  mermaid.initialize(buildConfig(dark, family));
}

/** 把节点方框改成参考图那种大圆角；mermaid 没有对应的 token。 */
function roundNodes(host) {
  for (const rect of host.querySelectorAll(".node rect")) {
    rect.setAttribute("rx", String(NODE_RADIUS));
    rect.setAttribute("ry", String(NODE_RADIUS));
  }
}

/** mermaid 画不出来时返回的是这张「Syntax error in text」卡片，不是图。 */
function isErrorSvg(svg) {
  return svg.includes('aria-roledescription="error"') || svg.includes("Syntax error in text");
}

/**
 * mermaid 失败时会把临时容器留在页面里：容器 id 是 `d<id>`，里面是那张错误卡片。
 * 每次重渲染留一个，它们会在页面底部越堆越多——所以渲染完必须自己收干净。
 */
function cleanStrays(id) {
  // id 是本插件自己拼的（dsh-md-plus-mmd-N），只有 CSS.escape 缺失的老环境才退回原样
  const key = typeof CSS !== "undefined" && CSS.escape !== undefined ? CSS.escape(id) : id;
  for (const node of document.querySelectorAll(`#d${key}, #d${key} svg`)) node.remove();
}

window.__DSH_MD_PLUS_MMD__ = {
  /**
   * 把一段 mermaid 源码渲染成 SVG。
   * @param id - 本次渲染的唯一 id（mermaid 内部要用）。
   * @param code - 围栏里的图源。
   * @param dark - 当前是否深色主题。
   * @returns SVG 字符串；解析失败时抛错，由调用方决定怎么回退。
   */
  render(id, code, dark) {
    return enqueue(async () => {
      ensureConfigured(dark === true);
      let failure = null;
      // mermaid 的解析错误不一定抛出：配了 parseError 时它只回调，
      // 然后照常把错误卡片序列化出来当作「渲染成功」。这里两条路都堵上。
      mermaid.parseError = (error) => {
        failure ??= error;
      };
      try {
        const { svg } = await mermaid.render(id, code);
        if (failure !== null) throw failure;
        if (isErrorSvg(svg)) throw new Error("mermaid 返回的是错误卡片（语法无法解析）");
        const host = document.createElement("div");
        host.innerHTML = svg;
        roundNodes(host);
        await new Promise((resolve) => setTimeout(resolve, 0));
        return host.innerHTML;
      } finally {
        cleanStrays(id);
      }
    });
  },
};
