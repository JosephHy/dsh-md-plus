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
      const { svg } = await mermaid.render(id, code);
      const host = document.createElement("div");
      host.innerHTML = svg;
      roundNodes(host);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return host.innerHTML;
    });
  },
};
