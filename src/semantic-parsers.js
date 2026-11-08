// 代码块语义视图的纯解析层。
// 这里不碰 DOM：输入是围栏源码，输出是结构化数据，方便单测和后续换渲染器。

/** 围栏语言 → 语义视图类型。不在表里的语言保持普通代码块。 */
export const SEMANTIC_LANGUAGES = {
  json: "json",
  csv: "csv",
  tsv: "tsv",
  log: "log",
  diff: "diff",
  patch: "diff",
};

/** @returns {"json"|"csv"|"tsv"|"log"|"diff"|null} */
export function semanticKindFor(lang) {
  return SEMANTIC_LANGUAGES[lang] ?? null;
}

/** 包一层 JSON.parse，交给视图层决定失败时怎么回退。 */
export function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(String(text ?? "")) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 按 RFC 4180 解析逗号 / 制表符分隔文本。
 * 支持引号包裹、字段内换行、双引号转义、CRLF 与 BOM；不规则列数原样保留。
 * 只有出现在字段开头的引号才开启引号段；字段中间的裸引号按普通字符保留
 * （与 Python csv.reader / Excel 一致，避免 `5'6"` 这类内容吞掉后续逗号与换行）。
 */
export function parseDelimited(text, delimiter = ",") {
  const source = String(text ?? "");
  const body = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let atFieldStart = true;
  let index = 0;

  while (index < body.length) {
    const character = body[index];
    if (inQuotes) {
      if (character === '"') {
        if (body[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += character;
      index += 1;
      continue;
    }
    if (character === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
      index += 1;
      continue;
    }
    if (character === delimiter) {
      row.push(field);
      field = "";
      atFieldStart = true;
      index += 1;
      continue;
    }
    if (character === "\r") {
      if (body[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      atFieldStart = true;
      index += 1;
      continue;
    }
    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      atFieldStart = true;
      index += 1;
      continue;
    }
    field += character;
    atFieldStart = false;
    index += 1;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  let width = 0;
  for (const line of rows) width = Math.max(width, line.length);
  return { rows, width };
}

// 裸级别词只认大写（日志惯例），小写只认 [error] 这种带方括号的写法；
// 否则「这个功能没有 error」这类正文会被误判成错误行。
const LOG_LEVEL_UPPER = /(?:^|[\s[=])(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|FATAL|CRITICAL)(?=[\s\]:]|$)/;
const LOG_LEVEL_BRACKET = /\[(trace|debug|info|notice|warn(?:ing)?|error|fatal|critical)\]/i;
const LOG_LEVEL_LOWER_PREFIX = /^(trace|debug|info|notice|warn(?:ing)?|error|fatal|critical):/i;

function findLogLevel(head) {
  const upper = LOG_LEVEL_UPPER.exec(head);
  if (upper !== null) {
    const token = upper[1];
    return { token, index: upper.index + upper[0].indexOf(token), length: token.length };
  }
  const bracket = LOG_LEVEL_BRACKET.exec(head);
  if (bracket !== null) {
    return { token: bracket[1], index: bracket.index, length: bracket[0].length };
  }
  const prefix = LOG_LEVEL_LOWER_PREFIX.exec(head);
  if (prefix !== null) {
    return { token: prefix[1], index: 0, length: prefix[0].length };
  }
  return null;
}

function normalizeLogLevel(token) {
  const value = token.toLowerCase();
  if (value === "warn" || value === "warning") return "warn";
  if (value === "error" || value === "fatal" || value === "critical") return "error";
  if (value === "info" || value === "notice") return "info";
  return "debug";
}

/**
 * 把日志按行切开并识别级别。
 * 级别只看每行前 120 个字符，避免把正文里出现 "error" 的句子误判成错误行。
 */
export function parseLog(text) {
  const source = String(text ?? "").replace(/\r\n/g, "\n");
  const rawLines = source.split("\n");
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") rawLines.pop();

  const counts = { all: 0, error: 0, warn: 0, info: 0, debug: 0, other: 0 };
  const lines = rawLines.map((raw, index) => {
    const head = raw.slice(0, 120);
    const match = findLogLevel(head);
    const level = match === null ? "other" : normalizeLogLevel(match.token);
    let message = raw;
    if (match !== null) {
      message = raw.slice(0, match.index) + raw.slice(match.index + match.length);
      message = message.replace(/^[\s[\]():-]+/, "").replace(/[ \t]{2,}/g, " ").trim();
    }
    counts[level] += 1;
    counts.all += 1;
    return { raw, message, level, lineNumber: index + 1 };
  });
  return { lines, counts };
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

function parseDiffLine(raw, oldLine, newLine) {
  if (raw.startsWith("\\")) return { type: "meta", text: raw, oldLine: null, newLine: null };
  if (raw.startsWith("+")) return { type: "add", text: raw.slice(1), oldLine: null, newLine };
  if (raw.startsWith("-")) return { type: "remove", text: raw.slice(1), oldLine, newLine: null };
  if (raw.startsWith(" ")) return { type: "context", text: raw.slice(1), oldLine, newLine };
  if (raw === "") return { type: "context", text: "", oldLine, newLine };
  return { type: "context", text: raw, oldLine, newLine };
}

/**
 * 解析 unified diff。没有 @@ 头的纯 +/- 文本退化成单个合成 hunk，
 * 这样复制来的简单 diff 也能看，而不是直接报错。
 */
export function parseDiff(text) {
  const source = String(text ?? "").replace(/\r\n/g, "\n");
  const rawLines = source.split("\n");
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") rawLines.pop();

  const hunks = [];
  const stats = { added: 0, removed: 0 };
  let current = null;
  let oldLine = 1;
  let newLine = 1;
  let sawHunk = false;
  let expectFileHeader = false;
  const fallback = { header: "", oldStart: 1, newStart: 1, lines: [] };
  let fallbackOld = 1;
  let fallbackNew = 1;

  const append = (target, parsed, isFallback) => {
    target.lines.push(parsed);
    if (parsed.type === "add") {
      stats.added += 1;
      if (isFallback) fallbackNew += 1;
      else newLine += 1;
    } else if (parsed.type === "remove") {
      stats.removed += 1;
      if (isFallback) fallbackOld += 1;
      else oldLine += 1;
    } else if (parsed.type === "context") {
      if (isFallback) {
        fallbackOld += 1;
        fallbackNew += 1;
      } else {
        oldLine += 1;
        newLine += 1;
      }
    }
  };

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const raw = rawLines[lineIndex];
    const next = rawLines[lineIndex + 1];
    if (raw.startsWith("diff --git ") || raw.startsWith("Index: ")) {
      current = null;
      expectFileHeader = true;
      continue;
    }
    if (expectFileHeader) {
      if (raw.startsWith("--- ") || raw.startsWith("+++ ") || raw.startsWith("index ")) {
        if (raw.startsWith("+++ ")) expectFileHeader = false;
        continue;
      }
      expectFileHeader = false;
    }
    // 没有 diff --git 的多文件 diff 也会用 --- / +++ 开头；成对出现时当文件头跳过。
    if (raw.startsWith("--- ") && next !== undefined && next.startsWith("+++ ")) {
      expectFileHeader = true;
      continue;
    }

    const header = HUNK_HEADER.exec(raw);
    if (header !== null) {
      sawHunk = true;
      current = {
        header: raw,
        oldStart: Number(header[1]),
        newStart: Number(header[3]),
        lines: [],
      };
      hunks.push(current);
      oldLine = current.oldStart;
      newLine = current.newStart;
      continue;
    }

    if (!sawHunk) {
      if (
        raw.startsWith("diff --git ") ||
        raw.startsWith("index ") ||
        raw.startsWith("--- ") ||
        raw.startsWith("+++ ") ||
        raw.startsWith("Index: ")
      ) {
        continue;
      }
      append(fallback, parseDiffLine(raw, fallbackOld, fallbackNew), true);
      continue;
    }

    if (current === null) continue;
    append(current, parseDiffLine(raw, oldLine, newLine), false);
  }

  if (!sawHunk && fallback.lines.length > 0) hunks.push(fallback);
  return { hunks, stats };
}
