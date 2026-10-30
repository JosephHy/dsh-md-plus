// dsh-md-plus 宿主半：只做一件事——把两个浏览器端运行时经同源路由发出去。
// 皮肤与行为全在浏览器半（lib/client.js），这里不做别的。
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

export const name = "dsh-md-plus";
export const inject = ["webServer"];

/** 路由路径 → 构建产物文件名。客户端半里的同名常量必须与之一致。 */
export const RUNTIMES = {
  "/dsh-md-plus/highlight-runtime.js": "highlight-runtime.js",
  "/dsh-md-plus/mermaid-runtime.js": "mermaid-runtime.js",
};

const etagCache = new Map();

/** 读运行时并生成基于内容的 ETag；ctime 变化时重新读取。 */
async function readRuntime(source) {
  const info = await stat(source);
  const cached = etagCache.get(source.href);
  if (cached !== undefined && cached.size === info.size && cached.ctimeMs === info.ctimeMs) {
    return cached;
  }
  const body = await readFile(source);
  const etag = `W/"${createHash("sha1").update(body).digest("base64url")}"`;
  const entry = { size: info.size, ctimeMs: info.ctimeMs, etag, body };
  etagCache.set(source.href, entry);
  return entry;
}

export function apply(ctx) {
  for (const [path, file] of Object.entries(RUNTIMES)) {
    const source = new URL(`./${file}`, import.meta.url);
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: "exact",
          path,
          async handler(req, res) {
            if (req.method !== "GET" && req.method !== "HEAD") {
              res.writeHead(405);
              res.end();
              return;
            }
            try {
              // 文件名不带内容指纹，原来的一年 immutable 会让升级后的运行时发不出去：
              // 改成每次回源校验，内容没变就 304。
              const entry = await readRuntime(source);
              if (req.headers?.["if-none-match"] === entry.etag) {
                res.writeHead(304, { etag: entry.etag, "cache-control": "no-cache" });
                res.end();
                return;
              }
              res.writeHead(200, {
                "content-type": "text/javascript; charset=utf-8",
                "cache-control": "no-cache",
                etag: entry.etag,
              });
              res.end(req.method === "HEAD" ? undefined : entry.body);
            } catch {
              res.writeHead(404);
              res.end();
            }
          },
        }),
      `dsh-md-plus: ${path} route`,
    );
  }
}
