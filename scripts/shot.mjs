// 用 headless Chrome 把 preview.html 截成 docs/preview.png（README 首屏那张）。
// Chrome 路径可用 CHROME_PATH 覆盖。
//
// headless 的 --screenshot 只截视口大小，不截整页，所以下面的高度要跟预览内容
// 对齐：改了 preview.mjs 的示例块数量或字号，这个值也要跟着调，不然会截断或留白。
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, statSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = join(ROOT, "docs/preview.png");
const VIEWPORT = "820,2108";

mkdirSync(dirname(OUT), { recursive: true });

execFileSync(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--screenshot=" + OUT,
    "--window-size=" + VIEWPORT,
    pathToFileURL(join(ROOT, "preview.html")).href,
  ],
  { stdio: "inherit" },
);

console.log(`dsh-md-plus: docs/preview.png — ${(statSync(OUT).size / 1024).toFixed(1)} KiB`);
