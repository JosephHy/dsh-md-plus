// dsh-md-plus 宿主半：只做一件事——把两个浏览器端运行时经同源路由发出去。
// 皮肤与行为全在浏览器半（lib/client.js），这里不做别的。
import { readFile } from "node:fs/promises";

export const name = "dsh-md-plus";
export const inject = ["webServer"];

/** 路由路径 → 构建产物文件名。客户端半里的同名常量必须与之一致。 */
export const RUNTIMES = {
  "/dsh-md-plus/highlight-runtime.js": "highlight-runtime.js",
  "/dsh-md-plus/mermaid-runtime.js": "mermaid-runtime.js",
};

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
              const body = await readFile(source);
              res.writeHead(200, {
                "content-type": "text/javascript; charset=utf-8",
                "cache-control": "public, max-age=31536000, immutable",
              });
              res.end(req.method === "HEAD" ? undefined : body);
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
