#!/usr/bin/env node
// 发版脚本：把 CHANGELOG 当前版本的「未发布」改成发布日期，然后提交、打 tag、推代码和 tag。
//
// 用法：
//   npm run release:dry                 # 只打印计划，不改文件、不提交
//   npm run release                     # 交互确认后执行
//   npm run release:yes                 # 跳过确认直接执行
//   node scripts/release.mjs --date=2026-11-03   # 指定发布日期
//
// 前置：package.json 的 version 必须已经由 `npm version ... --no-git-tag-version` 定好，
// 且 CHANGELOG 顶部有同版本的「## x.y.z —— 未发布」。
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const PACKAGE = join(ROOT, "package.json");
const DEFAULT_REMOTE = "origin";

process.chdir(ROOT);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { date: null, dryRun: false, yes: false, remote: DEFAULT_REMOTE };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--yes" || arg === "-y") options.yes = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "用法：node scripts/release.mjs [选项]",
          "",
          "  --dry-run        只打印计划，不修改 CHANGELOG、不提交、不推送",
          "  --yes, -y        跳过确认",
          "  --date=YYYY-MM-DD  指定发布日期（默认本机今天）",
          "  --remote=NAME    远程名（默认 origin）",
          "",
          "npm 脚本：npm run release:dry / npm run release / npm run release:yes",
        ].join("\n"),
      );
      process.exit(0);
    } else if (arg.startsWith("--date=")) options.date = arg.slice("--date=".length);
    else if (arg.startsWith("--remote=")) options.remote = arg.slice("--remote=".length);
    else fail(`未知参数：${arg}`);
  }
  return options;
}

function localDate() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`日期格式应为 YYYY-MM-DD：${value}`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(`不是有效日期：${value}`);
  }
  return value;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function gitInherit(args) {
  const result = spawnSync("git", args, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} 失败`);
}

function gitQuiet(args) {
  const result = spawnSync("git", args, { cwd: ROOT, stdio: "ignore" });
  return result.status === 0;
}

function printStatus(status) {
  const lines = status === "" ? [] : status.split(/\r?\n/);
  if (lines.length === 0) {
    console.log("  工作区：没有未提交改动（只会在 CHANGELOG 里写入发布日期）");
    return;
  }
  console.log(`  工作区改动：${lines.length} 项`);
  for (const line of lines) console.log(`    ${line}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const version = JSON.parse(readFileSync(PACKAGE, "utf8")).version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`package.json 的 version 不是有效版本号：${String(version)}`);
  }

  const date = validateDate(options.date ?? localDate());
  if (options.remote.trim() === "") fail("远程名不能为空");
  if (!gitQuiet(["remote", "get-url", options.remote])) {
    fail(`找不到远程 ${options.remote}，请先配置 origin`);
  }
  const branch = (() => {
    try {
      return git(["symbolic-ref", "--short", "HEAD"]);
    } catch {
      return fail("当前处于 detached HEAD，不能发版");
    }
  })();

  const original = readFileSync(CHANGELOG, "utf8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original.split(/\r?\n/);
  const heading = `## ${version} —— 未发布`;
  const index = lines.findIndex((line) => line.trim() === heading);
  if (index === -1) {
    fail(`CHANGELOG.md 里找不到「${heading}」，先把版本号定好再发版`);
  }
  const firstHeading = lines.findIndex((line) => line.startsWith("## "));
  if (firstHeading !== index) fail(`「${heading}」不是 CHANGELOG 最新一条，拒绝发版`);

  const tag = `v${version}`;
  if (gitQuiet(["rev-parse", "-q", "--verify", `refs/tags/${tag}`])) {
    fail(`本地已存在 tag ${tag}`);
  }
  const remoteTag = git(["ls-remote", "--tags", options.remote, `refs/tags/${tag}`]);
  if (remoteTag !== "") fail(`远程 ${options.remote} 已存在 tag ${tag}`);

  const status = git(["status", "--porcelain=v1"]);
  console.log(`dsh-md-plus 发布计划`);
  console.log(`  版本：${version}`);
  console.log(`  日期：${date}`);
  console.log(`  分支：${branch}`);
  console.log(`  远程：${options.remote}（${git(["remote", "get-url", options.remote])}）`);
  console.log(`  CHANGELOG：${heading}  →  ## ${version} —— ${date}`);
  printStatus(status);
  console.log(`  tag：${tag}`);

  if (options.dryRun) {
    console.log("\n将执行：");
    console.log("  git add -A");
    console.log("  git add -f lib");
    console.log(`  git commit -m "release: ${version}"`);
    console.log(`  git tag -a ${tag} -m "release: ${version}"`);
    console.log(`  git push ${options.remote} ${branch}`);
    console.log(`  git push ${options.remote} ${tag}`);
    console.log("\n--dry-run：没有修改文件、没有提交、没有推送。");
    return;
  }

  if (!options.yes) {
    if (!stdin.isTTY) fail("当前不是交互终端，请用 npm run release:yes 或加 --yes");
    const readline = createInterface({ input: stdin, output: stdout });
    const answer = await readline.question("确认执行以上发布操作？[y/N] ");
    readline.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log("已取消。");
      return;
    }
  }

  const updated = lines.map((line, lineIndex) => (lineIndex === index ? `## ${version} —— ${date}` : line)).join(newline);
  writeFileSync(CHANGELOG, updated, "utf8");

  try {
    gitInherit(["add", "-A"]);
    gitInherit(["add", "-f", "lib"]);
    const staged = git(["diff", "--cached", "--name-only"]);
    if (staged === "") throw new Error("没有可提交的改动");
    gitInherit(["commit", "-m", `release: ${version}`]);
    gitInherit(["tag", "-a", tag, "-m", `release: ${version}`]);
    gitInherit(["push", options.remote, branch]);
    gitInherit(["push", options.remote, tag]);
  } catch (error) {
    fail(
      `${error.message}\nCHANGELOG 已写入发布日期；如果提交或推送失败，请先检查 git status，不要盲目重跑。`,
    );
  }

  console.log(`\n✔ ${version} 已提交并打 tag，代码和 tag 已推送到 ${options.remote}；npm 发布由 tag 触发的 GitHub Actions 处理。`);
}

await main().catch((error) => fail(error?.message ?? String(error)));
