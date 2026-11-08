// 代码块语义视图的 DOM 构建层。
// 解析交给 semantic-parsers.js，这里只负责把结构化数据画成可交互的节点。
import { parseDelimited, parseDiff, parseJson, parseLog } from "./semantic-parsers.js";

const JSON_PAGE_SIZE = 100;
const TABLE_PAGE_SIZE = 200;
const LOG_PAGE_SIZE = 1000;

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className !== undefined && className !== "") node.className = className;
  if (text !== undefined) node.textContent = text;
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

// ── JSON ────────────────────────────────────────────────────────────

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
    const text = value.length > 300 ? value.slice(0, 300) + "…" : value;
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
    toggle = button(doc, "md-plus-json-toggle", "▸");
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
  const entries = () =>
    Array.isArray(value)
      ? value.map((item, index) => [index, item])
      : Object.entries(value);

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
    toggle.textContent = expanded ? "▾" : "▸";
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
    label += " · " + (array ? t("semanticJsonArray") : t("semanticJsonObject"));
    label += " · " + format(t(array ? "semanticJsonItems" : "semanticJsonKeys"), { count: jsonSize(value) });
  }
  head.appendChild(summary(doc, label));
  root.appendChild(head);

  const tree = element(doc, "div", "md-plus-semantic-json-tree");
  tree.setAttribute("role", "tree");
  tree.appendChild(jsonNode(doc, "", value, 0, t));
  root.appendChild(tree);
  return root;
}

// ── CSV / TSV ───────────────────────────────────────────────────────

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
  const delimiter = kind === "tsv" ? "\t" : ",";
  const { rows, width } = parseDelimited(text, delimiter);
  const root = element(doc, "div", "md-plus-semantic md-plus-semantic-table");
  const head = toolbar(doc);
  head.appendChild(
    summary(doc, format(t("semanticTableSummary"), { rows: Math.max(0, rows.length - 1), cols: width })),
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
      moreButton = loadMoreButton(doc, t("semanticLoadMore") + " (" + (rows.length - rendered) + ")", () =>
        renderNextPage(),
      );
      body.appendChild(moreButton);
    } else {
      moreButton.textContent = t("semanticLoadMore") + " (" + (rows.length - rendered) + ")";
    }
  };

  renderNextPage();
  return root;
}

// ── 日志 ────────────────────────────────────────────────────────────

const LOG_FILTERS = ["all", "error", "warn", "info", "debug"];

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
  const filterButtons = new Map();

  const body = element(doc, "div", "md-plus-semantic-log-body");
  let active = "all";
  let rendered = 0;
  let moreButton = null;

  const visibleLines = () => (active === "all" ? lines : lines.filter((line) => line.level === active));

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
      logFilterLabel(t, filter) + " " + count,
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

// ── Diff ────────────────────────────────────────────────────────────

function diffNumber(doc, value) {
  return element(doc, "span", "md-plus-diff-num", value === null || value === undefined ? "" : String(value));
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
  stat.appendChild(element(doc, "span", "md-plus-diff-removed", "−" + stats.removed));
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

/**
 * 构建一个语义视图根节点。
 * @param {Document} doc
 * @param {"json"|"csv"|"tsv"|"log"|"diff"} kind
 * @param {string} text 围栏源码
 * @param {(key: string) => string} t 文案函数
 * @returns {HTMLElement}
 */
export function buildSemanticView(doc, kind, text, t) {
  if (kind === "json") return buildJsonView(doc, text, t);
  if (kind === "csv" || kind === "tsv") return buildTableView(doc, kind, text, t);
  if (kind === "log") return buildLogView(doc, text, t);
  if (kind === "diff") return buildDiffView(doc, text, t);
  throw new Error("unsupported semantic view: " + kind);
}
