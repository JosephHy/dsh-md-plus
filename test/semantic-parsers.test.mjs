// 语义视图解析器单测：只测纯数据，不搭 DOM。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDelimited,
  parseDiff,
  parseJson,
  parseLog,
  semanticKindFor,
} from "../src/semantic-parsers.js";

test("语义视图语言映射", () => {
  assert.equal(semanticKindFor("json"), "json");
  assert.equal(semanticKindFor("csv"), "csv");
  assert.equal(semanticKindFor("tsv"), "tsv");
  assert.equal(semanticKindFor("log"), "log");
  assert.equal(semanticKindFor("diff"), "diff");
  assert.equal(semanticKindFor("patch"), "diff");
  assert.equal(semanticKindFor("python"), null);
  assert.equal(semanticKindFor(""), null);
});

test("CSV：普通表格", () => {
  const result = parseDelimited("name,age\nAlice,30\nBob,25");
  assert.deepEqual(result.rows, [
    ["name", "age"],
    ["Alice", "30"],
    ["Bob", "25"],
  ]);
  assert.equal(result.width, 2);
});

test("CSV：引号内的逗号和换行", () => {
  const result = parseDelimited('name,note\n"Smith, John","line1\nline2"\n');
  assert.deepEqual(result.rows, [
    ["name", "note"],
    ["Smith, John", "line1\nline2"],
  ]);
});

test("CSV：双引号转义", () => {
  const result = parseDelimited('text\n"say ""hello"""');
  assert.deepEqual(result.rows, [["text"], ['say "hello"']]);
});

test("CSV：CRLF、BOM 和空字段", () => {
  const result = parseDelimited("\uFEFFa,b,c\r\n1,,3\r\n");
  assert.deepEqual(result.rows, [
    ["a", "b", "c"],
    ["1", "", "3"],
  ]);
});

test("TSV：制表符分隔", () => {
  const result = parseDelimited("a\tb\n1\t2", "\t");
  assert.deepEqual(result.rows, [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("CSV：不规则列数保持原样", () => {
  const result = parseDelimited("a,b\n1\n2,3,4");
  assert.deepEqual(result.rows, [["a", "b"], ["1"], ["2", "3", "4"]]);
  assert.equal(result.width, 3);
});

test("CSV：空文本得到空行集", () => {
  assert.deepEqual(parseDelimited("").rows, []);
});

test("日志：识别级别并统计", () => {
  const result = parseLog(
    [
      "2026-01-01 10:00:00 INFO 服务启动",
      "2026-01-01 10:00:01 WARN 连接变慢",
      "2026-01-01 10:00:02 ERROR 请求失败",
      "2026-01-01 10:00:03 DEBUG 重试中",
      "没有级别的一行",
    ].join("\n"),
  );
  assert.deepEqual(
    result.lines.map((line) => line.level),
    ["info", "warn", "error", "debug", "other"],
  );
  assert.deepEqual(result.counts, {
    all: 5,
    error: 1,
    warn: 1,
    info: 1,
    debug: 1,
    other: 1,
  });
  assert.equal(result.lines[0].lineNumber, 1);
  assert.equal(result.lines[2].message, "2026-01-01 10:00:02 请求失败");
});

test("日志：正文里的 error 不会误判", () => {
  const result = parseLog("这个功能没有 error 但也只是普通说明");
  assert.equal(result.lines[0].level, "other");
});

test("日志：小写 error: 前缀也能识别", () => {
  const result = parseLog("error: 请求失败");
  assert.equal(result.lines[0].level, "error");
  assert.equal(result.lines[0].message, "请求失败");
});

test("日志：空文本", () => {
  assert.deepEqual(parseLog("").lines, []);
});

test("Diff：标准 hunk 与行号", () => {
  const result = parseDiff(
    [
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,3 +1,4 @@",
      " one",
      "-two",
      "+two!",
      "+three",
      " four",
    ].join("\n"),
  );
  assert.equal(result.hunks.length, 1);
  assert.equal(result.stats.added, 2);
  assert.equal(result.stats.removed, 1);
  const types = result.hunks[0].lines.map((line) => line.type);
  assert.deepEqual(types, ["context", "remove", "add", "add", "context"]);
  assert.deepEqual(
    result.hunks[0].lines.map((line) => [line.oldLine, line.newLine]),
    [
      [1, 1],
      [2, null],
      [null, 2],
      [null, 3],
      [3, 4],
    ],
  );
});

test("Diff：多个 hunk", () => {
  const result = parseDiff(
    ["@@ -1,1 +1,1 @@", "-a", "+b", "@@ -10,1 +10,1 @@", "-c", "+d"].join("\n"),
  );
  assert.equal(result.hunks.length, 2);
  assert.equal(result.hunks[1].oldStart, 10);
  assert.deepEqual(result.stats, { added: 2, removed: 2 });
});

test("Diff：多个文件的头不会当成删除行", () => {
  const result = parseDiff(
    [
      "diff --git a/a.txt b/a.txt",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1 +1 @@",
      "-a",
      "+b",
      "diff --git a/c.txt b/c.txt",
      "--- a/c.txt",
      "+++ b/c.txt",
      "@@ -1 +1 @@",
      "-c",
      "+d",
    ].join("\n"),
  );
  assert.equal(result.hunks.length, 2);
  assert.deepEqual(
    result.hunks.map((hunk) => hunk.lines.map((line) => line.type)),
    [["remove", "add"], ["remove", "add"]],
  );
  assert.deepEqual(result.stats, { added: 2, removed: 2 });
});

test("Diff：没有 diff --git 的多文件头也能识别", () => {
  const result = parseDiff(
    ["@@ -1 +1 @@", "-a", "+b", "--- a/c.txt", "+++ b/c.txt", "@@ -1 +1 @@", "-c", "+d"].join(
      "\n",
    ),
  );
  assert.equal(result.hunks.length, 2);
  assert.deepEqual(
    result.hunks.map((hunk) => hunk.lines.map((line) => line.type)),
    [["remove", "add"], ["remove", "add"]],
  );
});

test("Diff：没有 @@ 的简单 diff 退化成合成 hunk", () => {
  const result = parseDiff("-old\n+new\nsame");
  assert.equal(result.hunks.length, 1);
  assert.equal(result.hunks[0].header, "");
  assert.deepEqual(
    result.hunks[0].lines.map((line) => line.type),
    ["remove", "add", "context"],
  );
  assert.deepEqual(result.stats, { added: 1, removed: 1 });
});

test("Diff：No newline 提示行", () => {
  const result = parseDiff("@@ -1 +1 @@\n-a\n+b\n\\ No newline at end of file");
  assert.equal(result.hunks[0].lines.at(-1).type, "meta");
});

test("JSON：合法与非法", () => {
  assert.deepEqual(parseJson('{"a":1}'), { ok: true, value: { a: 1 } });
  const bad = parseJson("{oops}");
  assert.equal(bad.ok, false);
  assert.match(bad.error, /JSON|Unexpected|position/i);
});

test("CSV：字段中间的裸引号按普通字符保留", () => {
  const single = parseDelimited('id,payload\n1,{"a":1}\n2,{"b":2}');
  assert.deepEqual(single.rows, [
    ["id", "payload"],
    ["1", '{"a":1}'],
    ["2", '{"b":2}'],
  ]);

  const heights = parseDelimited('name,height\nAlice,5\'6"\nBob,6\'0"');
  assert.deepEqual(heights.rows, [
    ["name", "height"],
    ["Alice", '5\'6"'],
    ["Bob", '6\'0"'],
  ]);
});

test("CSV：字段开头的空格会让后面的引号变成普通字符", () => {
  const result = parseDelimited('x,y\n "quoted",z');
  assert.deepEqual(result.rows, [
    ["x", "y"],
    [' "quoted"', "z"],
  ]);
});

test("CSV：字段开头的引号仍是引号段，未转义 JSON 列按逗号分列", () => {
  const result = parseDelimited('id,payload\n1,{"a":1,"b":2}');
  assert.deepEqual(result.rows, [
    ["id", "payload"],
    ["1", '{"a":1', "b:2}"],
  ]);
  assert.equal(result.width, 3);
});
