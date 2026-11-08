// src/semantic-parsers.js
var SEMANTIC_LANGUAGES = {
  json: "json",
  csv: "csv",
  tsv: "tsv",
  log: "log",
  diff: "diff",
  patch: "diff"
};
function semanticKindFor(lang) {
  return SEMANTIC_LANGUAGES[lang] ?? null;
}
function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(String(text ?? "")) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function parseDelimited(text, delimiter = ",") {
  const source = String(text ?? "");
  const body = source.charCodeAt(0) === 65279 ? source.slice(1) : source;
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
var LOG_LEVEL_UPPER = /(?:^|[\s[=])(TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|FATAL|CRITICAL)(?=[\s\]:]|$)/;
var LOG_LEVEL_BRACKET = /\[(trace|debug|info|notice|warn(?:ing)?|error|fatal|critical)\]/i;
var LOG_LEVEL_LOWER_PREFIX = /^(trace|debug|info|notice|warn(?:ing)?|error|fatal|critical):/i;
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
function parseLog(text) {
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
var HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;
function parseDiffLine(raw, oldLine, newLine) {
  if (raw.startsWith("\\")) return { type: "meta", text: raw, oldLine: null, newLine: null };
  if (raw.startsWith("+")) return { type: "add", text: raw.slice(1), oldLine: null, newLine };
  if (raw.startsWith("-")) return { type: "remove", text: raw.slice(1), oldLine, newLine: null };
  if (raw.startsWith(" ")) return { type: "context", text: raw.slice(1), oldLine, newLine };
  if (raw === "") return { type: "context", text: "", oldLine, newLine };
  return { type: "context", text: raw, oldLine, newLine };
}
function parseDiff(text) {
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
    if (raw.startsWith("--- ") && next !== void 0 && next.startsWith("+++ ")) {
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
        lines: []
      };
      hunks.push(current);
      oldLine = current.oldStart;
      newLine = current.newStart;
      continue;
    }
    if (!sawHunk) {
      if (raw.startsWith("diff --git ") || raw.startsWith("index ") || raw.startsWith("--- ") || raw.startsWith("+++ ") || raw.startsWith("Index: ")) {
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

// src/semantic-views.js
var JSON_PAGE_SIZE = 100;
var TABLE_PAGE_SIZE = 200;
var LOG_PAGE_SIZE = 1e3;
function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className !== void 0 && className !== "") node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}
function button(doc, className, label) {
  const node = element(doc, "button", className, label);
  node.type = "button";
  return node;
}
function format(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
function toolbar(doc) {
  return element(doc, "div", "md-plus-semantic-toolbar");
}
function summary(doc, text) {
  return element(doc, "span", "md-plus-semantic-summary", text);
}
function emptyState(doc, text) {
  return element(doc, "div", "md-plus-semantic-empty", text);
}
function loadMoreButton(doc, label, onClick) {
  const more = button(doc, "md-plus-semantic-btn md-plus-semantic-more", label);
  more.addEventListener("click", onClick);
  return more;
}
function isJsonContainer(value) {
  return value !== null && typeof value === "object";
}
function jsonSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value !== null && typeof value === "object") return Object.keys(value).length;
  return 0;
}
function jsonSummaryText(value) {
  return Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
}
function jsonPrimitive(doc, value) {
  if (value === null) return element(doc, "span", "md-plus-json-null", "null");
  if (typeof value === "string") {
    const text = value.length > 300 ? value.slice(0, 300) + "\u2026" : value;
    const node = element(doc, "span", "md-plus-json-string", JSON.stringify(text));
    node.title = value;
    return node;
  }
  if (typeof value === "number") return element(doc, "span", "md-plus-json-number", String(value));
  if (typeof value === "boolean") return element(doc, "span", "md-plus-json-boolean", String(value));
  return element(doc, "span", "md-plus-json-string", String(value));
}
function jsonNode(doc, key, value, depth, t) {
  const wrapper = element(doc, "div", "md-plus-json-node");
  const row = element(doc, "div", "md-plus-json-row");
  wrapper.appendChild(row);
  const container = isJsonContainer(value);
  const hasChildren = container && jsonSize(value) > 0;
  let toggle = null;
  if (hasChildren) {
    toggle = button(doc, "md-plus-json-toggle", "\u25B8");
    toggle.setAttribute("aria-label", t("semanticJsonExpand"));
    toggle.setAttribute("aria-expanded", "false");
    row.appendChild(toggle);
  }
  if (key !== "") {
    row.appendChild(element(doc, "span", "md-plus-json-key", String(key)));
    row.appendChild(element(doc, "span", "md-plus-json-colon", ":"));
  }
  if (!hasChildren) {
    if (container) row.appendChild(element(doc, "span", "md-plus-json-summary", jsonSummaryText(value)));
    else row.appendChild(jsonPrimitive(doc, value));
    return wrapper;
  }
  row.appendChild(element(doc, "span", "md-plus-json-summary", jsonSummaryText(value)));
  const children = element(doc, "div", "md-plus-json-children");
  wrapper.appendChild(children);
  let expanded = false;
  let renderedCount = 0;
  let moreButton = null;
  const entries = () => Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
  const renderNextPage = () => {
    const list = entries();
    const end = Math.min(renderedCount + JSON_PAGE_SIZE, list.length);
    for (let index = renderedCount; index < end; index += 1) {
      const child = jsonNode(doc, list[index][0], list[index][1], depth + 1, t);
      if (moreButton === null) children.appendChild(child);
      else children.insertBefore(child, moreButton);
    }
    renderedCount = end;
    if (renderedCount >= list.length) {
      moreButton?.remove();
      moreButton = null;
      return;
    }
    const remaining = list.length - renderedCount;
    if (moreButton === null) {
      moreButton = loadMoreButton(doc, t("semanticLoadMore") + " (" + remaining + ")", () => renderNextPage());
      children.appendChild(moreButton);
    } else {
      moreButton.textContent = t("semanticLoadMore") + " (" + remaining + ")";
    }
  };
  const setExpanded = (next) => {
    expanded = next;
    toggle.textContent = expanded ? "\u25BE" : "\u25B8";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", t(expanded ? "semanticJsonCollapse" : "semanticJsonExpand"));
    children.style.display = expanded ? "block" : "none";
    if (expanded && renderedCount === 0) renderNextPage();
  };
  toggle.addEventListener("click", () => setExpanded(!expanded));
  if (depth < 2) setExpanded(true);
  else setExpanded(false);
  return wrapper;
}
function buildJsonView(doc, text, t) {
  const parsed = parseJson(text);
  if (!parsed.ok) throw new Error(t("semanticJsonInvalid") + ": " + parsed.error);
  const root = element(doc, "div", "md-plus-semantic md-plus-semantic-json");
  const head = toolbar(doc);
  const value = parsed.value;
  let label = "JSON";
  if (isJsonContainer(value)) {
    const array = Array.isArray(value);
    label += " \xB7 " + (array ? t("semanticJsonArray") : t("semanticJsonObject"));
    label += " \xB7 " + format(t(array ? "semanticJsonItems" : "semanticJsonKeys"), { count: jsonSize(value) });
  }
  head.appendChild(summary(doc, label));
  root.appendChild(head);
  const tree = element(doc, "div", "md-plus-semantic-json-tree");
  tree.setAttribute("role", "tree");
  tree.appendChild(jsonNode(doc, "", value, 0, t));
  root.appendChild(tree);
  return root;
}
function isNumericText(value) {
  return value !== "" && /^-?(?:\d+|\d*\.\d+)$/.test(value.trim());
}
function numericColumns(rows, width) {
  const result = [];
  for (let column = 0; column < width; column += 1) {
    let seen = 0;
    let numeric = true;
    for (let row = 1; row < rows.length; row += 1) {
      const value = (rows[row][column] ?? "").trim();
      if (value === "") continue;
      seen += 1;
      if (!isNumericText(value)) {
        numeric = false;
        break;
      }
    }
    result.push(seen > 0 && numeric);
  }
  return result;
}
function buildTableView(doc, kind, text, t) {
  const delimiter = kind === "tsv" ? "	" : ",";
  const { rows, width } = parseDelimited(text, delimiter);
  const root = element(doc, "div", "md-plus-semantic md-plus-semantic-table");
  const head = toolbar(doc);
  head.appendChild(
    summary(doc, format(t("semanticTableSummary"), { rows: Math.max(0, rows.length - 1), cols: width }))
  );
  root.appendChild(head);
  const body = element(doc, "div", "md-plus-semantic-table-body");
  root.appendChild(body);
  if (rows.length === 0) {
    body.appendChild(emptyState(doc, t("semanticEmpty")));
    return root;
  }
  const wrap = element(doc, "figure", "md-plus-semantic-table-wrap");
  const table = doc.createElement("table");
  const thead = doc.createElement("thead");
  const headerRow = doc.createElement("tr");
  for (let column = 0; column < width; column += 1) {
    const cell = doc.createElement("th");
    cell.textContent = rows[0][column] ?? "";
    headerRow.appendChild(cell);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = doc.createElement("tbody");
  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);
  const numeric = numericColumns(rows, width);
  let rendered = 1;
  let moreButton = null;
  const renderNextPage = () => {
    const end = Math.min(rendered + TABLE_PAGE_SIZE, rows.length);
    for (let index = rendered; index < end; index += 1) {
      const row = doc.createElement("tr");
      for (let column = 0; column < width; column += 1) {
        const cell = doc.createElement("td");
        cell.textContent = rows[index][column] ?? "";
        if (numeric[column]) cell.className = "md-plus-semantic-number";
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    }
    rendered = end;
    if (rendered >= rows.length) {
      moreButton?.remove();
      moreButton = null;
      return;
    }
    if (moreButton === null) {
      moreButton = loadMoreButton(
        doc,
        t("semanticLoadMore") + " (" + (rows.length - rendered) + ")",
        () => renderNextPage()
      );
      body.appendChild(moreButton);
    } else {
      moreButton.textContent = t("semanticLoadMore") + " (" + (rows.length - rendered) + ")";
    }
  };
  renderNextPage();
  return root;
}
var LOG_FILTERS = ["all", "error", "warn", "info", "debug"];
function logFilterLabel(t, filter) {
  if (filter === "all") return t("semanticLogAll");
  if (filter === "error") return t("semanticLogError");
  if (filter === "warn") return t("semanticLogWarn");
  if (filter === "info") return t("semanticLogInfo");
  if (filter === "debug") return t("semanticLogDebug");
  return filter;
}
function logBadgeLabel(t, level) {
  if (level === "error") return t("semanticLogError");
  if (level === "warn") return t("semanticLogWarn");
  if (level === "info") return t("semanticLogInfo");
  if (level === "debug") return t("semanticLogDebug");
  return t("semanticLogOther");
}
function buildLogView(doc, text, t) {
  const { lines, counts } = parseLog(text);
  const root = element(doc, "div", "md-plus-semantic md-plus-semantic-log");
  const head = toolbar(doc);
  head.appendChild(summary(doc, format(t("semanticLogSummary"), { count: lines.length })));
  const filters = element(doc, "span", "md-plus-semantic-actions");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", t("semanticLogFilter"));
  const filterButtons = /* @__PURE__ */ new Map();
  const body = element(doc, "div", "md-plus-semantic-log-body");
  let active = "all";
  let rendered = 0;
  let moreButton = null;
  const visibleLines = () => active === "all" ? lines : lines.filter((line) => line.level === active);
  const appendLines = () => {
    const list = visibleLines();
    const end = Math.min(rendered + LOG_PAGE_SIZE, list.length);
    for (let index = rendered; index < end; index += 1) {
      const line = list[index];
      const row = element(doc, "div", "md-plus-log-line md-plus-log-line-" + line.level);
      row.setAttribute("data-level", line.level);
      const badge = element(doc, "span", "md-plus-log-badge", line.level === "other" ? "" : logBadgeLabel(t, line.level));
      const number = element(doc, "span", "md-plus-log-number", String(line.lineNumber));
      const message = element(doc, "span", "md-plus-log-text", line.message);
      row.appendChild(number);
      row.appendChild(badge);
      row.appendChild(message);
      body.appendChild(row);
    }
    rendered = end;
    if (rendered >= list.length) {
      moreButton?.remove();
      moreButton = null;
      return;
    }
    if (moreButton === null) {
      moreButton = loadMoreButton(doc, t("semanticLoadMore") + " (" + (list.length - rendered) + ")", () => appendLines());
      body.appendChild(moreButton);
    } else {
      moreButton.textContent = t("semanticLoadMore") + " (" + (list.length - rendered) + ")";
    }
  };
  const refresh = () => {
    for (const [filter, filterButton] of filterButtons) {
      filterButton.classList.toggle("md-plus-semantic-btn-active", filter === active);
      filterButton.setAttribute("aria-pressed", String(filter === active));
    }
    body.textContent = "";
    rendered = 0;
    moreButton = null;
    if (visibleLines().length === 0) {
      body.appendChild(emptyState(doc, t("semanticEmpty")));
      return;
    }
    appendLines();
  };
  for (const filter of LOG_FILTERS) {
    const count = filter === "all" ? counts.all : counts[filter];
    const filterButton = button(
      doc,
      "md-plus-semantic-btn",
      logFilterLabel(t, filter) + " " + count
    );
    filterButton.addEventListener("click", () => {
      active = filter;
      refresh();
    });
    filterButtons.set(filter, filterButton);
    filters.appendChild(filterButton);
  }
  head.appendChild(filters);
  root.appendChild(head);
  root.appendChild(body);
  refresh();
  return root;
}
function diffNumber(doc, value) {
  return element(doc, "span", "md-plus-diff-num", value === null || value === void 0 ? "" : String(value));
}
function diffSign(doc, line) {
  const sign = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
  return element(doc, "span", "md-plus-diff-sign", sign);
}
function diffText(doc, line) {
  return element(doc, "span", "md-plus-diff-text", line.text === "" ? " " : line.text);
}
function appendUnifiedHunk(doc, body, hunk) {
  const block = element(doc, "div", "md-plus-diff-hunk");
  if (hunk.header !== "") block.appendChild(element(doc, "div", "md-plus-diff-hunk-header", hunk.header));
  for (const line of hunk.lines) {
    const row = element(doc, "div", "md-plus-diff-line md-plus-diff-line-" + line.type);
    row.appendChild(diffNumber(doc, line.oldLine));
    row.appendChild(diffNumber(doc, line.newLine));
    row.appendChild(diffSign(doc, line));
    row.appendChild(diffText(doc, line));
    block.appendChild(row);
  }
  body.appendChild(block);
}
function splitCell(doc, line, side) {
  const cell = element(doc, "div", "md-plus-diff-split-cell");
  if (line === null) {
    cell.classList.add("md-plus-diff-empty");
    return cell;
  }
  cell.classList.add("md-plus-diff-line-" + line.type);
  cell.appendChild(diffNumber(doc, side === "right" ? line.newLine : line.oldLine));
  cell.appendChild(diffSign(doc, line));
  cell.appendChild(diffText(doc, line));
  return cell;
}
function appendSplitHunk(doc, body, hunk) {
  const block = element(doc, "div", "md-plus-diff-hunk md-plus-diff-hunk-split");
  if (hunk.header !== "") block.appendChild(element(doc, "div", "md-plus-diff-hunk-header", hunk.header));
  let index = 0;
  while (index < hunk.lines.length) {
    const line = hunk.lines[index];
    if (line.type === "context" || line.type === "meta") {
      const row = element(doc, "div", "md-plus-diff-split-row");
      if (line.type === "meta") {
        const meta = element(doc, "div", "md-plus-diff-meta", line.text);
        meta.style.gridColumn = "1 / -1";
        row.appendChild(meta);
      } else {
        row.appendChild(splitCell(doc, line, "left"));
        row.appendChild(splitCell(doc, line, "right"));
      }
      block.appendChild(row);
      index += 1;
      continue;
    }
    const removes = [];
    const adds = [];
    while (index < hunk.lines.length) {
      const next = hunk.lines[index];
      if (next.type === "remove") {
        removes.push(next);
        index += 1;
        continue;
      }
      if (next.type === "add") {
        adds.push(next);
        index += 1;
        continue;
      }
      break;
    }
    const height = Math.max(removes.length, adds.length);
    for (let offset = 0; offset < height; offset += 1) {
      const row = element(doc, "div", "md-plus-diff-split-row");
      row.appendChild(splitCell(doc, removes[offset] ?? null, "left"));
      row.appendChild(splitCell(doc, adds[offset] ?? null, "right"));
      block.appendChild(row);
    }
  }
  body.appendChild(block);
}
function buildDiffView(doc, text, t) {
  const { hunks, stats } = parseDiff(text);
  const root = element(doc, "div", "md-plus-semantic md-plus-semantic-diff");
  const head = toolbar(doc);
  const stat = element(doc, "span", "md-plus-semantic-summary md-plus-diff-stat");
  stat.appendChild(element(doc, "span", "md-plus-diff-added", "+" + stats.added));
  stat.appendChild(doc.createTextNode(" "));
  stat.appendChild(element(doc, "span", "md-plus-diff-removed", "\u2212" + stats.removed));
  head.appendChild(stat);
  const actions = element(doc, "span", "md-plus-semantic-actions");
  const unifiedButton = button(doc, "md-plus-semantic-btn", t("semanticDiffUnified"));
  const splitButton = button(doc, "md-plus-semantic-btn", t("semanticDiffSplit"));
  actions.appendChild(unifiedButton);
  actions.appendChild(splitButton);
  head.appendChild(actions);
  root.appendChild(head);
  const body = element(doc, "div", "md-plus-semantic-diff-body");
  root.appendChild(body);
  let mode = "unified";
  const refresh = () => {
    unifiedButton.classList.toggle("md-plus-semantic-btn-active", mode === "unified");
    splitButton.classList.toggle("md-plus-semantic-btn-active", mode === "split");
    unifiedButton.setAttribute("aria-pressed", String(mode === "unified"));
    splitButton.setAttribute("aria-pressed", String(mode === "split"));
    body.textContent = "";
    if (hunks.length === 0) {
      body.appendChild(emptyState(doc, t("semanticDiffEmpty")));
      return;
    }
    for (const hunk of hunks) {
      if (mode === "unified") appendUnifiedHunk(doc, body, hunk);
      else appendSplitHunk(doc, body, hunk);
    }
  };
  unifiedButton.addEventListener("click", () => {
    mode = "unified";
    refresh();
  });
  splitButton.addEventListener("click", () => {
    mode = "split";
    refresh();
  });
  refresh();
  return root;
}
function buildSemanticView(doc, kind, text, t) {
  if (kind === "json") return buildJsonView(doc, text, t);
  if (kind === "csv" || kind === "tsv") return buildTableView(doc, kind, text, t);
  if (kind === "log") return buildLogView(doc, text, t);
  if (kind === "diff") return buildDiffView(doc, text, t);
  throw new Error("unsupported semantic view: " + kind);
}

// src/client.js
window.__ModuleLoader__.load({
  id: "dsh-md-plus",
  factory: (require2) => {
    var module = { exports: {} };
    var exports = module.exports;
    var HL_URL = "/dsh-md-plus/highlight-runtime.js";
    var MMD_URL = "/dsh-md-plus/mermaid-runtime.js";
    var HL_GLOBAL = "__DSH_MD_PLUS_HL__";
    var MMD_GLOBAL = "__DSH_MD_PLUS_MMD__";
    var BLOCK = ".md-code-block";
    var CONTENT = "[data-code-block-content]";
    var BANNER = "[data-code-block-banner]";
    var HOST_CLASS = "md-plus-hl";
    var TOOL_CLASS = "md-plus-tool";
    var TOGGLE_CLASS = "md-plus-toggle";
    var MMD_CLASS = "md-plus-mmd";
    var BTN_CLASS = "md-plus-btn";
    var ZOOM_IN_CLASS = "md-plus-zoom-in";
    var ZOOM_OUT_CLASS = "md-plus-zoom-out";
    var COPY_SOURCE_CLASS = "md-plus-copy-source";
    var DOWNLOAD_CLASS = "md-plus-download";
    var SEMANTIC_CLASS = "md-plus-semantic";
    var SEMANTIC_TOGGLE_CLASS = "md-plus-semantic-toggle";
    var SEMANTIC_ATTR = "data-md-plus-semantic";
    var SEMANTIC_MANUAL_ATTR = "data-md-plus-semantic-manual";
    var SEMANTIC_MAX_SOURCE = 512 * 1024;
    var ZOOM_ATTR = "data-md-plus-zoom";
    var ZOOM_STEP = 1.25;
    var ZOOM_MAX = 6;
    var ZOOM_MIN_INLINE = 1;
    var ZOOM_MIN_MODAL = 0.1;
    var ZOOM_MIN_EPSILON = 1e-3;
    var EXPAND_CLASS = "md-plus-expand";
    var THEME_CLASS = "md-plus-theme";
    var RETRY_CLASS = "md-plus-retry";
    var THEME_KEY = "dsh-md-plus-mermaid-theme";
    var THEME_ORDER = ["blue", "neutral", "forest", "contrast"];
    var THEME_LABELS = {
      zh: { blue: "\u84DD\u8272", neutral: "\u4E2D\u6027", forest: "\u68EE\u6797", contrast: "\u9AD8\u5BF9\u6BD4" },
      en: { blue: "Blue", neutral: "Neutral", forest: "Forest", contrast: "High contrast" }
    };
    function detectLang() {
      var declared = (document.documentElement.lang || "").toLowerCase();
      if (declared.startsWith("zh")) return "zh";
      if (declared.startsWith("en")) return "en";
      var nav = (window.navigator.language || "").toLowerCase();
      return nav.startsWith("zh") ? "zh" : "en";
    }
    var TEXT = {
      zh: {
        wrapTitle: "\u4E0D\u6362\u884C\uFF08\u6A2A\u5411\u6EDA\u52A8\uFF09",
        wrapAria: "\u5207\u6362\u4EE3\u7801\u6362\u884C",
        zoomOut: "\u7F29\u5C0F",
        zoomOutAria: "\u7F29\u5C0F\u6D41\u7A0B\u56FE",
        zoomIn: "\u653E\u5927",
        zoomInAria: "\u653E\u5927\u6D41\u7A0B\u56FE",
        toggle: "\u5207\u6362\u56FE\u5F62 / \u4EE3\u7801",
        toggleAria: "\u5207\u6362\u56FE\u5F62\u4E0E\u4EE3\u7801",
        fullscreen: "\u5168\u5C4F\u67E5\u770B",
        fullscreenAria: "\u5168\u5C4F\u67E5\u770B\u6D41\u7A0B\u56FE",
        copySource: "\u590D\u5236\u56FE\u6E90",
        copySourceAria: "\u590D\u5236 Mermaid \u56FE\u6E90",
        downloadCode: "\u4E0B\u8F7D\u4EE3\u7801",
        downloadCodeAria: "\u4E0B\u8F7D\u4EE3\u7801\u4E3A\u6587\u4EF6",
        semanticToggle: "\u5207\u6362\u8BED\u4E49\u89C6\u56FE / \u6E90\u7801",
        semanticToggleAria: "\u5207\u6362\u4EE3\u7801\u5757\u7684\u8BED\u4E49\u89C6\u56FE\u4E0E\u6E90\u7801",
        semanticRenderFailed: "\u65E0\u6CD5\u89E3\u6790\uFF0C\u5DF2\u663E\u793A\u6E90\u7801",
        semanticTooLarge: "\u5185\u5BB9\u8FC7\u5927\uFF0C\u5EFA\u8BAE\u76F4\u63A5\u67E5\u770B\u6E90\u7801",
        semanticJsonInvalid: "JSON \u89E3\u6790\u5931\u8D25",
        semanticJsonObject: "\u5BF9\u8C61",
        semanticJsonArray: "\u6570\u7EC4",
        semanticJsonKeys: "{count} \u4E2A\u952E",
        semanticJsonItems: "{count} \u9879",
        semanticJsonExpand: "\u5C55\u5F00",
        semanticJsonCollapse: "\u6536\u8D77",
        semanticLoadMore: "\u663E\u793A\u66F4\u591A",
        semanticEmpty: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5185\u5BB9",
        semanticTableSummary: "{rows} \u884C \xD7 {cols} \u5217",
        semanticLogSummary: "\u65E5\u5FD7 \xB7 {count} \u884C",
        semanticLogFilter: "\u65E5\u5FD7\u7EA7\u522B\u7B5B\u9009",
        semanticLogAll: "\u5168\u90E8",
        semanticLogError: "\u9519\u8BEF",
        semanticLogWarn: "\u8B66\u544A",
        semanticLogInfo: "\u4FE1\u606F",
        semanticLogDebug: "\u8C03\u8BD5",
        semanticLogOther: "\u5176\u4ED6",
        semanticDiffUnified: "\u5355\u680F",
        semanticDiffSplit: "\u5E76\u6392",
        semanticDiffEmpty: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5DEE\u5F02",
        theme: "\u5207\u6362 Mermaid \u914D\u8272",
        themeAria: "\u5207\u6362 Mermaid \u914D\u8272",
        themePrefix: "\u914D\u8272\uFF1A",
        foldOpen: "\u5C55\u5F00",
        foldClose: "\u6536\u8D77",
        retry: "\u91CD\u8BD5",
        retryAria: "\u91CD\u65B0\u6E32\u67D3\u56FE\u8868",
        renderFailed: "mermaid \u6E32\u67D3\u5931\u8D25\uFF1A",
        diagram: "\u6D41\u7A0B\u56FE",
        diagramAria: "\u6D41\u7A0B\u56FE\u5168\u5C4F\u67E5\u770B",
        fit: "\u9002\u5E94\u6574\u56FE",
        downloadSvg: "\u4E0B\u8F7D SVG",
        downloadPng: "\u4E0B\u8F7D PNG",
        exportFailed: "\u5BFC\u51FA\u5931\u8D25\uFF0C\u8BF7\u6539\u7528 SVG",
        close: "\u5173\u95ED",
        tableCsv: "CSV",
        tableTsv: "TSV",
        tableMd: "Markdown",
        tableHtml: "\u5BCC\u6587\u672C",
        copyCsvTitle: "\u590D\u5236\u8868\u683C\u4E3A CSV",
        copyTsvTitle: "\u590D\u5236\u8868\u683C\u4E3A TSV",
        copyMdTitle: "\u590D\u5236\u8868\u683C\u4E3A Markdown",
        copyHtmlTitle: "\u590D\u5236\u8868\u683C\u4E3A\u5BCC\u6587\u672C",
        copied: "\u5DF2\u590D\u5236",
        copyFailed: "\u590D\u5236\u5931\u8D25",
        imageViewer: "\u56FE\u7247\u9884\u89C8",
        imageClose: "\u5173\u95ED\u56FE\u7247\u9884\u89C8",
        settingsOpen: "\u6253\u5F00 Markdown+ \u8BBE\u7F6E",
        settingsTitle: "Markdown+ \u8BBE\u7F6E",
        settingsTheme: "Mermaid \u914D\u8272",
        settingsFontSize: "\u4EE3\u7801\u5B57\u53F7",
        settingsFontSizeHint: "\u7559\u7A7A\u6216 0 \u8868\u793A\u8DDF\u968F\u5BBF\u4E3B",
        settingsView: "\u56FE\u8868\u9ED8\u8BA4\u89C6\u56FE",
        settingsViewDiagram: "\u56FE\u5F62",
        settingsViewCode: "\u4EE3\u7801",
        settingsSemantic: "\u8BED\u4E49\u89C6\u56FE\u9ED8\u8BA4\u663E\u793A",
        settingsSemanticSource: "\u6E90\u7801\u4F18\u5148",
        settingsSemanticView: "\u8BED\u4E49\u89C6\u56FE\u4F18\u5148",
        settingsSemanticHint: "\u652F\u6301 JSON / CSV / TSV / \u65E5\u5FD7 / diff \u4EE3\u7801\u5757",
        settingsFold: "\u957F\u5185\u5BB9\u6298\u53E0\u9608\u503C",
        settingsFoldGroup: "\u6298\u53E0\u5185\u5BB9",
        settingsFileGroup: "\u8BBE\u7F6E\u6587\u4EF6",
        settingsFoldCode: "\u4EE3\u7801\u5757",
        settingsFoldTable: "\u8868\u683C",
        settingsFoldDiagram: "\u56FE\u8868",
        settingsFoldCodeHint: "\u5185\u5BB9\u9AD8\u5EA6\u8D85\u8FC7\u6B64\u503C\u540E\u6298\u53E0",
        settingsFoldTableHint: "\u8868\u683C\u9AD8\u5EA6\u8D85\u8FC7\u6B64\u503C\u540E\u6298\u53E0",
        settingsFoldDiagramHint: "\u56FE\u5F62\u9AD8\u5EA6\u8D85\u8FC7\u6B64\u503C\u540E\u6298\u53E0",
        settingsFoldHint: "\u5355\u4F4D px\uFF0C0 \u8868\u793A\u4E0D\u6298\u53E0",
        settingsFreezeRows: "\u51BB\u7ED3\u884C\u6570",
        settingsFreezeRowsHint: "\u9ED8\u8BA4\u51BB\u7ED3 1 \u884C\u8868\u5934\uFF0C0 \u8868\u793A\u4E0D\u51BB\u7ED3",
        settingsFreezeCols: "\u51BB\u7ED3\u5217\u6570",
        settingsFreezeColsHint: "\u9ED8\u8BA4 0 \u5217\uFF0C\u6309\u9700\u6307\u5B9A",
        foldExpandAll: "\u5168\u90E8\u5C55\u5F00",
        foldCollapseAll: "\u5168\u90E8\u6536\u8D77",
        settingsExport: "\u5BFC\u51FA\u8BBE\u7F6E",
        settingsImport: "\u5BFC\u5165\u8BBE\u7F6E",
        settingsImportFailed: "\u5BFC\u5165\u5931\u8D25",
        settingsSave: "\u4FDD\u5B58",
        settingsReset: "\u6062\u590D\u9ED8\u8BA4",
        settingsClose: "\u5173\u95ED"
      },
      en: {
        wrapTitle: "No wrap (horizontal scroll)",
        wrapAria: "Toggle code wrapping",
        zoomOut: "Zoom out",
        zoomOutAria: "Zoom out diagram",
        zoomIn: "Zoom in",
        zoomInAria: "Zoom in diagram",
        toggle: "Switch diagram / code",
        toggleAria: "Switch diagram and code",
        fullscreen: "Fullscreen",
        fullscreenAria: "View diagram fullscreen",
        copySource: "Copy source",
        copySourceAria: "Copy Mermaid source",
        downloadCode: "Download code",
        downloadCodeAria: "Download code as a file",
        semanticToggle: "Switch semantic view / source",
        semanticToggleAria: "Switch the code block between semantic view and source",
        semanticRenderFailed: "Could not parse; showing source",
        semanticTooLarge: "Content is too large; view the source instead",
        semanticJsonInvalid: "Failed to parse JSON",
        semanticJsonObject: "Object",
        semanticJsonArray: "Array",
        semanticJsonKeys: "{count} keys",
        semanticJsonItems: "{count} items",
        semanticJsonExpand: "Expand",
        semanticJsonCollapse: "Collapse",
        semanticLoadMore: "Show more",
        semanticEmpty: "Nothing to display",
        semanticTableSummary: "{rows} rows \xD7 {cols} columns",
        semanticLogSummary: "Log \xB7 {count} lines",
        semanticLogFilter: "Filter log levels",
        semanticLogAll: "All",
        semanticLogError: "Error",
        semanticLogWarn: "Warn",
        semanticLogInfo: "Info",
        semanticLogDebug: "Debug",
        semanticLogOther: "Other",
        semanticDiffUnified: "Unified",
        semanticDiffSplit: "Split",
        semanticDiffEmpty: "No diff to display",
        theme: "Change Mermaid theme",
        themeAria: "Change Mermaid theme",
        themePrefix: "Theme: ",
        foldOpen: "Expand",
        foldClose: "Collapse",
        retry: "Retry",
        retryAria: "Retry diagram",
        renderFailed: "Mermaid render failed: ",
        diagram: "Diagram",
        diagramAria: "Diagram fullscreen viewer",
        fit: "Fit",
        downloadSvg: "Download SVG",
        downloadPng: "Download PNG",
        exportFailed: "Export failed; try SVG instead",
        close: "Close",
        tableCsv: "CSV",
        tableTsv: "TSV",
        tableMd: "Markdown",
        tableHtml: "Rich",
        copyCsvTitle: "Copy table as CSV",
        copyTsvTitle: "Copy table as TSV",
        copyMdTitle: "Copy table as Markdown",
        copyHtmlTitle: "Copy table as rich text",
        copied: "Copied",
        copyFailed: "Copy failed",
        imageViewer: "Image preview",
        imageClose: "Close image preview",
        settingsOpen: "Open Markdown+ settings",
        settingsTitle: "Markdown+ settings",
        settingsTheme: "Mermaid theme",
        settingsFontSize: "Code font size",
        settingsFontSizeHint: "Leave empty or 0 to follow the host",
        settingsView: "Default diagram view",
        settingsViewDiagram: "Diagram",
        settingsViewCode: "Code",
        settingsSemantic: "Default semantic view",
        settingsSemanticSource: "Source first",
        settingsSemanticView: "Semantic view first",
        settingsSemanticHint: "For JSON / CSV / TSV / log / diff code blocks",
        settingsFold: "Fold thresholds",
        settingsFoldGroup: "Fold content",
        settingsFileGroup: "Settings file",
        settingsFoldCode: "Code block",
        settingsFoldTable: "Table",
        settingsFoldDiagram: "Diagram",
        settingsFoldCodeHint: "Fold when the block is taller than this",
        settingsFoldTableHint: "Fold when the table is taller than this",
        settingsFoldDiagramHint: "Fold when the diagram is taller than this",
        settingsFoldHint: "Pixels; 0 disables folding",
        settingsFreezeRows: "Freeze rows",
        settingsFreezeRowsHint: "Defaults to 1 header row; 0 disables freezing",
        settingsFreezeCols: "Freeze columns",
        settingsFreezeColsHint: "Defaults to 0 columns; set as needed",
        foldExpandAll: "Expand all",
        foldCollapseAll: "Collapse all",
        settingsExport: "Export settings",
        settingsImport: "Import settings",
        settingsImportFailed: "Import failed",
        settingsSave: "Save",
        settingsReset: "Reset to defaults",
        settingsClose: "Close"
      }
    };
    function t(key) {
      var lang = detectLang();
      return TEXT[lang][key] ?? TEXT.en[key] ?? key;
    }
    var MODAL_CLASS = "md-plus-mmd-modal";
    var DONE_ATTR = "data-md-plus";
    var WRAP_ATTR = "data-md-plus-wrap";
    var MMD_ATTR = "data-md-plus-mmd";
    var FOLD_ATTR = "data-md-plus-fold";
    var FOLD_CLASS = "md-plus-fold";
    var FOLD_BTN_CLASS = "md-plus-fold-toggle";
    var FOLD_LIMITS = { code: 480, table: 520, diagram: 720 };
    var TABLE_TOOLS_CLASS = "md-plus-table-tools";
    var TABLE_DONE_ATTR = "data-md-plus-table";
    var FREEZE_ROW_CLASS = "md-plus-freeze-row";
    var FREEZE_COL_CLASS = "md-plus-freeze-col";
    var FREEZE_CROSS_CLASS = "md-plus-freeze-cross";
    var IMG_MODAL_CLASS = "md-plus-img-modal";
    var NATIVE_IMAGE_BUTTON = 'button[class*="imageButton"]';
    var SETTINGS_BTN_CLASS = "md-plus-settings-btn";
    var SETTINGS_MODAL_CLASS = "md-plus-settings-modal";
    var SETTINGS_KEY = "dsh-md-plus-settings";
    var DEFAULT_SETTINGS = {
      codeFontSize: 0,
      diagramView: "diagram",
      semanticDefaultView: "source",
      foldCode: FOLD_LIMITS.code,
      foldTable: FOLD_LIMITS.table,
      foldDiagram: FOLD_LIMITS.diagram,
      freezeRows: 1,
      freezeCols: 0
    };
    var STYLE_ATTR = "data-md-plus-style";
    var RUNTIME_ATTR = "data-md-plus-runtime";
    var DEBOUNCE_MS = 160;
    var memorySettings = null;
    var memoryTheme = null;
    var settingsCache = null;
    var themeCache = null;
    function readSettings() {
      if (settingsCache !== null) return { ...settingsCache };
      var settings = { ...DEFAULT_SETTINGS };
      try {
        var raw = window.localStorage.getItem(SETTINGS_KEY);
        var saved = raw === null ? null : JSON.parse(raw);
        if (saved !== null && typeof saved === "object") {
          var size = Number(saved.codeFontSize);
          if (Number.isFinite(size) && size >= 10 && size <= 20) settings.codeFontSize = Math.round(size);
          if (saved.diagramView === "code" || saved.diagramView === "diagram") {
            settings.diagramView = saved.diagramView;
          }
          if (saved.semanticDefaultView === "source" || saved.semanticDefaultView === "semantic") {
            settings.semanticDefaultView = saved.semanticDefaultView;
          }
          for (var key of ["foldCode", "foldTable", "foldDiagram"]) {
            var value = Number(saved[key]);
            if (Number.isFinite(value) && value >= 0) settings[key] = Math.min(4e3, Math.round(value));
          }
          for (var freezeKey of ["freezeRows", "freezeCols"]) {
            var freezeValue = Number(saved[freezeKey]);
            if (saved[freezeKey] !== void 0 && Number.isFinite(freezeValue) && freezeValue >= 0) {
              settings[freezeKey] = Math.min(5, Math.round(freezeValue));
            }
          }
        }
        memorySettings = { ...settings };
      } catch {
        if (memorySettings !== null) settings = { ...DEFAULT_SETTINGS, ...memorySettings };
      }
      settingsCache = { ...settings };
      return { ...settingsCache };
    }
    function saveSettings(next) {
      memorySettings = { ...next };
      settingsCache = { ...next };
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
      }
    }
    function foldLimit(kind) {
      var settings = readSettings();
      if (kind === "code") return settings.foldCode;
      if (kind === "table") return settings.foldTable;
      return settings.foldDiagram;
    }
    function applyCodeFontSize() {
      var size = readSettings().codeFontSize;
      if (size > 0) {
        document.documentElement.style.setProperty("--md-plus-code-font-size", size + "px");
        document.documentElement.style.setProperty("--md-plus-code-line-height", Math.round(size * 1.6) + "px");
      } else {
        document.documentElement.style.removeProperty("--md-plus-code-font-size");
        document.documentElement.style.removeProperty("--md-plus-code-line-height");
      }
    }
    var DSH_LANGS = /* @__PURE__ */ new Set([
      "typescript",
      "ts",
      "tsx",
      "javascript",
      "js",
      "jsx",
      "shellscript",
      "bash",
      "sh",
      "shell",
      "zsh",
      "json",
      "jsonc",
      "py",
      "python",
      "rb",
      "ruby",
      "go",
      "rs",
      "rust",
      "java",
      "c",
      "cpp",
      "cs",
      "csharp",
      "kotlin",
      "swift",
      "php",
      "yaml",
      "yml",
      "toml",
      "ini",
      "md",
      "markdown",
      "mdx",
      "html",
      "css",
      "scss",
      "less",
      "sql",
      "xml",
      "lua",
      "bat",
      "batch",
      "powershell",
      "ps1",
      "ps",
      "fish",
      "properties",
      "dotenv",
      "env",
      "log",
      "csv",
      "diff",
      "patch",
      "http",
      "rst",
      "latex",
      "tex",
      "bibtex",
      "bib",
      "asciidoc",
      "adoc",
      "r",
      "julia",
      "jl",
      "dart",
      "scala",
      "clojure",
      "clj",
      "erlang",
      "erl",
      "elixir",
      "ex",
      "exs",
      "haskell",
      "hs",
      "fsharp",
      "fs",
      "fsi",
      "fsx",
      "vb",
      "vbnet",
      "perl",
      "pl",
      "pm",
      "verilog",
      "v",
      "system-verilog",
      "systemverilog",
      "sv",
      "svh",
      "graphql",
      "gql",
      "proto",
      "protobuf",
      "hcl",
      "tf",
      "tfvars",
      "nix",
      "vue",
      "svelte",
      "make",
      "makefile",
      "mk",
      "cmake",
      "groovy",
      "gradle"
    ]);
    var MMD_LANGS = /* @__PURE__ */ new Set(["mermaid", "mermaidjs", "mmd"]);
    var MMD_FLOW = /^\s*(flowchart(?:-elk)?|graph)(?:\s+(?:TD|TB|BT|RL|LR))?\s*;?\s*$/i;
    var MMD_PIE = /^\s*pie(?:\s+(?:showData|title)\b.*)?\s*;?\s*$/i;
    var MMD_GIT = /^\s*gitGraph(?:\s+(?:LR|TB|BT|RL))?:?\s*;?\s*$/i;
    var MMD_SINGLE = /^\s*(sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|mindmap|timeline|quadrantChart|xychart-beta|sankey-beta|block-beta|packet-beta|architecture-beta|usecase-beta|agentflow-beta|C4Context|requirementDiagram|kanban|radar-beta|treemap(?:-beta)?|venn-beta|ishikawa(?:-beta)?|wardley-beta|cynefin-beta|treeView-beta|info|eventmodeling|swimlane-beta|railroad-beta|railroad-abnf-beta|railroad-ebnf-beta|railroad-peg-beta)\s*;?\s*$/i;
    function icon(paths) {
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" + paths + "</svg>";
      return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }
    var ICON_CODE = icon(
      "<path d='M8.5 7 3.5 12l5 5'/><path d='M15.5 7l5 5-5 5'/><path d='M13.6 5.2 10.4 18.8'/>"
    );
    var ICON_COPY = icon(
      "<rect x='9' y='9' width='12' height='12' rx='2.5'/><path d='M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6'/>"
    );
    var ICON_DOWNLOAD = icon(
      "<path d='M12 3v12'/><path d='m7 10 5 5 5-5'/><path d='M5 21h14'/>"
    );
    var ICON_SEMANTIC = icon(
      "<path d='M9 6h11'/><path d='M9 12h11'/><path d='M9 18h11'/><path d='M4 6h.01'/><path d='M4 12h.01'/><path d='M4 18h.01'/>"
    );
    var ICON_NOWRAP = icon(
      "<path d='M3 12h12.5'/><path d='M12.5 8.5 16.5 12l-4 3.5'/><path d='M20 6v12'/>"
    );
    var ICON_DIAGRAM = icon(
      "<rect x='3' y='3' width='8' height='5.5' rx='1.8'/><rect x='13' y='15.5' width='8' height='5.5' rx='1.8'/><path d='M7 8.5v5a2.5 2.5 0 0 0 2.5 2.5H13'/><path d='M10.5 13.5 13 16l-2.5 2.5'/>"
    );
    var ICON_ZOOM_IN = icon(
      "<circle cx='10.5' cy='10.5' r='7'/><path d='M20.5 20.5 15.6 15.6'/><path d='M7.5 10.5h6'/><path d='M10.5 7.5v6'/>"
    );
    var ICON_ZOOM_OUT = icon(
      "<circle cx='10.5' cy='10.5' r='7'/><path d='M20.5 20.5 15.6 15.6'/><path d='M7.5 10.5h6'/>"
    );
    var ICON_EXPAND = icon(
      "<path d='M8 3H3v5'/><path d='M16 3h5v5'/><path d='M3 16v5h5'/><path d='M21 16v5h-5'/>"
    );
    var ICON_THEME = icon(
      "<path d='M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z'/><path d='M9.5 12a2.5 2.5 0 0 0 5 0'/>"
    );
    var ICON_RETRY = icon(
      "<path d='M20 11a8 8 0 1 0-2.34 5.66'/><path d='M20 4v7h-7'/>"
    );
    var ICON_GEAR = icon(
      "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.36.48.6.87.61H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z'/>"
    );
    var TABLE = '[class*="_markdown_"] div:has(> table)';
    var TABLE_VARS = "--md-plus-tbl-radius:8px;--md-plus-tbl-radius-inner:7px;--md-plus-tbl-line:#ebebeb;--md-plus-tbl-head:#f7f7f7;--md-plus-tbl-head-fg:#181818;--md-plus-tbl-hover:#fafafa";
    var TABLE_VARS_DARK = "--md-plus-tbl-line:#2f2f2f;--md-plus-tbl-head:#1f1f1f;--md-plus-tbl-head-fg:#f9fafb;--md-plus-tbl-hover:#1f1f1f";
    var CSS = [
      // ── 卡片：整块一个底色，顶栏不再是独立色带 ──────────────────────
      ".md-code-block{--md-plus-mmd-min-height:200px;--md-plus-icon:" + ICON_CODE + ";--md-plus-icon-copy:" + ICON_COPY + ";--md-plus-icon-download:" + ICON_DOWNLOAD + ";--md-plus-icon-nowrap:" + ICON_NOWRAP + ";--md-plus-icon-diagram:" + ICON_DIAGRAM + ";--md-plus-icon-zoom-in:" + ICON_ZOOM_IN + ";--md-plus-icon-zoom-out:" + ICON_ZOOM_OUT + ";--md-plus-icon-expand:" + ICON_EXPAND + ";--md-plus-icon-theme:" + ICON_THEME + ";--md-plus-icon-retry:" + ICON_RETRY + ";--md-plus-icon-semantic:" + ICON_SEMANTIC + "}",
      // bannerWrap 的原底色是 --dsw-alias-bg-base（#fff），会跟卡片灰拉开一条带
      ".md-code-block > div:has(> " + BANNER + "){background:transparent}",
      // ── 头部：收紧，并把空着的左边填上 ─────────────────────────────
      // 左右 16px 与代码区对齐（目标图里头部的 `</>` 和首行代码是左对齐的）
      // 下内边距留给 pre 的 line-height 去做，避免两处叠加出「断层」
      ".md-code-block " + BANNER + "{padding:8px 16px 0;gap:8px}",
      ".md-code-block " + BANNER + " > :first-child{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:13px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary)}",
      // `</>` 图标
      ".md-code-block " + BANNER + " > :first-child::before{content:'';flex:none;width:14px;height:14px;background:currentColor;color:var(--dsw-alias-label-tertiary);-webkit-mask:var(--md-plus-icon) center/contain no-repeat;mask:var(--md-plus-icon) center/contain no-repeat}",
      // 没有语言时补个占位名，否则整行左边就是一片空白
      ".md-code-block " + BANNER + " > :first-child:empty::after{content:'Plain text'}",
      ":lang(zh) .md-code-block " + BANNER + " > :first-child:empty::after{content:'\u7EAF\u6587\u672C'}",
      // ── 间距：头部与首行代码之间补 6px ──────────────────────────────
      // pre 的行高本身就在首行文字上方留了约半行空白；补 6px 后实测间距约 17px
      // （原来给 0 时只有 11px，贴着看太挤）
      // 未设字号时不能回退 inherit：pre 的父级是正文，会把宿主的代码字号
      // （--dsh-code-font-size）盖成正文大小；回退到宿主变量才是真「跟随宿主」。
      ".md-code-block pre{padding:6px 16px 16px;font-size:var(--md-plus-code-font-size,var(--dsh-code-font-size,11px))}",
      ".md-code-block pre{line-height:var(--md-plus-code-line-height,calc(19px + var(--dsh-code-font-delta,0px)))}",
      // DSH 0.2.1 把内容容器设成 display:contents，折叠需要真实的盒子才能量高度和裁剪
      ".md-code-block > [data-code-block-content]{display:block}",
      // ── 头部按钮：文字换成图标 ──────────────────────────────────────
      ".md-code-block " + BANNER + " button{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;font-size:0;cursor:pointer;background:transparent;color:var(--dsw-alias-label-tertiary);transition:background-color .12s ease,color .12s ease}",
      // font-size:0 只藏住「复制 / 已复制」的字面，可访问名仍在
      ".md-code-block " + BANNER + " ." + BTN_CLASS + "::before{content:'';width:15px;height:15px;background:currentColor}",
      // 旧版宿主的复制按钮只有文字，没有 SVG 图标，才需要补一枚；新版已有 SVG，不再叠加
      ".md-code-block " + BANNER + " button:last-child:not(:has(svg))::before{content:'';width:15px;height:15px;background:currentColor;-webkit-mask:var(--md-plus-icon-copy) center/contain no-repeat;mask:var(--md-plus-icon-copy) center/contain no-repeat}",
      ".md-code-block " + BANNER + " button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 12%))}",
      ".md-code-block " + BANNER + " button:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4c6ef5);outline-offset:1px}",
      // ── 普通块：不换行切换 ──────────────────────────────────────────
      ".md-code-block " + BANNER + " ." + TOOL_CLASS + "::before{-webkit-mask:var(--md-plus-icon-nowrap) center/contain no-repeat;mask:var(--md-plus-icon-nowrap) center/contain no-repeat}",
      "[" + WRAP_ATTR + '="on"] .' + TOOL_CLASS + "{color:var(--dsw-alias-button-primary-fill,#4c6ef5);background:var(--dsw-alias-interactive-bg-active,rgb(76 110 245 / 12%))}",
      "[" + WRAP_ATTR + '="on"] pre{white-space:pre;word-break:normal;overflow-x:auto}',
      // ── mermaid 块：图形 / 代码 切换 + 缩放 ────────────────────────
      ".md-code-block " + BANNER + " ." + TOGGLE_CLASS + "::before{-webkit-mask:var(--md-plus-icon-diagram) center/contain no-repeat;mask:var(--md-plus-icon-diagram) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + ZOOM_IN_CLASS + "::before{-webkit-mask:var(--md-plus-icon-zoom-in) center/contain no-repeat;mask:var(--md-plus-icon-zoom-in) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + ZOOM_OUT_CLASS + "::before{-webkit-mask:var(--md-plus-icon-zoom-out) center/contain no-repeat;mask:var(--md-plus-icon-zoom-out) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + EXPAND_CLASS + "::before{-webkit-mask:var(--md-plus-icon-expand) center/contain no-repeat;mask:var(--md-plus-icon-expand) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + THEME_CLASS + "::before{-webkit-mask:var(--md-plus-icon-theme) center/contain no-repeat;mask:var(--md-plus-icon-theme) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + COPY_SOURCE_CLASS + "::before{-webkit-mask:var(--md-plus-icon-copy) center/contain no-repeat;mask:var(--md-plus-icon-copy) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + DOWNLOAD_CLASS + "::before{-webkit-mask:var(--md-plus-icon-download) center/contain no-repeat;mask:var(--md-plus-icon-download) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + RETRY_CLASS + "::before{-webkit-mask:var(--md-plus-icon-retry) center/contain no-repeat;mask:var(--md-plus-icon-retry) center/contain no-repeat}",
      "[" + MMD_ATTR + '="diagram"] .' + TOGGLE_CLASS + "{color:var(--dsw-alias-button-primary-fill,#4c6ef5);background:var(--dsw-alias-interactive-bg-active,rgb(76 110 245 / 12%))}",
      // 已经到最小 / 最大时，对应那颗按钮变淡且不可点
      "[" + ZOOM_ATTR + '="min"] .' + ZOOM_OUT_CLASS + ",[" + ZOOM_ATTR + '="max"] .' + ZOOM_IN_CLASS + "{opacity:.3;pointer-events:none}",
      // 只有画成功时才藏源码；code / failed 两态都让源码露出来
      "[" + MMD_ATTR + '="diagram"] > ' + CONTENT + " > pre{display:none}",
      "[" + MMD_ATTR + '="code"] > ' + CONTENT + " > ." + MMD_CLASS + "{display:none}",
      // 图形外两层：viewport 负责裁剪与拖拽光标，stage 负责缩放平移
      "." + MMD_CLASS + "{padding:4px 16px 16px}",
      "." + MMD_CLASS + "-viewport{overflow:hidden;position:relative}",
      "." + MMD_CLASS + '-viewport[data-zoomed="on"]{cursor:grab}',
      "." + MMD_CLASS + '-viewport[data-dragging="on"]{cursor:grabbing}',
      // 横排长链这类长扁图渲染出来只有几十像素高，放大后就是个「缝」。
      // 给 stage 兜一个最低高度、并让图在里面垂直居中，放大后才有地方看。
      "." + MMD_CLASS + "-stage{transform-origin:0 0;display:flex;flex-direction:column;justify-content:center;min-height:var(--md-plus-mmd-min-height)}",
      "." + MMD_CLASS + " svg{display:block;margin:0 auto;max-width:100%;height:auto}",
      "." + MMD_CLASS + "-error{margin:0 16px 12px;padding:8px 12px;border-radius:8px;font:12px/18px var(--ds-font-family-code,monospace);white-space:pre-wrap;color:var(--dsw-alias-state-error-primary,#d33);background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 8%))}",
      // ── 全屏查看：复杂时序图不挤在聊天栏里，默认按整图铺满视口 ─────
      "." + MODAL_CLASS + "{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:calc(var(--dsh-windows-titlebar-height,0px) + 16px) 24px 24px;background:rgb(0 0 0 / 48%)}",
      "." + MODAL_CLASS + "-panel{display:flex;flex-direction:column;width:min(1600px,100%);height:min(1000px,100%);overflow:hidden;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%));border-radius:12px;background:var(--dsw-alias-bg-base,#fff);box-shadow:0 24px 80px rgb(0 0 0 / 25%)}",
      "." + MODAL_CLASS + "-bar{display:flex;align-items:center;gap:8px;flex:none;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%))}",
      "." + MODAL_CLASS + "-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 13px/18px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-primary)}",
      "." + MODAL_CLASS + "-actions{display:flex;align-items:center;gap:6px;flex:none}",
      "." + MODAL_CLASS + "-actions button{appearance:none;border:0;border-radius:6px;padding:5px 10px;background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 12%));color:var(--dsw-alias-label-primary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer}",
      "." + MODAL_CLASS + "-actions button:hover{background:var(--dsw-alias-interactive-bg-active,rgb(76 110 245 / 12%))}",
      "." + MODAL_CLASS + "-body{display:flex;flex:1;min-height:0;padding:16px}",
      "." + MODAL_CLASS + "-viewport{flex:1;min-height:0}",
      "." + MODAL_CLASS + "-stage{display:inline-flex;align-items:center;justify-content:center;min-height:0;flex:none}",
      "." + MODAL_CLASS + " svg{display:block}",
      // ── 代码块语义视图：JSON / CSV / 日志 / diff ──────────────────
      "." + SEMANTIC_CLASS + "{display:none;padding:8px 16px 16px;color:var(--dsw-alias-label-primary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);--md-plus-tbl-line:#ebebeb;--md-plus-tbl-radius:8px;--md-plus-tbl-head:#f7f7f7;--md-plus-tbl-head-fg:#181818;--md-plus-tbl-hover:#fafafa}",
      "body[data-ds-dark-theme] ." + SEMANTIC_CLASS + "{--md-plus-tbl-line:#2f2f2f;--md-plus-tbl-head:#1f1f1f;--md-plus-tbl-head-fg:#f9fafb;--md-plus-tbl-hover:#1f1f1f}",
      "[" + SEMANTIC_ATTR + '="on"] > ' + CONTENT + " > ." + SEMANTIC_CLASS + "{display:block}",
      "[" + SEMANTIC_ATTR + '="on"] > ' + CONTENT + " pre{display:none}",
      "[" + SEMANTIC_ATTR + '="on"] > ' + CONTENT + " > ." + HOST_CLASS + "{display:none}",
      ".md-code-block " + BANNER + " ." + SEMANTIC_TOGGLE_CLASS + "::before{-webkit-mask:var(--md-plus-icon-semantic) center/contain no-repeat;mask:var(--md-plus-icon-semantic) center/contain no-repeat}",
      "[" + SEMANTIC_ATTR + '="on"] .' + SEMANTIC_TOGGLE_CLASS + "{color:var(--dsw-alias-button-primary-fill,#4c6ef5);background:var(--dsw-alias-interactive-bg-active,rgb(76 110 245 / 12%))}",
      "." + SEMANTIC_CLASS + "-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;flex-wrap:wrap}",
      "." + SEMANTIC_CLASS + "-summary{font:11px/16px var(--ds-font-family-code,monospace);color:var(--dsw-alias-label-tertiary);white-space:nowrap}",
      "." + SEMANTIC_CLASS + "-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap}",
      "." + SEMANTIC_CLASS + "-btn{appearance:none;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 20%));border-radius:5px;padding:2px 7px;background:transparent;color:var(--dsw-alias-label-secondary);font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer;white-space:nowrap}",
      "." + SEMANTIC_CLASS + "-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 12%));color:var(--dsw-alias-label-primary)}",
      "." + SEMANTIC_CLASS + "-btn-active{color:var(--dsw-alias-button-primary-fill,#4c6ef5);border-color:color-mix(in srgb,var(--dsw-alias-button-primary-fill,#4c6ef5) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-button-primary-fill,#4c6ef5) 10%,transparent)}",
      "." + SEMANTIC_CLASS + "-empty{margin:10px 0;padding:14px;border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 6%));color:var(--dsw-alias-label-tertiary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);text-align:center}",
      ".md-plus-semantic-json-tree{font:var(--md-plus-code-font-size,var(--dsh-code-font-size,11px))/1.65 var(--ds-font-family-code,monospace);overflow:auto;max-height:70vh}",
      ".md-plus-json-row{display:flex;align-items:flex-start;gap:4px;min-height:18px;padding:1px 4px;border-radius:4px}",
      ".md-plus-json-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 8%))}",
      ".md-plus-json-toggle{flex:none;width:14px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:12px/1.4 var(--ds-font-family-code,monospace);cursor:pointer}",
      ".md-plus-json-toggle:hover{color:var(--dsw-alias-label-primary)}",
      ".md-plus-json-key{flex:none;font-weight:600;color:var(--dsw-alias-label-primary)}",
      ".md-plus-json-colon{flex:none;margin-right:2px;color:var(--dsw-alias-label-tertiary)}",
      ".md-plus-json-children{margin-left:14px;padding-left:6px;border-left:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 12%))}",
      ".md-plus-json-summary{color:var(--dsw-alias-label-tertiary)}",
      ".md-plus-json-string{color:#2f9e44;white-space:pre-wrap;word-break:break-word}",
      "body[data-ds-dark-theme] .md-plus-json-string{color:#69db7c}",
      ".md-plus-json-number{color:#1971c2}",
      "body[data-ds-dark-theme] .md-plus-json-number{color:#74c0fc}",
      ".md-plus-json-boolean{color:#e8590c}",
      "body[data-ds-dark-theme] .md-plus-json-boolean{color:#ffa94d}",
      ".md-plus-json-null{color:var(--dsw-alias-label-tertiary);font-style:italic}",
      ".md-plus-semantic-table-body{max-height:70vh;overflow:auto}",
      ".md-plus-semantic-table-wrap{margin:0;overflow:auto;border:1px solid var(--md-plus-tbl-line);border-radius:var(--md-plus-tbl-radius)}",
      ".md-plus-semantic-table table{border-collapse:separate;border-spacing:0;width:100%;min-width:max-content;font:var(--md-plus-code-font-size,var(--dsh-code-font-size,11px))/1.5 var(--ds-font-family-code,monospace)}",
      ".md-plus-semantic-table th{position:sticky;top:0;z-index:1;padding:7px 12px;border-bottom:1px solid var(--md-plus-tbl-line);background:var(--md-plus-tbl-head);color:var(--md-plus-tbl-head-fg);font-weight:600;text-align:center;white-space:nowrap}",
      ".md-plus-semantic-table td{max-width:360px;padding:6px 12px;border-bottom:1px solid var(--md-plus-tbl-line);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".md-plus-semantic-table tbody tr:hover td{background:var(--md-plus-tbl-hover)}",
      ".md-plus-semantic-number{text-align:center;font-variant-numeric:tabular-nums}",
      ".md-plus-semantic-log-body{max-height:70vh;overflow:auto;padding:4px 0;border-radius:6px;background:var(--dsw-alias-markdown-code-block,transparent);font:var(--md-plus-code-font-size,var(--dsh-code-font-size,11px))/1.6 var(--ds-font-family-code,monospace)}",
      ".md-plus-log-line{display:grid;grid-template-columns:44px 52px 1fr;gap:8px;align-items:start;padding:2px 8px;border-radius:4px}",
      ".md-plus-log-line:hover{background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 8%))}",
      ".md-plus-log-number{color:var(--dsw-alias-label-tertiary);text-align:right;user-select:none;font-size:10px}",
      ".md-plus-log-badge{color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:700;text-transform:uppercase}",
      ".md-plus-log-line-error .md-plus-log-badge{color:#e03131}",
      ".md-plus-log-line-warn .md-plus-log-badge{color:#e8590c}",
      ".md-plus-log-line-info .md-plus-log-badge{color:#1971c2}",
      ".md-plus-log-line-debug .md-plus-log-badge{color:#7048e8}",
      ".md-plus-log-line-error{background:rgb(224 49 49 / 6%)}",
      ".md-plus-log-line-warn{background:rgb(232 89 12 / 6%)}",
      ".md-plus-log-text{white-space:pre-wrap;word-break:break-word}",
      ".md-plus-semantic-diff-body{max-height:70vh;overflow:auto;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%));border-radius:6px;font:var(--md-plus-code-font-size,var(--dsh-code-font-size,11px))/1.5 var(--ds-font-family-code,monospace)}",
      ".md-plus-diff-hunk + .md-plus-diff-hunk{border-top:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%))}",
      ".md-plus-diff-hunk-header{padding:4px 8px;background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 6%));color:var(--dsw-alias-label-tertiary);font-size:10px;white-space:pre-wrap}",
      ".md-plus-diff-line{display:grid;grid-template-columns:52px 52px 16px 1fr;gap:4px;align-items:start;min-height:18px;padding:0 8px}",
      ".md-plus-diff-num{color:var(--dsw-alias-label-tertiary);text-align:right;user-select:none}",
      ".md-plus-diff-sign{text-align:center;color:var(--dsw-alias-label-tertiary)}",
      ".md-plus-diff-text{white-space:pre-wrap;word-break:break-word}",
      ".md-plus-diff-line-add{background:rgb(47 158 68 / 10%)}",
      ".md-plus-diff-line-remove{background:rgb(224 49 49 / 10%)}",
      ".md-plus-diff-line-add .md-plus-diff-sign{color:#2f9e44}",
      ".md-plus-diff-line-remove .md-plus-diff-sign{color:#e03131}",
      ".md-plus-diff-stat{display:inline-flex;gap:8px}",
      ".md-plus-diff-added{color:#2f9e44;font-weight:600}",
      ".md-plus-diff-removed{color:#e03131;font-weight:600}",
      ".md-plus-diff-hunk-split .md-plus-diff-split-row{display:grid;grid-template-columns:1fr 1fr}",
      ".md-plus-diff-split-cell{display:grid;grid-template-columns:44px 14px 1fr;gap:4px;min-height:18px;padding:0 8px}",
      ".md-plus-diff-split-cell + .md-plus-diff-split-cell{border-left:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%))}",
      ".md-plus-diff-empty{background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 4%))}",
      ".md-plus-diff-meta{padding:2px 8px;color:var(--dsw-alias-label-tertiary);font-style:italic}",
      // ── 长内容折叠：代码块、表格、图表卡共用一套按钮 ───────────────
      "." + FOLD_CLASS + "{position:relative}",
      // 用 clip 而不是 hidden：hidden 会建立隐形滚动容器，鼠标在折叠内容上滚轮会被它吞掉。
      "." + FOLD_CLASS + "[" + FOLD_ATTR + '="on"]{max-height:var(--md-plus-fold-max-height);overflow:clip}',
      "." + FOLD_BTN_CLASS + "{display:block;white-space:nowrap;margin:8px auto 0;padding:4px 12px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 22%));border-radius:999px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer;box-shadow:0 2px 8px rgb(0 0 0 / 12%);z-index:2}",
      "." + FOLD_CLASS + "[" + FOLD_ATTR + '="on"] .' + FOLD_BTN_CLASS + "{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);margin:0}",
      // ── 图片点击放大 ────────────────────────────────────────────────
      '[class*="_markdown_"] img{cursor:zoom-in}',
      "." + IMG_MODAL_CLASS + "{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:calc(var(--dsh-windows-titlebar-height,0px) + 16px) 24px 24px;background:rgb(0 0 0 / 72%)}",
      "." + IMG_MODAL_CLASS + " img{max-width:92vw;max-height:86vh;border-radius:8px;background:#fff;box-shadow:0 24px 80px rgb(0 0 0 / 35%)}",
      "." + IMG_MODAL_CLASS + "-close{position:absolute;top:calc(var(--dsh-windows-titlebar-height,0px) + 18px);right:24px;width:32px;height:32px;padding:0;border:0;border-radius:999px;background:rgb(255 255 255 / 14%);color:#fff;font:20px/1 var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer}",
      "." + IMG_MODAL_CLASS + "-close:hover{background:rgb(255 255 255 / 24%)}",
      // ── 设置面板 ────────────────────────────────────────────────────
      ":root{--md-plus-icon-gear:" + ICON_GEAR + "}",
      "." + SETTINGS_BTN_CLASS + "{position:fixed;right:16px;bottom:76px;z-index:2147482000;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%));border-radius:999px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-tertiary);opacity:.45;cursor:pointer;box-shadow:0 2px 10px rgb(0 0 0 / 12%);transition:opacity .12s ease,color .12s ease}",
      "." + SETTINGS_BTN_CLASS + ":hover{opacity:1;color:var(--dsw-alias-label-primary)}",
      "." + SETTINGS_BTN_CLASS + "::before{content:'';width:16px;height:16px;background:currentColor;-webkit-mask:var(--md-plus-icon-gear) center/contain no-repeat;mask:var(--md-plus-icon-gear) center/contain no-repeat}",
      "." + SETTINGS_MODAL_CLASS + "{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:calc(var(--dsh-windows-titlebar-height,0px) + 16px) 24px 24px;background:rgb(0 0 0 / 48%)}",
      "." + SETTINGS_MODAL_CLASS + "-panel{width:min(440px,100%);max-height:86vh;overflow:auto;padding:16px 18px 14px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%));border-radius:12px;background:var(--dsw-alias-bg-base,#fff);box-shadow:0 24px 80px rgb(0 0 0 / 25%)}",
      "." + SETTINGS_MODAL_CLASS + "-title{margin:0 0 10px;font:600 14px/22px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-primary)}",
      "." + SETTINGS_MODAL_CLASS + "-row{display:flex;align-items:center;gap:12px;min-height:36px;margin:0 0 10px}",
      "." + SETTINGS_MODAL_CLASS + "-label{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;font:13px/20px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-primary)}",
      "." + SETTINGS_MODAL_CLASS + "-label-title{display:block}",
      "." + SETTINGS_MODAL_CLASS + "-label-hint{display:block;font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-tertiary)}",
      "." + SETTINGS_MODAL_CLASS + "-hint{margin:-4px 0 8px;font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-tertiary)}",
      "." + SETTINGS_MODAL_CLASS + "-section{margin:14px 0 8px;font:600 12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-secondary)}",
      "." + SETTINGS_MODAL_CLASS + " input[type=number]{width:78px;padding:4px 6px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 22%));border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 6%));color:var(--dsw-alias-label-primary);font:13px/18px var(--dsw-font-family-sans,system-ui,sans-serif)}",
      "." + SETTINGS_MODAL_CLASS + " select{padding:4px 6px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 22%));border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 6%));color:var(--dsw-alias-label-primary);font:13px/18px var(--dsw-font-family-sans,system-ui,sans-serif)}",
      "." + SETTINGS_MODAL_CLASS + "-footer{margin-top:18px;padding-top:14px;border-top:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%))}",
      "." + SETTINGS_MODAL_CLASS + "-utilities{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 18px;margin:0 0 14px}",
      "." + SETTINGS_MODAL_CLASS + "-fold-actions,." + SETTINGS_MODAL_CLASS + "-transfer-actions{display:flex;align-items:center;gap:8px}",
      "." + SETTINGS_MODAL_CLASS + "-utility-label{font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-tertiary);white-space:nowrap}",
      "." + SETTINGS_MODAL_CLASS + "-segment{display:inline-flex;align-items:center;gap:1px;padding:2px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 18%));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 5%))}",
      "." + SETTINGS_MODAL_CLASS + "-segment button{appearance:none;border:0;border-radius:6px;padding:4px 8px;background:transparent;color:var(--dsw-alias-label-secondary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer}",
      "." + SETTINGS_MODAL_CLASS + "-segment button:hover{background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 12%));color:var(--dsw-alias-label-primary)}",
      "." + SETTINGS_MODAL_CLASS + "-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:0}",
      "." + SETTINGS_MODAL_CLASS + "-actions button{appearance:none;border:0;border-radius:7px;min-height:30px;padding:5px 12px;background:transparent;color:var(--dsw-alias-label-secondary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer}",
      "." + SETTINGS_MODAL_CLASS + "-actions button:first-child{margin-right:auto;color:var(--dsw-alias-label-tertiary)}",
      "." + SETTINGS_MODAL_CLASS + "-actions button:not(." + SETTINGS_MODAL_CLASS + "-primary):hover{background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 12%));color:var(--dsw-alias-label-primary)}",
      "." + SETTINGS_MODAL_CLASS + "-actions ." + SETTINGS_MODAL_CLASS + "-primary{background:var(--dsw-alias-button-primary-fill,#4c6ef5);color:var(--dsw-alias-label-primary-foreground,#fff)}",
      "." + SETTINGS_MODAL_CLASS + "-actions ." + SETTINGS_MODAL_CLASS + "-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,#4c6ef5))}",
      "." + SETTINGS_MODAL_CLASS + "-fold-actions button:focus-visible,." + SETTINGS_MODAL_CLASS + "-transfer-actions button:focus-visible,." + SETTINGS_MODAL_CLASS + "-actions button:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4c6ef5);outline-offset:1px}",
      // 高亮宿主不参与布局，让里面的 <pre> 直接吃到卡片样式
      "." + HOST_CLASS + "{display:contents}",
      // 藏掉纯文本回退，只留着色结果；原节点仍在，复制读的还是它
      "[" + DONE_ATTR + '="done"] > ' + CONTENT + " > pre:not(.md-plus-pre){display:none}",
      // ── 表格 ────────────────────────────────────────────────────────
      // 抓手用结构选择器而不是 DSH 的哈希类名：外层是「唯一子元素是 table 的 div」。
      // 前面挂 [class*="_markdown_"] 有两个作用——只认 markdown 渲染出来的表格，
      // 同时把特异性顶到 (0,1,4)，压过 DSH 自己的 .tableScroll th (0,1,1)。
      // 不要加 overscroll-behavior-y:contain：宿主给表格的外层是 overflow-x:auto，
      // 两轴滚动容器上加 contain 会让没有纵向滚动的短表也吞掉页面滚轮；宿主的
      // overscroll-behavior-x:contain 同样要清掉，Chrome 下它也会连带吞掉纵向滚轮。
      TABLE + "{position:relative;margin-block:16px;max-height:min(70vh,720px);overflow-y:auto;overscroll-behavior:auto;" + TABLE_VARS + "}",
      "body[data-ds-dark-theme] " + TABLE + "{" + TABLE_VARS_DARK + "}",
      // 整张表一个 1px 边框 + 小圆角。
      // 注意必须是 separate：collapse 模式下 Chrome 会忽略单元格的圆角，
      // 表头的灰底会在四角戳出直角。border-spacing 归零所以不会有缝。
      TABLE + " > table{border:1px solid var(--md-plus-tbl-line);border-collapse:separate;border-spacing:0;border-radius:var(--md-plus-tbl-radius)}",
      // 表头：浅灰底 + 加粗深色字（DSH 原本没有底色）
      TABLE + " > table th{background:var(--md-plus-tbl-head);color:var(--md-plus-tbl-head-fg);font-weight:600;padding:10px 16px;border-bottom:1px solid var(--md-plus-tbl-line);border-top:0}",
      TABLE + " > table td{padding:10px 16px;border-bottom:1px solid var(--md-plus-tbl-line)}",
      // 四角单独收圆，内圆角比外圆角少 1px（正好让开那圈边框）。
      // 必须写明 thead / tbody：裸写 tr:first-child 会同时命中表头行和第一行数据，
      // 而表头行本身就是 thead 的 last-child——漏掉 tbody 的话表头下沿也会被收圆，
      // 灰底在下沿两端各戳出一个缺口。
      TABLE + " > table thead tr:first-child > :first-child{border-top-left-radius:var(--md-plus-tbl-radius-inner)}",
      TABLE + " > table thead tr:first-child > :last-child{border-top-right-radius:var(--md-plus-tbl-radius-inner)}",
      TABLE + " > table tbody tr:last-child > :first-child{border-bottom-left-radius:var(--md-plus-tbl-radius-inner)}",
      TABLE + " > table tbody tr:last-child > :last-child{border-bottom-right-radius:var(--md-plus-tbl-radius-inner)}",
      // DSH 把首列左边距、末列右边距清零了，参考图里是留着的
      TABLE + " > table th:first-child," + TABLE + " > table td:first-child{padding-left:16px}",
      TABLE + " > table th:last-child," + TABLE + " > table td:last-child{padding-right:16px}",
      // 最后一行的下边线交给 table 自己的边框，免得叠成双线
      TABLE + " > table tr:last-child td{border-bottom:0}",
      // 宽表横向扫读时给个落点
      TABLE + " > table tbody tr:hover td{background:var(--md-plus-tbl-hover)}",
      // 冻结行 / 列：具体偏移由客户端按实际行列尺寸算好，支持设置多行多列
      TABLE + " > table ." + FREEZE_ROW_CLASS + "{position:sticky;z-index:2;box-shadow:0 1px 0 var(--md-plus-tbl-line)}",
      TABLE + " > table th." + FREEZE_ROW_CLASS + "{background:var(--md-plus-tbl-head)}",
      TABLE + " > table td." + FREEZE_ROW_CLASS + "{background:var(--dsw-alias-bg-base,#fff)}",
      TABLE + " > table ." + FREEZE_COL_CLASS + "{position:sticky;z-index:1;box-shadow:1px 0 0 var(--md-plus-tbl-line)}",
      TABLE + " > table th." + FREEZE_COL_CLASS + "{background:var(--md-plus-tbl-head)}",
      TABLE + " > table td." + FREEZE_COL_CLASS + "{background:var(--dsw-alias-bg-base,#fff)}",
      TABLE + " > table ." + FREEZE_CROSS_CLASS + "{z-index:3}",
      TABLE + " > table tbody tr:hover td." + FREEZE_ROW_CLASS + "," + TABLE + " > table tbody tr:hover td." + FREEZE_COL_CLASS + "{background:var(--md-plus-tbl-hover)}",
      // 复制按钮放在表尾右侧：不压住表头文字，表格折叠时也能随展开一起出现
      TABLE + " > table > caption." + TABLE_TOOLS_CLASS + "{caption-side:top;position:sticky;right:0;width:0;height:30px;margin-left:auto;padding:0;text-align:right;z-index:2}",
      TABLE + " > table > caption." + TABLE_TOOLS_CLASS + " > span{position:absolute;right:0;top:0;display:flex;gap:0;white-space:nowrap}",
      TABLE + " > table > caption." + TABLE_TOOLS_CLASS + " button{appearance:none;border:1px solid var(--md-plus-tbl-line);border-radius:5px;padding:2px 8px;margin-left:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer}",
      TABLE + " > table > caption." + TABLE_TOOLS_CLASS + " button:hover{color:var(--dsw-alias-label-primary);background:var(--md-plus-tbl-hover)}",
      // 宽表（≥4 列）不收着不行。宿主给这类表加了 .md-table-wide，并让它「出血」：
      // 包裹层撑到面板宽，再用 padding-left 把表推到正文栏左侧。那个 padding 会吃掉
      // 可用宽度，结果是表格比正文宽出一截、右边还被裁掉；这里按回正文栏宽，超出改为表内横滚。
      // 特异性 (0,2,2)，压得住宿主的 .Pg4CGa_body .md-table-wide (0,2,0)。
      TABLE + ".md-table-wide{width:100%;max-width:100%;margin-inline:0;padding-inline:0;padding-bottom:0;overflow-x:auto}",
      // 塞得下就撑满正文栏，塞不下保持自然宽度让外面滚，不把列挤成一列一个字
      TABLE + ".md-table-wide > table{width:100%;max-width:none;min-width:max-content}",
      // 折叠态保留横向滚动，但纵向必须 clip；横向滚动容器只有在
      // overscroll-behavior:auto 时才会把纵向滚轮交还给页面。
      // 这里同时写明 min/max-height：基础表格规则的 max-height 特异性更高，不补会压过设置值；
      // 最小高度保证极低阈值下「展开」按钮仍完整可见。
      TABLE + "." + FOLD_CLASS + "[" + FOLD_ATTR + '="on"]{min-height:48px;max-height:var(--md-plus-fold-max-height);overflow-x:auto;overflow-y:clip}',
      // 展开态的「收起」按钮在表尾文档流里，纵向保持滚到底才出现；
      // 横向用 sticky 钉在可视区中间，宽表左右滚动时不会跟着表内容跑掉。
      // 折叠态按钮是绝对定位，横向跟随由 sync() 写 left 完成。
      TABLE + " ." + FOLD_BTN_CLASS + "{position:sticky;left:50%;transform:translateX(-50%)}"
    ].join("\n");
    var scripts = /* @__PURE__ */ new Map();
    var pending = /* @__PURE__ */ new Set();
    var foldSyncs = /* @__PURE__ */ new WeakMap();
    var foldTargets = /* @__PURE__ */ new Set();
    var foldResizeObserver = null;
    var foldResizeHandler = null;
    var diagramKindCache = /* @__PURE__ */ new WeakMap();
    var semanticKindCache = /* @__PURE__ */ new WeakMap();
    var cacheKeys = /* @__PURE__ */ new WeakMap();
    var semanticStates = /* @__PURE__ */ new WeakMap();
    var timer = null;
    var rescanQueued = false;
    var injected = /* @__PURE__ */ new Set();
    var tableFreezeObserver = null;
    var tableFreezeTargets = /* @__PURE__ */ new Set();
    var tableFreezeState = /* @__PURE__ */ new WeakMap();
    var diagramSeq = 0;
    var disposed = false;
    function injectStyle() {
      if (document.querySelector("style[" + STYLE_ATTR + "]") !== null) return;
      var tag = document.createElement("style");
      tag.setAttribute(STYLE_ATTR, "1");
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }
    function loadScript(url, globalName) {
      if (window[globalName] !== void 0) return Promise.resolve(window[globalName]);
      var cached = scripts.get(url);
      if (cached !== void 0) return cached;
      var promise = new Promise((resolve) => {
        var script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.setAttribute(RUNTIME_ATTR, "1");
        script.addEventListener(
          "load",
          () => {
            var api = window[globalName];
            if (api === void 0) scripts.delete(url);
            resolve(api ?? null);
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => {
            scripts.delete(url);
            script.remove();
            resolve(null);
          },
          { once: true }
        );
        document.head.appendChild(script);
      });
      scripts.set(url, promise);
      return promise;
    }
    function readBannerLabel(block) {
      var banner = block.querySelector(BANNER);
      var info = banner?.querySelector('[class*="_language_"]') ?? banner?.firstElementChild;
      return (info?.textContent ?? "").trim().toLowerCase();
    }
    var PLACEHOLDER_LABELS = /* @__PURE__ */ new Set(["", "\u4EE3\u7801\u5757", "code block", "code", "plain text", "plaintext", "\u7EAF\u6587\u672C"]);
    var FIBER_KEY = "__reactFiber$";
    function isPlaceholderLabel(label) {
      return PLACEHOLDER_LABELS.has(label);
    }
    function readFiberLang(block) {
      var info = null;
      var nodes = [block, block.querySelector(CONTENT)];
      for (var node of nodes) {
        if (node === null || node === void 0) continue;
        var names;
        try {
          names = Object.getOwnPropertyNames(node);
        } catch {
          continue;
        }
        for (var name of names) {
          if (name.lastIndexOf(FIBER_KEY, 0) !== 0) continue;
          var fiber = node[name];
          for (var depth = 0; fiber !== null && fiber !== void 0 && depth < 24; depth += 1) {
            var props = fiber.memoizedProps;
            if (props !== null && typeof props === "object" && Object.prototype.hasOwnProperty.call(props, "lang")) {
              var value = typeof props.lang === "string" ? props.lang.trim().toLowerCase() : "";
              info = { hasLang: value !== "", lang: value };
              break;
            }
            fiber = fiber.return;
          }
          if (info !== null) break;
        }
        if (info !== null) break;
      }
      return info;
    }
    function readLang(block) {
      var label = readBannerLabel(block);
      if (!isPlaceholderLabel(label)) return label;
      var info = readFiberLang(block);
      return info === null ? "" : info.lang;
    }
    function paintLanguageLabel(block, lang) {
      if (lang === "") return;
      var banner = block.querySelector(BANNER);
      var heading = banner?.firstElementChild;
      if (heading === null || heading === void 0) return;
      var target = banner.querySelector('[class*="_language_"]') ?? heading;
      if ((target.textContent ?? "").trim().toLowerCase() === lang) return;
      if (!target.hasAttribute("data-md-plus-original-label")) {
        target.setAttribute("data-md-plus-original-label", target.textContent ?? "");
      }
      target.textContent = lang;
      target.setAttribute("data-md-plus-lang", lang);
    }
    function sniffDiagramType(code) {
      var lines = code.split("\n");
      var start = 0;
      while (start < lines.length) {
        var line = lines[start].trim();
        if (line === "" || line.startsWith("%%")) {
          start += 1;
          continue;
        }
        break;
      }
      var text = lines.slice(start).join("\n");
      if (text.startsWith("---")) {
        var blank = text.indexOf("\n");
        var close = blank < 0 ? -1 : text.indexOf("\n---", blank);
        text = close < 0 ? "" : text.slice(close + 4);
      }
      var first = text.split("\n").find((line2) => {
        var value2 = line2.trim();
        return value2 !== "" && !value2.startsWith("%%");
      });
      if (first === void 0) return null;
      var value = first.trim();
      var flow = MMD_FLOW.exec(value);
      if (flow !== null) return flow[1];
      if (MMD_PIE.test(value)) return "pie";
      if (MMD_GIT.test(value)) return "gitGraph";
      var single = MMD_SINGLE.exec(value);
      return single === null ? null : single[1];
    }
    function computeDiagramKind(block) {
      var lang = readLang(block);
      if (MMD_LANGS.has(lang)) return "diagram";
      if (lang !== "") return null;
      var pre = block.querySelector(CONTENT + " pre");
      if (pre === null) return null;
      return sniffDiagramType(pre.textContent ?? "") === null ? null : "diagram";
    }
    function diagramKind(block) {
      if (diagramKindCache.has(block)) return diagramKindCache.get(block);
      var kind = computeDiagramKind(block);
      diagramKindCache.set(block, kind);
      return kind;
    }
    function isOurs(node) {
      var element2 = node?.nodeType === 1 ? node : node?.parentElement;
      return element2?.closest?.(
        "." + HOST_CLASS + ", ." + BTN_CLASS + ", ." + MMD_CLASS + ", ." + FOLD_BTN_CLASS + ", ." + TABLE_TOOLS_CLASS + ", ." + IMG_MODAL_CLASS + ", ." + MODAL_CLASS + ", ." + SETTINGS_BTN_CLASS + ", ." + SETTINGS_MODAL_CLASS + ", ." + SEMANTIC_CLASS
      ) != null;
    }
    function closestStreaming(node) {
      var element2 = node?.nodeType === 1 ? node : node?.parentElement;
      return element2?.closest?.("[data-streaming]") ?? null;
    }
    function schedule(block) {
      if (disposed) return;
      if (block !== void 0) pending.add(block);
      else rescanQueued = true;
      if (timer !== null) return;
      timer = window.setTimeout(flush, DEBOUNCE_MS);
    }
    function flush() {
      timer = null;
      if (disposed) return;
      for (const node of injected) {
        if (!node.isConnected) injected.delete(node);
      }
      cleanupFoldTargets();
      cleanupTableFreezeTargets();
      diagramKindCache = /* @__PURE__ */ new WeakMap();
      semanticKindCache = /* @__PURE__ */ new WeakMap();
      if (rescanQueued) {
        rescanQueued = false;
        for (const block of document.querySelectorAll(BLOCK)) pending.add(block);
      }
      var batch = Array.from(pending);
      pending.clear();
      for (const block of batch) {
        if (closestStreaming(block) !== null) continue;
        decorate(block);
        void enhance(block);
        enhanceSemantic(block);
      }
      scanFolds();
      ensureSettingsButton();
    }
    function onMutations(records) {
      for (const record of records) {
        if (record.type === "attributes" && record.attributeName === "data-ds-dark-theme") {
          redrawDiagrams();
          return;
        }
        if (closestStreaming(record.target) !== null) continue;
        if (isOurs(record.target)) continue;
        var added = record.addedNodes;
        var oursOnly = added.length > 0;
        for (const node of added) {
          if (isOurs(node)) continue;
          oursOnly = false;
          break;
        }
        if (oursOnly) continue;
        schedule();
        return;
      }
    }
    function redrawDiagrams() {
      for (const block of document.querySelectorAll("[" + MMD_ATTR + "]")) {
        if (block.getAttribute(MMD_ATTR) === "failed") continue;
        cacheKeys.delete(block);
        pending.add(block);
      }
      schedule();
    }
    var WRAP_BUTTON = {
      cls: TOOL_CLASS,
      titleKey: "wrapTitle",
      ariaKey: "wrapAria",
      run: (block) => {
        if (block.getAttribute(WRAP_ATTR) === "on") block.removeAttribute(WRAP_ATTR);
        else block.setAttribute(WRAP_ATTR, "on");
      }
    };
    var DOWNLOAD_BUTTON = {
      cls: DOWNLOAD_CLASS,
      titleKey: "downloadCode",
      ariaKey: "downloadCodeAria",
      run: (block) => downloadCode(block)
    };
    var SEMANTIC_BUTTON = {
      cls: SEMANTIC_TOGGLE_CLASS,
      titleKey: "semanticToggle",
      ariaKey: "semanticToggleAria",
      run: (block, button2) => toggleSemanticView(block, button2)
    };
    var PLAIN_BUTTONS = [WRAP_BUTTON, DOWNLOAD_BUTTON];
    var MMD_BUTTONS = [
      { cls: ZOOM_OUT_CLASS, titleKey: "zoomOut", ariaKey: "zoomOutAria", run: (block) => zoomBy(block, 1 / ZOOM_STEP) },
      { cls: ZOOM_IN_CLASS, titleKey: "zoomIn", ariaKey: "zoomInAria", run: (block) => zoomBy(block, ZOOM_STEP) },
      {
        cls: TOGGLE_CLASS,
        titleKey: "toggle",
        ariaKey: "toggleAria",
        run: (block) => {
          var next = block.getAttribute(MMD_ATTR) === "code" ? "diagram" : "code";
          block.setAttribute(MMD_ATTR, next);
          var viewport = block.querySelector("." + MMD_CLASS + "-viewport");
          if (viewport !== null) {
            resetFold(viewport);
            scheduleFold(viewport, foldLimit("diagram"));
          }
        }
      },
      {
        cls: EXPAND_CLASS,
        titleKey: "fullscreen",
        ariaKey: "fullscreenAria",
        run: (block) => openFullscreen(block)
      },
      {
        cls: THEME_CLASS,
        titleKey: "theme",
        ariaKey: "themeAria",
        run: (block) => cycleMermaidTheme(block)
      },
      {
        cls: COPY_SOURCE_CLASS,
        titleKey: "copySource",
        ariaKey: "copySourceAria",
        run: (block, button2) => copyDiagramSource(block, button2)
      }
    ];
    var FAILED_BUTTONS = [
      {
        cls: RETRY_CLASS,
        titleKey: "retry",
        ariaKey: "retryAria",
        run: (block) => {
          cacheKeys.delete(block);
          block.removeAttribute(MMD_ATTR);
          block.querySelector("." + MMD_CLASS + "-error")?.remove();
          void enhance(block);
        }
      }
    ];
    function findNativeWrap(buttons) {
      if (buttons === void 0) return null;
      for (const button2 of buttons) {
        var label = (button2.getAttribute("aria-label") ?? "") + " " + (button2.title ?? "") + " " + (button2.textContent ?? "");
        if (/换行|wrap/i.test(label)) return button2;
      }
      return buttons.length >= 2 ? buttons[0] : null;
    }
    function decorate(block) {
      if (!block.isConnected) return;
      var banner = block.querySelector(BANNER);
      var nativeButtons = banner?.querySelectorAll("button:not(." + BTN_CLASS + ")");
      var copy = nativeButtons === void 0 || nativeButtons.length === 0 ? null : nativeButtons[nativeButtons.length - 1];
      var action = copy?.parentElement;
      if (action === null || action === void 0) return;
      var label = readBannerLabel(block);
      var lang = readLang(block);
      if (lang !== "" && isPlaceholderLabel(label)) paintLanguageLabel(block, lang);
      var hasNativeWrap = findNativeWrap(nativeButtons) !== null;
      var baseSpecs = hasNativeWrap ? [DOWNLOAD_BUTTON] : PLAIN_BUTTONS;
      if (semanticKindFor(lang) !== null) baseSpecs = [SEMANTIC_BUTTON].concat(baseSpecs);
      var specs = block.getAttribute(MMD_ATTR) === "failed" ? FAILED_BUTTONS : diagramKind(block) !== null ? MMD_BUTTONS : baseSpecs;
      for (const existing of action.querySelectorAll("." + BTN_CLASS)) {
        if (specs.some((spec) => existing.classList.contains(spec.cls))) continue;
        existing.remove();
        injected.delete(existing);
      }
      for (const spec of specs) {
        if (action.querySelector("." + spec.cls) !== null) continue;
        const created = document.createElement("button");
        created.type = "button";
        created.className = BTN_CLASS + " " + spec.cls;
        created.title = t(spec.titleKey);
        created.setAttribute("aria-label", t(spec.ariaKey));
        if (spec.cls === THEME_CLASS) {
          var themeText = themeLabel(getMermaidTheme());
          created.title = themeText;
          created.setAttribute("aria-label", themeText);
        }
        created.addEventListener("click", () => spec.run(block, created));
        action.insertBefore(created, copy);
        injected.add(created);
      }
    }
    function releaseTakenOver(block, content) {
      var host = content.querySelector("." + HOST_CLASS);
      if (host === null) return false;
      if (content.querySelector("pre.shiki:not(.md-plus-pre)") === null) return false;
      host.remove();
      cacheKeys.delete(block);
      block.removeAttribute(DONE_ATTR);
      return true;
    }
    async function enhance(block) {
      if (!block.isConnected) return;
      if (closestStreaming(block) !== null) return;
      var content = block.querySelector(CONTENT);
      if (content === null) return;
      if (releaseTakenOver(block, content)) return;
      var pre = content.querySelector("pre");
      if (pre === null || pre.classList.contains("shiki")) return;
      var lang = readLang(block);
      if (lang !== "" && isPlaceholderLabel(readBannerLabel(block))) paintLanguageLabel(block, lang);
      if (diagramKind(block) !== null) {
        await renderDiagram(block, content, pre);
        return;
      }
      if (lang === "") return;
      if (DSH_LANGS.has(lang)) return;
      var api = await loadScript(HL_URL, HL_GLOBAL);
      if (disposed || api === null || !api.supports(lang)) return;
      if (!pre.isConnected) return;
      var code = pre.textContent ?? "";
      if (code.trim() === "") return;
      var key = lang + "\0" + code;
      if (cacheKeys.get(block) === key) return;
      var html;
      try {
        html = await api.highlight(code, lang);
      } catch {
        return;
      }
      if (disposed) return;
      if (typeof html !== "string" || html === "") return;
      if (!pre.isConnected || (pre.textContent ?? "") !== code) {
        schedule(block);
        return;
      }
      apply(block, content, pre, html, key);
    }
    function apply(block, content, pre, html, key) {
      var host = document.createElement("div");
      host.className = HOST_CLASS;
      host.innerHTML = html;
      var shikiPre = host.querySelector("pre");
      if (shikiPre === null) return;
      shikiPre.classList.add("md-plus-pre");
      content.querySelector("." + HOST_CLASS)?.remove();
      resetFold(content);
      pre.after(host);
      cacheKeys.set(block, key);
      block.setAttribute(DONE_ATTR, "done");
      scheduleFold(content, foldLimit("code"));
    }
    function getMermaidTheme() {
      if (themeCache !== null) return themeCache;
      try {
        var saved = window.localStorage.getItem(THEME_KEY);
        if (saved !== null && THEME_ORDER.indexOf(saved) !== -1) {
          memoryTheme = saved;
          themeCache = saved;
          return saved;
        }
        memoryTheme = null;
      } catch {
        if (memoryTheme !== null) {
          themeCache = memoryTheme;
          return memoryTheme;
        }
      }
      themeCache = "blue";
      return "blue";
    }
    function themeLabel(name) {
      return t("themePrefix") + (THEME_LABELS[detectLang()][name] ?? name);
    }
    function refreshThemeButtons() {
      var label = themeLabel(getMermaidTheme());
      for (const button2 of document.querySelectorAll("." + THEME_CLASS)) {
        button2.title = label;
        button2.setAttribute("aria-label", label);
      }
    }
    function cycleMermaidTheme(block) {
      var current = getMermaidTheme();
      var index = THEME_ORDER.indexOf(current);
      var next = THEME_ORDER[(index + 1) % THEME_ORDER.length];
      memoryTheme = next;
      themeCache = next;
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
      }
      refreshThemeButtons();
      redrawDiagrams();
    }
    async function renderDiagram(block, content, pre) {
      var code = (pre.textContent ?? "").trim();
      if (code === "") return;
      var key = "mmd\0" + code;
      if (cacheKeys.get(block) === key) return;
      var api = await loadScript(MMD_URL, MMD_GLOBAL);
      if (disposed || api === null) return;
      if (!pre.isConnected) return;
      var svg;
      try {
        var dark = document.body.hasAttribute("data-ds-dark-theme");
        svg = await api.render("dsh-md-plus-mmd-" + ++diagramSeq, code, dark, getMermaidTheme());
      } catch (error) {
        if (disposed) return;
        failDiagram(block, content, pre, key, error);
        return;
      }
      if (disposed) return;
      if (typeof svg !== "string" || svg === "") return;
      if (svg.includes('aria-roledescription="error"')) {
        failDiagram(block, content, pre, key, new Error("mermaid \u8FD4\u56DE\u7684\u662F\u9519\u8BEF\u5361\u7247"));
        return;
      }
      if (!pre.isConnected || (pre.textContent ?? "").trim() !== code) {
        schedule(block);
        return;
      }
      applyDiagram(block, content, pre, svg, key);
    }
    function applyDiagram(block, content, pre, svg, key) {
      var host = content.querySelector("." + MMD_CLASS) ?? document.createElement("div");
      host.className = MMD_CLASS;
      host.innerHTML = '<div class="' + MMD_CLASS + '-viewport"><div class="' + MMD_CLASS + '-stage">' + svg + "</div></div>";
      var viewport = host.firstElementChild;
      if (viewport !== null) bindViewport(block, viewport);
      pre.before(host);
      content.querySelector("." + MMD_CLASS + "-error")?.remove();
      cacheKeys.set(block, key);
      var view = block.getAttribute(MMD_ATTR);
      if (view !== "code" && view !== "diagram") block.setAttribute(MMD_ATTR, readSettings().diagramView);
      zooms.delete(block);
      paint(block);
      scheduleFold(viewport, foldLimit("diagram"));
      decorate(block);
    }
    var zooms = /* @__PURE__ */ new WeakMap();
    function zoomState(block) {
      var state = zooms.get(block);
      if (state === void 0) {
        state = { scale: 1, x: 0, y: 0, min: ZOOM_MIN_INLINE };
        zooms.set(block, state);
      }
      return state;
    }
    function stageOf(block) {
      var stage = block.querySelector("." + MMD_CLASS + "-stage");
      return stage?.parentElement == null ? null : stage;
    }
    function paint(block) {
      var stage = stageOf(block);
      if (stage === null) return;
      var state = zoomState(block);
      stage.style.transform = "translate(" + state.x + "px," + state.y + "px) scale(" + state.scale + ")";
      stage.parentElement.setAttribute("data-zoomed", state.scale > 1.001 ? "on" : "off");
      block.setAttribute(
        ZOOM_ATTR,
        state.scale <= state.min + ZOOM_MIN_EPSILON ? "min" : state.scale >= ZOOM_MAX ? "max" : "mid"
      );
    }
    function clampPan(block, state) {
      var stage = stageOf(block);
      if (stage === null) return;
      var box = stage.parentElement.getBoundingClientRect();
      var width = stage.offsetWidth * state.scale;
      var height = stage.offsetHeight * state.scale;
      state.x = width <= box.width ? (box.width - width) / 2 : Math.min(0, Math.max(box.width - width, state.x));
      state.y = height <= box.height ? (box.height - height) / 2 : Math.min(0, Math.max(box.height - height, state.y));
    }
    function zoomBy(block, factor, clientX, clientY) {
      var stage = stageOf(block);
      if (stage === null) return;
      var state = zoomState(block);
      var next = Math.min(ZOOM_MAX, Math.max(state.min, state.scale * factor));
      if (Math.abs(next - state.scale) < 1e-3) return;
      var box = stage.parentElement.getBoundingClientRect();
      var anchorX = (clientX ?? box.left + box.width / 2) - box.left;
      var anchorY = (clientY ?? box.top + box.height / 2) - box.top;
      var ratio = next / state.scale;
      state.x = anchorX - (anchorX - state.x) * ratio;
      state.y = anchorY - (anchorY - state.y) * ratio;
      state.scale = next;
      clampPan(block, state);
      paint(block);
    }
    function bindViewport(block, viewport, resetView, alwaysZoom) {
      var drag = null;
      viewport.addEventListener(
        "wheel",
        (event) => {
          if (!alwaysZoom && !event.ctrlKey && !event.metaKey && zoomState(block).scale <= 1.001) return;
          event.preventDefault();
          zoomBy(block, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY);
        },
        { passive: false }
      );
      viewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || zoomState(block).scale <= 1.001) return;
        event.preventDefault();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch {
        }
        viewport.setAttribute("data-dragging", "on");
      });
      viewport.addEventListener("pointermove", (event) => {
        if (drag === null || event.pointerId !== drag.id) return;
        var state = zoomState(block);
        state.x += event.clientX - drag.x;
        state.y += event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
        clampPan(block, state);
        paint(block);
      });
      var stopDrag = (event) => {
        if (drag === null || event.pointerId !== drag.id) return;
        drag = null;
        try {
          viewport.releasePointerCapture(event.pointerId);
        } catch {
        }
        viewport.removeAttribute("data-dragging");
      };
      viewport.addEventListener("pointerup", stopDrag);
      viewport.addEventListener("pointercancel", stopDrag);
      viewport.addEventListener("dblclick", () => {
        if (resetView !== void 0) {
          resetView();
          return;
        }
        zooms.delete(block);
        paint(block);
      });
    }
    function resetFold(target) {
      if (target === null) return;
      var sync = foldSyncs.get(target);
      if (sync !== void 0) {
        target.removeEventListener("scroll", sync);
        foldSyncs.delete(target);
      }
      foldTargets.delete(target);
      if (foldTargets.size === 0) {
        if (foldResizeObserver !== null) {
          foldResizeObserver.disconnect();
          foldResizeObserver = null;
        }
        if (foldResizeHandler !== null) {
          window.removeEventListener("resize", foldResizeHandler);
          foldResizeHandler = null;
        }
      } else if (foldResizeObserver !== null) {
        foldResizeObserver.unobserve(target);
      }
      target.removeAttribute(FOLD_ATTR);
      target.classList.remove(FOLD_CLASS);
      target.style.removeProperty("--md-plus-fold-max-height");
      target.querySelector("." + FOLD_BTN_CLASS)?.remove();
    }
    function watchFoldTarget(target, sync) {
      foldSyncs.set(target, sync);
      foldTargets.add(target);
      if (typeof window.ResizeObserver === "function") {
        if (foldResizeObserver === null) {
          foldResizeObserver = new window.ResizeObserver((entries) => {
            for (const entry of entries) {
              var entryTarget = entry.target;
              var entrySync = foldSyncs.get(entryTarget);
              if (entrySync === void 0) continue;
              if (!entryTarget.isConnected) {
                resetFold(entryTarget);
                continue;
              }
              entrySync();
            }
          });
        }
        foldResizeObserver.observe(target);
        return;
      }
      if (foldResizeHandler === null) {
        foldResizeHandler = () => {
          for (const entryTarget of foldTargets) {
            if (!entryTarget.isConnected) {
              resetFold(entryTarget);
              continue;
            }
            foldSyncs.get(entryTarget)?.();
          }
        };
        window.addEventListener("resize", foldResizeHandler);
      }
    }
    function cleanupFoldTargets() {
      for (const target of foldTargets) {
        if (!target.isConnected) resetFold(target);
      }
    }
    function scheduleFold(target, limit) {
      if (target === null) return;
      if (!(limit > 0)) {
        resetFold(target);
        target.setAttribute(FOLD_ATTR, "none");
        return;
      }
      if (target.getAttribute(FOLD_ATTR) === "none") {
        if (target.scrollHeight <= limit) return;
        target.removeAttribute(FOLD_ATTR);
      }
      if (target.getAttribute(FOLD_ATTR) !== null) return;
      var schedule2 = window.requestAnimationFrame ?? ((cb) => window.setTimeout(cb, 0));
      schedule2(() => {
        if (disposed || !target.isConnected || target.getAttribute(FOLD_ATTR) !== null) return;
        if (target.scrollHeight <= limit) {
          target.setAttribute(FOLD_ATTR, "none");
          return;
        }
        target.setAttribute(FOLD_ATTR, "on");
        target.classList.add(FOLD_CLASS);
        target.style.setProperty("--md-plus-fold-max-height", limit + "px");
        if (target.hasAttribute(TABLE_DONE_ATTR)) target.scrollTop = 0;
        var button2 = document.createElement("button");
        button2.type = "button";
        button2.className = FOLD_BTN_CLASS;
        button2.textContent = t("foldOpen");
        button2.setAttribute("aria-expanded", "false");
        var sync = target.hasAttribute(TABLE_DONE_ATTR) ? () => {
          if (target.getAttribute(FOLD_ATTR) === "on") {
            button2.style.left = target.scrollLeft + target.clientWidth / 2 + "px";
          } else {
            button2.style.removeProperty("left");
          }
        } : null;
        if (sync !== null) {
          target.addEventListener("scroll", sync, { passive: true });
          watchFoldTarget(target, sync);
        }
        button2.addEventListener("click", () => {
          var folded = target.getAttribute(FOLD_ATTR) === "on";
          target.setAttribute(FOLD_ATTR, folded ? "off" : "on");
          if (target.hasAttribute(TABLE_DONE_ATTR)) target.scrollTop = 0;
          button2.textContent = folded ? t("foldClose") : t("foldOpen");
          button2.setAttribute("aria-expanded", folded ? "true" : "false");
          sync?.();
        });
        target.appendChild(button2);
        sync?.();
      });
    }
    function scanFolds() {
      var codeLimit = foldLimit("code");
      var tableLimit = foldLimit("table");
      for (const block of document.querySelectorAll(BLOCK)) {
        if (closestStreaming(block) !== null) continue;
        if (diagramKind(block) !== null) continue;
        scheduleFold(block.querySelector(CONTENT), codeLimit);
      }
      for (const table of document.querySelectorAll(TABLE)) {
        if (closestStreaming(table) !== null) continue;
        decorateTable(table);
        scheduleFold(table, tableLimit);
      }
    }
    function cellText(cell) {
      return (cell.textContent ?? "").replace(/\s+/g, " ").trim();
    }
    function tableRows(table) {
      return Array.from(table.rows).map((row) => Array.from(row.cells).map(cellText));
    }
    function tableToCsv(rows) {
      return rows.map(
        (row) => row.map((value) => /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value).join(",")
      ).join("\n");
    }
    function tableToTsv(rows) {
      return rows.map((row) => row.map((value) => value.replace(/\t/g, " ")).join("	")).join("\n");
    }
    function escapeHtml(text) {
      return text.replace(
        /[&<>"']/g,
        (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]
      );
    }
    function tableToHtml(rows) {
      if (rows.length === 0) return "";
      var cell = (tag, value) => "<" + tag + ">" + escapeHtml(value) + "</" + tag + ">";
      var header = "<thead><tr>" + rows[0].map((value) => cell("th", value)).join("") + "</tr></thead>";
      var body = rows.slice(1).map((row) => "<tr>" + row.map((value) => cell("td", value)).join("") + "</tr>");
      return "<table>" + header + (body.length === 0 ? "" : "<tbody>" + body.join("") + "</tbody>") + "</table>";
    }
    function tableToMarkdown(rows) {
      if (rows.length === 0) return "";
      var width = Math.max(...rows.map((row) => row.length));
      var line = (row) => "| " + row.concat(Array(width - row.length).fill("")).map((value) => value.replace(/\|/g, "\\|")).join(" | ") + " |";
      var output = [line(rows[0]), "| " + Array(width).fill("---").join(" | ") + " |"];
      for (var index = 1; index < rows.length; index += 1) output.push(line(rows[index]));
      return output.join("\n");
    }
    var CODE_EXTENSIONS = {
      bash: "sh",
      batch: "bat",
      c: "c",
      cpp: "cpp",
      csharp: "cs",
      css: "css",
      go: "go",
      html: "html",
      java: "java",
      javascript: "js",
      json: "json",
      jsx: "jsx",
      kotlin: "kt",
      markdown: "md",
      mermaid: "mmd",
      php: "php",
      python: "py",
      ruby: "rb",
      rust: "rs",
      shell: "sh",
      shellscript: "sh",
      sql: "sql",
      swift: "swift",
      tsx: "tsx",
      typescript: "ts",
      xml: "xml",
      yaml: "yml",
      yml: "yml"
    };
    async function copyText(text) {
      if (window.navigator.clipboard !== void 0 && typeof window.navigator.clipboard.writeText === "function") {
        try {
          await window.navigator.clipboard.writeText(text);
          return true;
        } catch {
        }
      }
      var area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      area.remove();
      return ok;
    }
    async function copyRichText(text, html) {
      if (window.navigator.clipboard !== void 0 && typeof window.navigator.clipboard.write === "function" && typeof window.ClipboardItem === "function") {
        try {
          await window.navigator.clipboard.write([
            new window.ClipboardItem({
              "text/plain": new Blob([text], { type: "text/plain" }),
              "text/html": new Blob([html], { type: "text/html" })
            })
          ]);
          return true;
        } catch {
        }
      }
      return copyText(text);
    }
    async function copyDiagramSource(block, button2) {
      var pre = block.querySelector(CONTENT + " pre");
      if (pre === null) return;
      var ok = false;
      try {
        ok = await copyText(pre.textContent ?? "");
      } catch {
        ok = false;
      }
      if (button2 !== void 0) {
        var original = button2.title;
        var label = ok ? t("copied") : t("copyFailed");
        button2.title = label;
        button2.setAttribute("aria-label", label);
        window.setTimeout(() => {
          button2.title = original;
          button2.setAttribute("aria-label", original);
        }, 1200);
      }
    }
    function downloadCode(block) {
      var pre = block.querySelector(CONTENT + " pre");
      if (pre === null) return;
      var lang = readLang(block);
      var ext = CODE_EXTENSIONS[lang] ?? "txt";
      try {
        downloadBlob(
          new Blob([pre.textContent ?? ""], { type: "text/plain;charset=utf-8" }),
          "code-snippet." + ext
        );
      } catch (error) {
        console.warn("[dsh-md-plus] \u4EE3\u7801\u4E0B\u8F7D\u5931\u8D25", error);
      }
    }
    function flashButton(button2, text) {
      var original = button2.getAttribute("data-md-plus-label") ?? button2.textContent;
      button2.setAttribute("data-md-plus-label", original);
      button2.textContent = text;
      window.setTimeout(() => {
        button2.textContent = original;
      }, 1200);
    }
    function semanticText(block) {
      var pre = block.querySelector(CONTENT + " pre");
      return pre === null ? "" : pre.textContent ?? "";
    }
    function semanticKindOf(block) {
      if (semanticKindCache.has(block)) return semanticKindCache.get(block);
      var kind = semanticKindFor(readLang(block));
      semanticKindCache.set(block, kind);
      return kind;
    }
    function semanticNotice(text) {
      var root = document.createElement("div");
      root.className = SEMANTIC_CLASS;
      var note = document.createElement("div");
      note.className = SEMANTIC_CLASS + "-empty";
      note.textContent = text;
      root.appendChild(note);
      return root;
    }
    function ensureSemanticView(block) {
      var kind = semanticKindOf(block);
      if (kind === null) return null;
      var text = semanticText(block);
      var previous = semanticStates.get(block);
      if (previous !== void 0 && previous.kind === kind && previous.text === text && previous.root.isConnected) {
        return previous;
      }
      previous?.root.remove();
      var root;
      if (text.length > SEMANTIC_MAX_SOURCE) {
        root = semanticNotice(t("semanticTooLarge"));
      } else {
        try {
          root = buildSemanticView(document, kind, text, t);
        } catch (error) {
          console.warn("[dsh-md-plus] \u8BED\u4E49\u89C6\u56FE\u6784\u5EFA\u5931\u8D25", error);
          return { error: true };
        }
      }
      var content = block.querySelector(CONTENT);
      if (content === null) return { error: true };
      content.appendChild(root);
      var state = { kind, text, root };
      semanticStates.set(block, state);
      return state;
    }
    function enhanceSemantic(block) {
      if (!block.isConnected || closestStreaming(block) !== null) return;
      if (semanticKindOf(block) === null) return;
      var mode = block.getAttribute(SEMANTIC_ATTR);
      if (mode === null) {
        if (block.getAttribute(SEMANTIC_MANUAL_ATTR) === "1") return;
        if (readSettings().semanticDefaultView !== "semantic") return;
        block.setAttribute(SEMANTIC_ATTR, "on");
        mode = "on";
      }
      if (mode !== "on") return;
      var state = ensureSemanticView(block);
      if (state === null || state.error) {
        if (block.querySelector(CONTENT) === null) block.removeAttribute(SEMANTIC_ATTR);
        else block.setAttribute(SEMANTIC_ATTR, "off");
      }
    }
    function flashButtonTitle(button2, text) {
      var original = button2.getAttribute("data-md-plus-semantic-original-title") ?? button2.title;
      if (!button2.hasAttribute("data-md-plus-semantic-original-title")) {
        button2.setAttribute("data-md-plus-semantic-original-title", original);
      }
      button2.title = text;
      button2.setAttribute("aria-label", text);
      window.setTimeout(() => {
        button2.title = original;
        button2.setAttribute("aria-label", original);
      }, 1600);
    }
    function toggleSemanticView(block, button2) {
      var content = block.querySelector(CONTENT);
      if (block.getAttribute(SEMANTIC_ATTR) === "on") {
        block.setAttribute(SEMANTIC_ATTR, "off");
        block.setAttribute(SEMANTIC_MANUAL_ATTR, "1");
        if (content !== null) {
          resetFold(content);
          scheduleFold(content, foldLimit("code"));
        }
        return;
      }
      var state = ensureSemanticView(block);
      if (state === null || state.error) {
        flashButtonTitle(button2, t("semanticRenderFailed"));
        return;
      }
      block.setAttribute(SEMANTIC_ATTR, "on");
      block.setAttribute(SEMANTIC_MANUAL_ATTR, "1");
      if (content !== null) {
        resetFold(content);
        scheduleFold(content, foldLimit("code"));
      }
    }
    function applySemanticSettings() {
      var mode = readSettings().semanticDefaultView;
      for (const block of document.querySelectorAll(BLOCK)) {
        if (closestStreaming(block) !== null) continue;
        if (semanticKindOf(block) === null) continue;
        if (block.getAttribute(SEMANTIC_MANUAL_ATTR) === "1") continue;
        var content = block.querySelector(CONTENT);
        if (mode === "semantic") {
          var state = ensureSemanticView(block);
          if (state !== null && !state.error) block.setAttribute(SEMANTIC_ATTR, "on");
          else block.setAttribute(SEMANTIC_ATTR, "off");
        } else {
          block.setAttribute(SEMANTIC_ATTR, "off");
        }
        if (content !== null) {
          resetFold(content);
          scheduleFold(content, foldLimit("code"));
        }
      }
    }
    function clearTableFreeze(table) {
      for (const cell of table.querySelectorAll(
        "." + FREEZE_ROW_CLASS + ",." + FREEZE_COL_CLASS + ",." + FREEZE_CROSS_CLASS
      )) {
        cell.classList.remove(FREEZE_ROW_CLASS, FREEZE_COL_CLASS, FREEZE_CROSS_CLASS);
        cell.style.removeProperty("top");
        cell.style.removeProperty("left");
      }
    }
    function observeTableFreeze(table) {
      if (tableFreezeTargets.has(table)) return;
      tableFreezeTargets.add(table);
      if (typeof window.ResizeObserver !== "function") return;
      if (tableFreezeObserver === null) {
        tableFreezeObserver = new window.ResizeObserver((entries) => {
          for (const entry of entries) {
            if (!entry.target.isConnected) {
              cleanupTableFreezeTargets();
              continue;
            }
            applyTableFreeze(entry.target);
          }
        });
      }
      tableFreezeObserver.observe(table);
    }
    function applyTableFreeze(table) {
      var dataTable = table.querySelector("table");
      if (dataTable === null) return;
      var settings = readSettings();
      var freezeRows = Math.max(0, Math.min(5, Number(settings.freezeRows) || 0));
      var freezeCols = Math.max(0, Math.min(5, Number(settings.freezeCols) || 0));
      var width = dataTable.scrollWidth;
      var height = dataTable.scrollHeight;
      var hasFrozenCells = dataTable.querySelector("." + FREEZE_ROW_CLASS + ",." + FREEZE_COL_CLASS) !== null;
      var state = tableFreezeState.get(table);
      if (state !== void 0 && state.rows === freezeRows && state.cols === freezeCols && state.width === width && state.height === height && (freezeRows === 0 && freezeCols === 0 || hasFrozenCells)) {
        return;
      }
      clearTableFreeze(table);
      tableFreezeState.set(table, { rows: freezeRows, cols: freezeCols, width, height });
      if (freezeRows === 0 && freezeCols === 0) return;
      var rows = Array.from(dataTable.rows);
      var top = 0;
      for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        var row = rows[rowIndex];
        var cells = Array.from(row.cells);
        var frozenRow = rowIndex < freezeRows;
        if (frozenRow) {
          for (const cell2 of cells) cell2.classList.add(FREEZE_ROW_CLASS);
        }
        var left = 0;
        for (var cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
          var cell = cells[cellIndex];
          if (frozenRow) cell.style.top = top + "px";
          if (cellIndex < freezeCols) {
            cell.classList.add(FREEZE_COL_CLASS);
            if (frozenRow) cell.classList.add(FREEZE_CROSS_CLASS);
            cell.style.left = left + "px";
            left += cell.getBoundingClientRect().width;
          }
        }
        if (frozenRow) top += row.getBoundingClientRect().height;
      }
      observeTableFreeze(table);
    }
    function cleanupTableFreezeTargets() {
      for (const table of tableFreezeTargets) {
        if (table.isConnected) continue;
        if (tableFreezeObserver !== null) tableFreezeObserver.unobserve(table);
        tableFreezeTargets.delete(table);
        tableFreezeState.delete(table);
      }
    }
    function applyTableFreezeSettings() {
      tableFreezeState = /* @__PURE__ */ new WeakMap();
      for (const table of document.querySelectorAll(TABLE)) applyTableFreeze(table);
    }
    function decorateTable(table) {
      var dataTable = table.querySelector("table");
      if (dataTable === null) return;
      applyTableFreeze(table);
      var first = dataTable.firstElementChild;
      if (first !== null && first.classList.contains(TABLE_TOOLS_CLASS)) return;
      table.setAttribute(TABLE_DONE_ATTR, "1");
      var tools = document.createElement("caption");
      tools.className = TABLE_TOOLS_CLASS;
      var group = document.createElement("span");
      group.className = TABLE_TOOLS_CLASS + "-group";
      for (const [kind, label, titleKey, convert, rich] of [
        ["csv", t("tableCsv"), "copyCsvTitle", tableToCsv, false],
        ["tsv", t("tableTsv"), "copyTsvTitle", tableToTsv, false],
        ["md", t("tableMd"), "copyMdTitle", tableToMarkdown, false],
        ["html", t("tableHtml"), "copyHtmlTitle", tableToHtml, true]
      ]) {
        const button2 = document.createElement("button");
        button2.type = "button";
        button2.textContent = label;
        button2.title = t(titleKey);
        button2.setAttribute("aria-label", t(titleKey));
        button2.addEventListener("click", async () => {
          var ok = false;
          try {
            var rows = tableRows(dataTable);
            ok = rich ? await copyRichText(tableToTsv(rows), convert(rows)) : await copyText(convert(rows));
          } catch {
            ok = false;
          }
          flashButton(button2, ok ? t("copied") : t("copyFailed"));
        });
        group.appendChild(button2);
      }
      tools.appendChild(group);
      dataTable.insertBefore(tools, dataTable.firstChild);
    }
    var scrollLocks = 0;
    var previousRootOverflow = "";
    function lockPageScroll() {
      if (scrollLocks === 0) {
        previousRootOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
      }
      scrollLocks += 1;
    }
    function unlockPageScroll() {
      if (scrollLocks === 0) return;
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        document.documentElement.style.overflow = previousRootOverflow;
        previousRootOverflow = "";
      }
    }
    function trapFocus(container) {
      function onKey(event) {
        if (event.key !== "Tab") return;
        var candidates = Array.from(
          container.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((node) => node.offsetParent !== null || node === document.activeElement);
        if (candidates.length === 0) {
          event.preventDefault();
          return;
        }
        var first = candidates[0];
        var last = candidates[candidates.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      container.addEventListener("keydown", onKey, true);
      return () => container.removeEventListener("keydown", onKey, true);
    }
    function openImage(source, alt) {
      if (document.querySelector("." + IMG_MODAL_CLASS) !== null) return;
      var overlay = document.createElement("div");
      overlay.className = IMG_MODAL_CLASS;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", t("imageViewer"));
      var image = document.createElement("img");
      image.src = source;
      image.alt = alt;
      var closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = IMG_MODAL_CLASS + "-close";
      closeButton.textContent = "\xD7";
      closeButton.setAttribute("aria-label", t("imageClose"));
      var previousFocus = document.activeElement;
      var releaseFocus = null;
      var closed = false;
      function closeViewer() {
        if (closed) return;
        closed = true;
        releaseFocus?.();
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        unlockPageScroll();
        if (previousFocus !== null && typeof previousFocus.focus === "function") previousFocus.focus();
      }
      function onKey(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeViewer();
        }
      }
      overlay.addEventListener("pointerdown", (event) => {
        if (event.target === overlay) closeViewer();
      });
      closeButton.addEventListener("click", closeViewer);
      document.addEventListener("keydown", onKey, true);
      overlay.appendChild(image);
      overlay.appendChild(closeButton);
      lockPageScroll();
      document.body.appendChild(overlay);
      releaseFocus = trapFocus(overlay);
      closeButton.focus();
    }
    function onDocumentClick(event) {
      if (event.button !== void 0 && event.button !== 0) return;
      var target = event.target;
      var image = target?.closest?.("img");
      if (image === null || image === void 0) return;
      if (image.closest("." + IMG_MODAL_CLASS + ", .md-code-block, ." + SETTINGS_MODAL_CLASS) !== null) return;
      if (image.closest('[class*="_markdown_"]') === null) return;
      if (image.closest(NATIVE_IMAGE_BUTTON) !== null || image.closest("a") !== null) return;
      event.preventDefault();
      openImage(image.currentSrc || image.src, image.alt || "");
    }
    function settingRow(labelText, control, hintText) {
      var row = document.createElement("div");
      row.className = SETTINGS_MODAL_CLASS + "-row";
      var label = document.createElement("span");
      label.className = SETTINGS_MODAL_CLASS + "-label";
      var title = document.createElement("span");
      title.className = SETTINGS_MODAL_CLASS + "-label-title";
      title.textContent = labelText;
      label.appendChild(title);
      if (hintText !== void 0) {
        var hint = document.createElement("span");
        hint.className = SETTINGS_MODAL_CLASS + "-label-hint";
        hint.textContent = hintText;
        label.appendChild(hint);
      }
      row.appendChild(label);
      row.appendChild(control);
      return row;
    }
    function numberInput(value, min, max) {
      var input = document.createElement("input");
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.value = value > 0 ? String(value) : "";
      input.placeholder = "0";
      return input;
    }
    function rescanFolds() {
      diagramKindCache = /* @__PURE__ */ new WeakMap();
      semanticKindCache = /* @__PURE__ */ new WeakMap();
      var codeLimit = foldLimit("code");
      var tableLimit = foldLimit("table");
      var diagramLimit = foldLimit("diagram");
      for (const node of document.querySelectorAll("[" + FOLD_ATTR + "]")) {
        if (node.classList.contains(MMD_CLASS + "-viewport")) continue;
        var limit = node.hasAttribute(TABLE_DONE_ATTR) ? tableLimit : codeLimit;
        if (node.getAttribute(FOLD_ATTR) === "off" && limit > 0) {
          node.style.setProperty("--md-plus-fold-max-height", limit + "px");
          continue;
        }
        resetFold(node);
      }
      for (const viewport of document.querySelectorAll("." + MMD_CLASS + "-viewport")) {
        if (viewport.getAttribute(FOLD_ATTR) === "off" && diagramLimit > 0) {
          viewport.style.setProperty("--md-plus-fold-max-height", diagramLimit + "px");
          continue;
        }
        resetFold(viewport);
        scheduleFold(viewport, diagramLimit);
      }
      scanFolds();
    }
    function setFoldExpanded(target, expanded) {
      var state = target.getAttribute(FOLD_ATTR);
      if (state !== "on" && state !== "off") return;
      target.setAttribute(FOLD_ATTR, expanded ? "off" : "on");
      if (target.hasAttribute(TABLE_DONE_ATTR)) target.scrollTop = 0;
      var button2 = target.querySelector("." + FOLD_BTN_CLASS);
      if (button2 !== null) {
        button2.textContent = expanded ? t("foldClose") : t("foldOpen");
        button2.setAttribute("aria-expanded", expanded ? "true" : "false");
      }
      foldSyncs.get(target)?.();
    }
    function setAllFolds(expanded) {
      for (const target of document.querySelectorAll("[" + FOLD_ATTR + "]")) {
        setFoldExpanded(target, expanded);
      }
    }
    function exportSettings() {
      try {
        var payload = { settings: readSettings(), mermaidTheme: getMermaidTheme() };
        downloadBlob(
          new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
          "dsh-md-plus-settings.json"
        );
      } catch (error) {
        console.warn("[dsh-md-plus] \u8BBE\u7F6E\u5BFC\u51FA\u5931\u8D25", error);
      }
    }
    function openSettings() {
      if (document.querySelector("." + SETTINGS_MODAL_CLASS) !== null) return;
      var current = readSettings();
      var overlay = document.createElement("div");
      overlay.className = SETTINGS_MODAL_CLASS;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", t("settingsTitle"));
      var panel = document.createElement("div");
      panel.className = SETTINGS_MODAL_CLASS + "-panel";
      var title = document.createElement("h2");
      title.className = SETTINGS_MODAL_CLASS + "-title";
      title.textContent = t("settingsTitle");
      panel.appendChild(title);
      var themeSelect = document.createElement("select");
      for (const name of THEME_ORDER) {
        var option = document.createElement("option");
        option.value = name;
        option.textContent = THEME_LABELS[detectLang()][name] ?? name;
        themeSelect.appendChild(option);
      }
      themeSelect.value = getMermaidTheme();
      panel.appendChild(settingRow(t("settingsTheme"), themeSelect));
      var fontInput = numberInput(current.codeFontSize, 10, 20);
      panel.appendChild(
        settingRow(t("settingsFontSize"), fontInput, t("settingsFontSizeHint"))
      );
      var viewSelect = document.createElement("select");
      for (const [value, label] of [
        ["diagram", t("settingsViewDiagram")],
        ["code", t("settingsViewCode")]
      ]) {
        var viewOption = document.createElement("option");
        viewOption.value = value;
        viewOption.textContent = label;
        viewSelect.appendChild(viewOption);
      }
      viewSelect.value = current.diagramView;
      panel.appendChild(settingRow(t("settingsView"), viewSelect));
      var semanticSelect = document.createElement("select");
      for (const [value, label] of [
        ["source", t("settingsSemanticSource")],
        ["semantic", t("settingsSemanticView")]
      ]) {
        var semanticOption = document.createElement("option");
        semanticOption.value = value;
        semanticOption.textContent = label;
        semanticSelect.appendChild(semanticOption);
      }
      semanticSelect.value = current.semanticDefaultView;
      panel.appendChild(settingRow(t("settingsSemantic"), semanticSelect, t("settingsSemanticHint")));
      var foldHint = document.createElement("p");
      foldHint.className = SETTINGS_MODAL_CLASS + "-section";
      foldHint.textContent = t("settingsFold") + " \xB7 " + t("settingsFoldHint");
      panel.appendChild(foldHint);
      var foldCode = numberInput(current.foldCode, 0, 4e3);
      var foldTable = numberInput(current.foldTable, 0, 4e3);
      var foldDiagram = numberInput(current.foldDiagram, 0, 4e3);
      panel.appendChild(settingRow(t("settingsFoldCode"), foldCode, t("settingsFoldCodeHint")));
      panel.appendChild(settingRow(t("settingsFoldTable"), foldTable, t("settingsFoldTableHint")));
      panel.appendChild(settingRow(t("settingsFoldDiagram"), foldDiagram, t("settingsFoldDiagramHint")));
      var freezeRowsInput = numberInput(current.freezeRows, 0, 5);
      var freezeColsInput = numberInput(current.freezeCols, 0, 5);
      panel.appendChild(
        settingRow(t("settingsFreezeRows"), freezeRowsInput, t("settingsFreezeRowsHint"))
      );
      panel.appendChild(
        settingRow(t("settingsFreezeCols"), freezeColsInput, t("settingsFreezeColsHint"))
      );
      var foldActions = document.createElement("div");
      foldActions.className = SETTINGS_MODAL_CLASS + "-fold-actions";
      foldActions.setAttribute("role", "group");
      foldActions.setAttribute("aria-label", t("settingsFoldGroup"));
      var foldLabel = document.createElement("span");
      foldLabel.className = SETTINGS_MODAL_CLASS + "-utility-label";
      foldLabel.textContent = t("settingsFoldGroup");
      var foldSegment = document.createElement("span");
      foldSegment.className = SETTINGS_MODAL_CLASS + "-segment";
      var expandAllButton = document.createElement("button");
      expandAllButton.type = "button";
      expandAllButton.textContent = t("foldExpandAll");
      var collapseAllButton = document.createElement("button");
      collapseAllButton.type = "button";
      collapseAllButton.textContent = t("foldCollapseAll");
      foldSegment.appendChild(expandAllButton);
      foldSegment.appendChild(collapseAllButton);
      foldActions.appendChild(foldLabel);
      foldActions.appendChild(foldSegment);
      var transferActions = document.createElement("div");
      transferActions.className = SETTINGS_MODAL_CLASS + "-transfer-actions";
      transferActions.setAttribute("role", "group");
      transferActions.setAttribute("aria-label", t("settingsFileGroup"));
      var transferLabel = document.createElement("span");
      transferLabel.className = SETTINGS_MODAL_CLASS + "-utility-label";
      transferLabel.textContent = t("settingsFileGroup");
      var transferSegment = document.createElement("span");
      transferSegment.className = SETTINGS_MODAL_CLASS + "-segment";
      var exportButton = document.createElement("button");
      exportButton.type = "button";
      exportButton.textContent = t("settingsExport");
      var importButton = document.createElement("button");
      importButton.type = "button";
      importButton.textContent = t("settingsImport");
      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.style.display = "none";
      transferSegment.appendChild(exportButton);
      transferSegment.appendChild(importButton);
      transferActions.appendChild(transferLabel);
      transferActions.appendChild(transferSegment);
      var actions = document.createElement("div");
      actions.className = SETTINGS_MODAL_CLASS + "-actions";
      var resetButton = document.createElement("button");
      resetButton.type = "button";
      resetButton.textContent = t("settingsReset");
      var closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.textContent = t("settingsClose");
      var saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = SETTINGS_MODAL_CLASS + "-primary";
      saveButton.textContent = t("settingsSave");
      actions.appendChild(resetButton);
      actions.appendChild(closeButton);
      actions.appendChild(saveButton);
      var utilities = document.createElement("div");
      utilities.className = SETTINGS_MODAL_CLASS + "-utilities";
      utilities.appendChild(foldActions);
      utilities.appendChild(transferActions);
      var footer = document.createElement("div");
      footer.className = SETTINGS_MODAL_CLASS + "-footer";
      footer.appendChild(utilities);
      footer.appendChild(actions);
      panel.appendChild(footer);
      panel.appendChild(fileInput);
      overlay.appendChild(panel);
      var previousFocus = document.activeElement;
      var releaseFocus = null;
      var closed = false;
      function closeSettings() {
        if (closed) return;
        closed = true;
        releaseFocus?.();
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        unlockPageScroll();
        if (previousFocus !== null && typeof previousFocus.focus === "function") previousFocus.focus();
      }
      function onKey(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeSettings();
        }
      }
      function readNumber(input, fallback, max) {
        var value = Number(input.value);
        return Number.isFinite(value) && value >= 0 ? Math.min(max ?? 4e3, Math.round(value)) : fallback;
      }
      function readFontSize(input) {
        var value = Number(input.value);
        if (!Number.isFinite(value) || value <= 0) return 0;
        return Math.min(20, Math.max(10, Math.round(value)));
      }
      function importSettingsFile(file) {
        file.text().then((text) => {
          var parsed = JSON.parse(text);
          var source = parsed !== null && typeof parsed === "object" && parsed.settings !== null && typeof parsed.settings === "object" ? parsed.settings : parsed;
          if (source === null || typeof source !== "object") throw new Error("\u8BBE\u7F6E\u683C\u5F0F\u65E0\u6548");
          var font = Number(source.codeFontSize);
          if (Number.isFinite(font)) {
            fontInput.value = font > 0 ? String(Math.min(20, Math.max(10, Math.round(font)))) : "";
          }
          for (const [key, input, max] of [
            ["foldCode", foldCode, 4e3],
            ["foldTable", foldTable, 4e3],
            ["foldDiagram", foldDiagram, 4e3],
            ["freezeRows", freezeRowsInput, 5],
            ["freezeCols", freezeColsInput, 5]
          ]) {
            var value = Number(source[key]);
            if (Number.isFinite(value) && value >= 0) {
              input.value = String(Math.min(max, Math.round(value)));
            }
          }
          if (source.diagramView === "code" || source.diagramView === "diagram") {
            viewSelect.value = source.diagramView;
          }
          if (source.semanticDefaultView === "source" || source.semanticDefaultView === "semantic") {
            semanticSelect.value = source.semanticDefaultView;
          }
          var theme = parsed !== null && typeof parsed === "object" ? parsed.mermaidTheme : null;
          if (typeof theme === "string" && THEME_ORDER.indexOf(theme) !== -1) {
            themeSelect.value = theme;
          }
          saveButton.click();
        }).catch(() => {
          flashButton(importButton, t("settingsImportFailed"));
        });
      }
      exportButton.addEventListener("click", exportSettings);
      importButton.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => {
        var file = fileInput.files?.[0];
        if (file !== null && file !== void 0) importSettingsFile(file);
        fileInput.value = "";
      });
      expandAllButton.addEventListener("click", () => setAllFolds(true));
      collapseAllButton.addEventListener("click", () => setAllFolds(false));
      resetButton.addEventListener("click", () => {
        themeSelect.value = "blue";
        fontInput.value = "";
        viewSelect.value = DEFAULT_SETTINGS.diagramView;
        semanticSelect.value = DEFAULT_SETTINGS.semanticDefaultView;
        foldCode.value = String(DEFAULT_SETTINGS.foldCode);
        foldTable.value = String(DEFAULT_SETTINGS.foldTable);
        foldDiagram.value = String(DEFAULT_SETTINGS.foldDiagram);
        freezeRowsInput.value = String(DEFAULT_SETTINGS.freezeRows);
        freezeColsInput.value = String(DEFAULT_SETTINGS.freezeCols);
      });
      saveButton.addEventListener("click", () => {
        var previous = readSettings();
        var previousTheme = getMermaidTheme();
        var nextTheme = THEME_ORDER.indexOf(themeSelect.value) === -1 ? "blue" : themeSelect.value;
        var next = {
          codeFontSize: readFontSize(fontInput),
          diagramView: viewSelect.value === "code" ? "code" : "diagram",
          semanticDefaultView: semanticSelect.value === "semantic" ? "semantic" : "source",
          foldCode: readNumber(foldCode, DEFAULT_SETTINGS.foldCode),
          foldTable: readNumber(foldTable, DEFAULT_SETTINGS.foldTable),
          foldDiagram: readNumber(foldDiagram, DEFAULT_SETTINGS.foldDiagram),
          freezeRows: readNumber(freezeRowsInput, DEFAULT_SETTINGS.freezeRows, 5),
          freezeCols: readNumber(freezeColsInput, DEFAULT_SETTINGS.freezeCols, 5)
        };
        saveSettings(next);
        memoryTheme = nextTheme;
        themeCache = nextTheme;
        try {
          window.localStorage.setItem(THEME_KEY, nextTheme);
        } catch {
        }
        applyCodeFontSize();
        applyTableFreezeSettings();
        if (previous.semanticDefaultView !== next.semanticDefaultView) applySemanticSettings();
        refreshThemeButtons();
        if (previousTheme !== nextTheme) redrawDiagrams();
        if (previous.codeFontSize !== next.codeFontSize || previous.foldCode !== next.foldCode || previous.foldTable !== next.foldTable || previous.foldDiagram !== next.foldDiagram) {
          rescanFolds();
        }
        closeSettings();
      });
      closeButton.addEventListener("click", closeSettings);
      overlay.addEventListener("pointerdown", (event) => {
        if (event.target === overlay) closeSettings();
      });
      document.addEventListener("keydown", onKey, true);
      lockPageScroll();
      document.body.appendChild(overlay);
      releaseFocus = trapFocus(overlay);
      saveButton.focus();
    }
    function ensureSettingsButton() {
      var existing = document.querySelector("." + SETTINGS_BTN_CLASS);
      if (document.querySelector('[class*="_markdown_"], .md-code-block') === null) {
        existing?.remove();
        return;
      }
      if (existing !== null) return;
      var button2 = document.createElement("button");
      button2.type = "button";
      button2.className = SETTINGS_BTN_CLASS;
      button2.title = t("settingsOpen");
      button2.setAttribute("aria-label", t("settingsOpen"));
      button2.addEventListener("click", openSettings);
      document.body.appendChild(button2);
    }
    function fitToView(scope) {
      var stage = stageOf(scope);
      if (stage === null) return;
      var box = stage.parentElement.getBoundingClientRect();
      var svg = stage.querySelector("svg");
      var width = stage.offsetWidth || parseFloat(svg?.getAttribute("width") ?? "") || 0;
      var height = stage.offsetHeight || parseFloat(svg?.getAttribute("height") ?? "") || 0;
      if (box.width <= 0 || box.height <= 0 || width <= 0 || height <= 0) return;
      var state = zoomState(scope);
      var scale = Math.min(1, (box.width - 32) / width, (box.height - 32) / height);
      state.scale = Math.max(state.min, scale);
      state.x = 0;
      state.y = 0;
      clampPan(scope, state);
      paint(scope);
    }
    function svgSize(svg) {
      var box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
      if (box.length === 4 && box[2] > 0 && box[3] > 0) {
        return { width: box[2], height: box[3] };
      }
      var rect = svg.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }
    function serializeSvg(svg) {
      var clone = svg.cloneNode(true);
      var size = svgSize(svg);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (!clone.getAttribute("xmlns:xlink")) {
        clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      }
      if (size.width > 0) clone.setAttribute("width", String(size.width));
      if (size.height > 0) clone.setAttribute("height", String(size.height));
      return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    }
    function downloadBlob(blob, filename) {
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
    }
    function exportFailed(button2, error) {
      console.warn("[dsh-md-plus] \u56FE\u8868\u5BFC\u51FA\u5931\u8D25", error);
      if (button2 !== void 0) flashButton(button2, t("exportFailed"));
    }
    function downloadSvg(svg, button2) {
      try {
        downloadBlob(new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" }), "mermaid-diagram.svg");
      } catch (error) {
        exportFailed(button2, error);
      }
    }
    function downloadPng(svg, button2) {
      var size = svgSize(svg);
      if (size.width <= 0 || size.height <= 0) {
        exportFailed(button2, new Error("\u56FE\u8868\u5C3A\u5BF8\u65E0\u6548"));
        return;
      }
      var image = new window.Image();
      var objectUrl = "";
      image.onload = function() {
        try {
          var scale = Math.min(2, 4096 / Math.max(size.width, size.height));
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(size.width * scale));
          canvas.height = Math.max(1, Math.round(size.height * scale));
          var context = canvas.getContext("2d");
          if (context === null) throw new Error("canvas \u4E0D\u53EF\u7528");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob !== null) downloadBlob(blob, "mermaid-diagram.png");
            else exportFailed(button2, new Error("canvas \u672A\u751F\u6210\u56FE\u7247"));
          }, "image/png");
        } catch (error) {
          exportFailed(button2, error);
        } finally {
          if (objectUrl !== "") URL.revokeObjectURL(objectUrl);
        }
      };
      image.onerror = function() {
        if (objectUrl !== "") URL.revokeObjectURL(objectUrl);
        exportFailed(button2, new Error("SVG \u65E0\u6CD5\u8F7D\u5165"));
      };
      objectUrl = URL.createObjectURL(new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" }));
      image.src = objectUrl;
    }
    function openFullscreen(block) {
      if (document.querySelector("." + MODAL_CLASS) !== null) return;
      var svg = block.querySelector("." + MMD_CLASS + " svg");
      if (svg === null) return;
      var size = svgSize(svg);
      var overlay = document.createElement("div");
      overlay.className = MODAL_CLASS;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", t("diagramAria"));
      var panel = document.createElement("div");
      panel.className = MODAL_CLASS + "-panel";
      var bar = document.createElement("div");
      bar.className = MODAL_CLASS + "-bar";
      var title = document.createElement("div");
      title.className = MODAL_CLASS + "-title";
      title.textContent = t("diagram");
      var actions = document.createElement("div");
      actions.className = MODAL_CLASS + "-actions";
      var fitButton = document.createElement("button");
      fitButton.type = "button";
      fitButton.textContent = t("fit");
      var svgButton = document.createElement("button");
      svgButton.type = "button";
      svgButton.textContent = t("downloadSvg");
      var pngButton = document.createElement("button");
      pngButton.type = "button";
      pngButton.textContent = t("downloadPng");
      var zoomOut = document.createElement("button");
      zoomOut.type = "button";
      zoomOut.textContent = "\u2212";
      zoomOut.setAttribute("aria-label", t("zoomOutAria"));
      var zoomIn = document.createElement("button");
      zoomIn.type = "button";
      zoomIn.textContent = "+";
      zoomIn.setAttribute("aria-label", t("zoomInAria"));
      var closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.textContent = t("close");
      actions.appendChild(fitButton);
      actions.appendChild(svgButton);
      actions.appendChild(pngButton);
      actions.appendChild(zoomOut);
      actions.appendChild(zoomIn);
      actions.appendChild(closeButton);
      bar.appendChild(title);
      bar.appendChild(actions);
      panel.appendChild(bar);
      var body = document.createElement("div");
      body.className = MODAL_CLASS + "-body";
      var viewport = document.createElement("div");
      viewport.className = MMD_CLASS + "-viewport " + MODAL_CLASS + "-viewport";
      var stage = document.createElement("div");
      stage.className = MMD_CLASS + "-stage " + MODAL_CLASS + "-stage";
      var clone = svg.cloneNode(true);
      if (size.width > 0 && size.height > 0) {
        clone.setAttribute("width", String(size.width));
        clone.setAttribute("height", String(size.height));
        clone.style.width = size.width + "px";
        clone.style.height = size.height + "px";
      }
      clone.style.maxWidth = "none";
      stage.appendChild(clone);
      viewport.appendChild(stage);
      body.appendChild(viewport);
      panel.appendChild(body);
      overlay.appendChild(panel);
      var previousFocus = document.activeElement;
      var releaseFocus = null;
      var closed = false;
      var reset = () => fitToView(overlay);
      function closeViewer() {
        if (closed) return;
        closed = true;
        releaseFocus?.();
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        unlockPageScroll();
        zooms.delete(overlay);
        if (previousFocus !== null && typeof previousFocus.focus === "function") {
          previousFocus.focus();
        }
      }
      function onKey(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeViewer();
        }
      }
      overlay.addEventListener("pointerdown", (event) => {
        if (event.target === overlay) closeViewer();
      });
      fitButton.addEventListener("click", reset);
      svgButton.addEventListener("click", () => downloadSvg(svg, svgButton));
      pngButton.addEventListener("click", () => downloadPng(svg, pngButton));
      zoomOut.addEventListener("click", () => zoomBy(overlay, 1 / ZOOM_STEP));
      zoomIn.addEventListener("click", () => zoomBy(overlay, ZOOM_STEP));
      closeButton.addEventListener("click", closeViewer);
      document.addEventListener("keydown", onKey, true);
      zooms.set(overlay, { scale: 1, x: 0, y: 0, min: ZOOM_MIN_MODAL });
      bindViewport(overlay, viewport, reset, true);
      lockPageScroll();
      document.body.appendChild(overlay);
      releaseFocus = trapFocus(overlay);
      closeButton.focus();
      var schedule2 = window.requestAnimationFrame ?? ((cb) => window.setTimeout(cb, 0));
      schedule2(reset);
    }
    function failDiagram(block, content, pre, key, error) {
      content.querySelector("." + MMD_CLASS)?.remove();
      var note = content.querySelector("." + MMD_CLASS + "-error") ?? document.createElement("p");
      note.className = MMD_CLASS + "-error";
      var reason = (error?.message ?? String(error)).split("\n")[0] ?? "";
      note.textContent = t("renderFailed") + reason;
      content.appendChild(note);
      cacheKeys.set(block, key);
      block.setAttribute(MMD_ATTR, "failed");
      decorate(block);
      console.warn("[dsh-md-plus] mermaid \u6E32\u67D3\u5931\u8D25", error);
    }
    function apply0(ctx) {
      if (typeof document === "undefined") return;
      ctx.effect(() => {
        disposed = false;
        settingsCache = null;
        themeCache = null;
        injectStyle();
        applyCodeFontSize();
        applyTableFreezeSettings();
        ensureSettingsButton();
        var root = document.body ?? document.documentElement;
        document.addEventListener("click", onDocumentClick, true);
        var observer = new MutationObserver(onMutations);
        observer.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["data-streaming", "data-ds-dark-theme"]
        });
        schedule();
        return () => {
          disposed = true;
          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
          pending.clear();
          rescanQueued = false;
          for (const target of [...foldTargets]) resetFold(target);
          for (const table of [...tableFreezeTargets]) clearTableFreeze(table);
          tableFreezeTargets.clear();
          if (tableFreezeObserver !== null) {
            tableFreezeObserver.disconnect();
            tableFreezeObserver = null;
          }
          tableFreezeState = /* @__PURE__ */ new WeakMap();
          for (const table of document.querySelectorAll(TABLE)) clearTableFreeze(table);
          observer.disconnect();
          document.removeEventListener("click", onDocumentClick, true);
          for (const node of injected) node.remove();
          injected.clear();
          for (const node of document.querySelectorAll("." + BTN_CLASS)) node.remove();
          for (const node of document.querySelectorAll("." + HOST_CLASS)) node.remove();
          for (const node of document.querySelectorAll("." + SEMANTIC_CLASS)) node.remove();
          for (const node of document.querySelectorAll("." + FOLD_BTN_CLASS)) node.remove();
          for (const node of document.querySelectorAll("[" + FOLD_ATTR + "]")) resetFold(node);
          for (const node of document.querySelectorAll("." + TABLE_TOOLS_CLASS)) node.remove();
          for (const attr of [
            DONE_ATTR,
            WRAP_ATTR,
            MMD_ATTR,
            TABLE_DONE_ATTR,
            SEMANTIC_ATTR,
            SEMANTIC_MANUAL_ATTR,
            "data-md-plus-lang",
            ZOOM_ATTR
          ]) {
            for (const node of document.querySelectorAll("[" + attr + "]")) node.removeAttribute(attr);
          }
          for (const node of document.querySelectorAll("[data-md-plus-original-label]")) {
            node.textContent = node.getAttribute("data-md-plus-original-label") ?? node.textContent;
            node.removeAttribute("data-md-plus-original-label");
          }
          for (const node of document.querySelectorAll(
            "." + MMD_CLASS + ", ." + MMD_CLASS + "-error, ." + MODAL_CLASS + ", ." + IMG_MODAL_CLASS + ", ." + SETTINGS_BTN_CLASS + ", ." + SETTINGS_MODAL_CLASS
          )) {
            node.remove();
          }
          scrollLocks = 0;
          document.documentElement.style.overflow = previousRootOverflow;
          previousRootOverflow = "";
          document.documentElement.style.removeProperty("--md-plus-code-font-size");
          document.documentElement.style.removeProperty("--md-plus-code-line-height");
          document.querySelector("style[" + STYLE_ATTR + "]")?.remove();
          for (const script of document.querySelectorAll("script[" + RUNTIME_ATTR + "]")) {
            script.remove();
          }
          scripts.clear();
          settingsCache = null;
          themeCache = null;
          diagramKindCache = /* @__PURE__ */ new WeakMap();
          semanticKindCache = /* @__PURE__ */ new WeakMap();
          cacheKeys = /* @__PURE__ */ new WeakMap();
          semanticStates = /* @__PURE__ */ new WeakMap();
          delete window[HL_GLOBAL];
          delete window[MMD_GLOBAL];
        };
      }, "dsh-md-plus: code block styling, highlighting and diagrams");
    }
    exports.apply = apply0;
    exports.inject = [];
    return module.exports;
  }
});
