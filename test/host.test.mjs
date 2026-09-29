// dsh-md-plus 宿主半测试：注册出来的路由要真的能把运行时文件发出去，
// 而且它和浏览器半里的 URL 必须是同一个。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { apply, name, inject, RUNTIMES } from "../lib/index.js";

/** 收一次请求，返回 { status, headers, body }。 */
function request(route, method = "GET") {
  return new Promise((resolve) => {
    const res = {
      status: 0,
      headers: null,
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers ?? null;
      },
      end(body) {
        resolve({ status: this.status, headers: this.headers, body });
      },
    };
    void route.handler({ method }, res);
  });
}

/** 装一次插件，返回注册到的路由数组。 */
function registerRoutes() {
  const routes = [];
  const ctx = {
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
    effect: (fn) => fn(),
  };
  apply(ctx);
  assert.ok(routes.length > 0, "apply 必须注册路由");
  return routes;
}

const routeFor = (routes, path) => routes.find((route) => route.path === path);

test("插件身份与依赖声明", () => {
  assert.equal(name, "dsh-md-plus");
  assert.deepEqual(inject, ["webServer"]);
});

test("两个运行时各占一条精确路由", () => {
  const routes = registerRoutes();
  assert.equal(routes.length, 2);
  for (const route of routes) assert.equal(route.kind, "exact");
  assert.deepEqual(Object.keys(RUNTIMES).sort(), [
    "/dsh-md-plus/highlight-runtime.js",
    "/dsh-md-plus/mermaid-runtime.js",
  ]);
  assert.deepEqual(
    routes.map((route) => route.path).sort(),
    Object.keys(RUNTIMES).sort(),
    "注册的路由必须与 RUNTIMES 表一致",
  );
});

test("GET 返回运行时本体", async () => {
  const routes = registerRoutes();
  for (const [path, file] of Object.entries(RUNTIMES)) {
    const { status, headers, body } = await request(routeFor(routes, path));
    assert.equal(status, 200, path);
    assert.equal(headers["content-type"], "text/javascript; charset=utf-8");
    assert.ok(Buffer.isBuffer(body) && body.length > 0);

    const onDisk = await readFile(new URL(`../lib/${file}`, import.meta.url));
    assert.ok(body.equals(onDisk), `${path} 发出去的应该就是构建产物本身`);
  }
});

test("HEAD 只回头不回体", async () => {
  const routes = registerRoutes();
  const { status, body } = await request(routeFor(routes, Object.keys(RUNTIMES)[0]), "HEAD");
  assert.equal(status, 200);
  assert.equal(body, undefined);
});

test("其它方法 405", async () => {
  const routes = registerRoutes();
  assert.equal((await request(routes[0], "POST")).status, 405);
});

test("浏览器半里的 URL 与宿主半一致", async () => {
  const client = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
  for (const path of Object.keys(RUNTIMES)) {
    assert.ok(client.includes(`"${path}"`), `client.js 里没有出现 ${path}，两端会各说各话`);
  }
});
