// dsh-md-plus 构建：产出四个文件。
//   lib/index.js             宿主半，纯 ESM，直接照搬
//   lib/client.js            浏览器半，模块加载器直接执行的 lazy-CJS 包装
//   lib/highlight-runtime.js Shiki + 补的语言语法，按需从同源路由加载
//   lib/mermaid-runtime.js   mermaid，只有出现 mermaid 围栏时才加载
import { build } from "esbuild";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "lib");

mkdirSync(OUT, { recursive: true });

// 宿主半没有依赖也不需要转译，原地复制即可
copyFileSync(join(ROOT, "src/index.js"), join(OUT, "index.js"));

const shared = {
  bundle: true,
  platform: "browser",
  target: ["chrome120"],
  logLevel: "warning",
  legalComments: "none",
};

await build({
  ...shared,
  entryPoints: [join(ROOT, "src/client.js")],
  outfile: join(OUT, "client.js"),
  format: "esm",
  minify: false,
});

for (const entry of ["highlight-runtime", "mermaid-runtime"]) {
  await build({
    ...shared,
    entryPoints: [join(ROOT, `src/${entry}.js`)],
    outfile: join(OUT, `${entry}.js`),
    format: "iife",
    minify: true,
  });
}

for (const name of ["index.js", "client.js", "highlight-runtime.js", "mermaid-runtime.js"]) {
  const size = statSync(join(OUT, name)).size;
  console.log(`dsh-md-plus: lib/${name} — ${(size / 1024).toFixed(1)} KiB`);
}
