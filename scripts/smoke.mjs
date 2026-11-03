#!/usr/bin/env node
// 真实浏览器 smoke：happy-dom 没有 canvas，测不到 Mermaid 的 PNG 导出。
// 这里用本机 Chrome 渲染一张真实图，确认没有 foreignObject、canvas 能导出。
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RUNTIME = pathToFileURL(join(ROOT, "lib/mermaid-runtime.js")).href;
const work = mkdtempSync(join(tmpdir(), "dsh-md-plus-smoke-"));
const profile = join(work, "chrome-profile");
const page = join(work, "smoke.html");
mkdirSync(profile, { recursive: true });

const html = `<!doctype html>
<meta charset="utf-8">
<body>
<div id="smoke-result">pending</div>
<script src="${RUNTIME}"></script>
<script>
(async () => {
  const result = {};
  try {
    const svg = await window.__DSH_MD_PLUS_MMD__.render(
      "smoke-1",
      "flowchart LR\\nA[测试节点]-->B[第二个]",
      false,
      "blue",
    );
    result.foreign = svg.includes("foreignObject");
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = doc.documentElement;
    const box = (root.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number);
    root.setAttribute("width", String(box[2] || 320));
    root.setAttribute("height", String(box[3] || 200));
    const serialized = new XMLSerializer().serializeToString(root);
    const image = new Image();
    result.toBlob = await new Promise((resolve) => {
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = box[2] || 320;
          canvas.height = box[3] || 200;
          canvas.getContext("2d").drawImage(image, 0, 0);
          canvas.toBlob((blob) => resolve(blob ? "ok" : "null"), "image/png");
        } catch (error) {
          resolve("threw:" + error.name);
        }
      };
      image.onerror = () => resolve("image-error");
      image.src = URL.createObjectURL(new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }));
    });

    try {
      await window.__DSH_MD_PLUS_MMD__.render(
        "smoke-2",
        "flowchart LR\\nA[Syntax error in text]-->B",
        false,
        "blue",
      );
      result.errorTextLabel = "rendered";
    } catch (error) {
      result.errorTextLabel = "ERR:" + error.message;
    }

    try {
      await window.__DSH_MD_PLUS_MMD__.render("smoke-3", "flowchart LR\\nA[", false, "blue");
      result.invalid = "unexpected-ok";
    } catch {
      result.invalid = "threw";
    }
  } catch (error) {
    result.fatal = error.name + ":" + error.message;
  }
  document.getElementById("smoke-result").textContent = JSON.stringify(result);
})();
</script>
</body>`;

try {
  writeFileSync(page, html, "utf8");
  const dom = execFileSync(
    CHROME,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-crash-reporter",
      "--allow-file-access-from-files",
      `--user-data-dir=${profile}`,
      "--virtual-time-budget=15000",
      "--dump-dom",
      pathToFileURL(page).href,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const match = dom.match(/<div id="smoke-result">([\s\S]*?)<\/div>/);
  if (match === null) throw new Error("chrome 没有返回 smoke 结果");
  const result = JSON.parse(match[1]);
  const failures = [];
  if (result.foreign !== false) failures.push(`foreignObject=${result.foreign}`);
  if (result.toBlob !== "ok") failures.push(`toBlob=${result.toBlob}`);
  if (result.errorTextLabel !== "rendered") failures.push(`errorTextLabel=${result.errorTextLabel}`);
  if (result.invalid !== "threw") failures.push(`invalid=${result.invalid}`);
  if (failures.length > 0) throw new Error(failures.join(", "));
  console.log("dsh-md-plus smoke: PASS（Mermaid SVG 文本标签、PNG canvas 导出、错误判定）");
} catch (error) {
  console.error(`dsh-md-plus smoke: FAIL — ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
