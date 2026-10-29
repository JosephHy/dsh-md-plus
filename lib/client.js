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
    var ZOOM_ATTR = "data-md-plus-zoom";
    var ZOOM_STEP = 1.25;
    var ZOOM_MAX = 6;
    var ZOOM_MIN_INLINE = 1;
    var ZOOM_MIN_MODAL = 0.1;
    var ZOOM_MIN_EPSILON = 1e-3;
    var EXPAND_CLASS = "md-plus-expand";
    var THEME_CLASS = "md-plus-theme";
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
        theme: "\u5207\u6362 Mermaid \u914D\u8272",
        themeAria: "\u5207\u6362 Mermaid \u914D\u8272",
        themePrefix: "\u914D\u8272\uFF1A",
        foldOpen: "\u5C55\u5F00",
        foldClose: "\u6536\u8D77",
        renderFailed: "mermaid \u6E32\u67D3\u5931\u8D25\uFF1A",
        diagram: "\u6D41\u7A0B\u56FE",
        diagramAria: "\u6D41\u7A0B\u56FE\u5168\u5C4F\u67E5\u770B",
        fit: "\u9002\u5E94\u6574\u56FE",
        downloadSvg: "\u4E0B\u8F7D SVG",
        downloadPng: "\u4E0B\u8F7D PNG",
        close: "\u5173\u95ED",
        tableCsv: "CSV",
        tableMd: "Markdown",
        copyCsvTitle: "\u590D\u5236\u8868\u683C\u4E3A CSV",
        copyMdTitle: "\u590D\u5236\u8868\u683C\u4E3A Markdown",
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
        settingsFold: "\u957F\u5185\u5BB9\u6298\u53E0\u9608\u503C",
        settingsFoldCode: "\u4EE3\u7801\u5757",
        settingsFoldTable: "\u8868\u683C",
        settingsFoldDiagram: "\u56FE\u8868",
        settingsFoldCodeHint: "\u5185\u5BB9\u9AD8\u5EA6\u8D85\u8FC7\u6B64\u503C\u540E\u6298\u53E0",
        settingsFoldTableHint: "\u8868\u683C\u9AD8\u5EA6\u8D85\u8FC7\u6B64\u503C\u540E\u6298\u53E0",
        settingsFoldDiagramHint: "\u56FE\u5F62\u9AD8\u5EA6\u8D85\u8FC7\u6B64\u503C\u540E\u6298\u53E0",
        settingsFoldHint: "\u5355\u4F4D px\uFF0C0 \u8868\u793A\u4E0D\u6298\u53E0",
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
        theme: "Change Mermaid theme",
        themeAria: "Change Mermaid theme",
        themePrefix: "Theme: ",
        foldOpen: "Expand",
        foldClose: "Collapse",
        renderFailed: "Mermaid render failed: ",
        diagram: "Diagram",
        diagramAria: "Diagram fullscreen viewer",
        fit: "Fit",
        downloadSvg: "Download SVG",
        downloadPng: "Download PNG",
        close: "Close",
        tableCsv: "CSV",
        tableMd: "Markdown",
        copyCsvTitle: "Copy table as CSV",
        copyMdTitle: "Copy table as Markdown",
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
        settingsFold: "Fold thresholds",
        settingsFoldCode: "Code block",
        settingsFoldTable: "Table",
        settingsFoldDiagram: "Diagram",
        settingsFoldCodeHint: "Fold when the block is taller than this",
        settingsFoldTableHint: "Fold when the table is taller than this",
        settingsFoldDiagramHint: "Fold when the diagram is taller than this",
        settingsFoldHint: "Pixels; 0 disables folding",
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
    var KEY_ATTR = "data-md-plus-key";
    var WRAP_ATTR = "data-md-plus-wrap";
    var MMD_ATTR = "data-md-plus-mmd";
    var FOLD_ATTR = "data-md-plus-fold";
    var FOLD_CLASS = "md-plus-fold";
    var FOLD_BTN_CLASS = "md-plus-fold-toggle";
    var FOLD_LIMITS = { code: 480, table: 520, diagram: 720 };
    var TABLE_TOOLS_CLASS = "md-plus-table-tools";
    var TABLE_DONE_ATTR = "data-md-plus-table";
    var IMG_MODAL_CLASS = "md-plus-img-modal";
    var NATIVE_IMAGE_BUTTON = 'button[class*="imageButton"]';
    var SETTINGS_BTN_CLASS = "md-plus-settings-btn";
    var SETTINGS_MODAL_CLASS = "md-plus-settings-modal";
    var SETTINGS_KEY = "dsh-md-plus-settings";
    var DEFAULT_SETTINGS = {
      codeFontSize: 0,
      diagramView: "diagram",
      foldCode: FOLD_LIMITS.code,
      foldTable: FOLD_LIMITS.table,
      foldDiagram: FOLD_LIMITS.diagram
    };
    var STYLE_ATTR = "data-md-plus-style";
    var RUNTIME_ATTR = "data-md-plus-runtime";
    var DEBOUNCE_MS = 160;
    function readSettings() {
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
          for (var key of ["foldCode", "foldTable", "foldDiagram"]) {
            var value = Number(saved[key]);
            if (Number.isFinite(value) && value >= 0) settings[key] = Math.min(4e3, Math.round(value));
          }
        }
      } catch {
      }
      return settings;
    }
    function saveSettings(next) {
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
      if (size > 0) document.documentElement.style.setProperty("--md-plus-code-font-size", size + "px");
      else document.documentElement.style.removeProperty("--md-plus-code-font-size");
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
    var MMD_TYPE = /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|xychart-beta|sankey-beta|block-beta|packet-beta|architecture-beta|usecase-beta|agentflow-beta|C4Context|requirementDiagram|kanban|radar|treemap|venn|ishikawa|wardley|cynefin|treeView|zenuml)\b/im;
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
    var ICON_GEAR = icon(
      "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.36.48.6.87.61H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z'/>"
    );
    var TABLE = '[class*="_markdown_"] div:has(> table)';
    var TABLE_VARS = "--md-plus-tbl-radius:8px;--md-plus-tbl-radius-inner:7px;--md-plus-tbl-line:#ebebeb;--md-plus-tbl-head:#f7f7f7;--md-plus-tbl-head-fg:#181818;--md-plus-tbl-hover:#fafafa";
    var TABLE_VARS_DARK = "--md-plus-tbl-line:#2f2f2f;--md-plus-tbl-head:#1f1f1f;--md-plus-tbl-head-fg:#f9fafb;--md-plus-tbl-hover:#1f1f1f";
    var CSS = [
      // ── 卡片：整块一个底色，顶栏不再是独立色带 ──────────────────────
      ".md-code-block{--md-plus-mmd-min-height:200px;--md-plus-icon:" + ICON_CODE + ";--md-plus-icon-copy:" + ICON_COPY + ";--md-plus-icon-nowrap:" + ICON_NOWRAP + ";--md-plus-icon-diagram:" + ICON_DIAGRAM + ";--md-plus-icon-zoom-in:" + ICON_ZOOM_IN + ";--md-plus-icon-zoom-out:" + ICON_ZOOM_OUT + ";--md-plus-icon-expand:" + ICON_EXPAND + ";--md-plus-icon-theme:" + ICON_THEME + "}",
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
      ".md-code-block pre{padding:6px 16px 16px;font-size:var(--md-plus-code-font-size,inherit)}",
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
      // ── 长内容折叠：代码块、表格、图表卡共用一套按钮 ───────────────
      "." + FOLD_CLASS + "{position:relative}",
      "." + FOLD_CLASS + "[" + FOLD_ATTR + '="on"]{max-height:var(--md-plus-fold-max-height);overflow:hidden}',
      "." + FOLD_BTN_CLASS + "{display:block;margin:8px auto 0;padding:4px 12px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 22%));border-radius:999px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer;box-shadow:0 2px 8px rgb(0 0 0 / 12%);z-index:2}",
      "." + FOLD_CLASS + "[" + FOLD_ATTR + '="on"] .' + FOLD_BTN_CLASS + "{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);margin:0}",
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
      "." + SETTINGS_MODAL_CLASS + "-title{margin:0 0 6px;font:600 14px/22px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-primary)}",
      "." + SETTINGS_MODAL_CLASS + "-row{display:flex;align-items:center;gap:12px;margin:11px 0}",
      "." + SETTINGS_MODAL_CLASS + "-label{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;font:13px/20px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-primary)}",
      "." + SETTINGS_MODAL_CLASS + "-label-title{display:block}",
      "." + SETTINGS_MODAL_CLASS + "-label-hint{display:block;font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-tertiary)}",
      "." + SETTINGS_MODAL_CLASS + "-hint{margin:-4px 0 8px;font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);color:var(--dsw-alias-label-tertiary)}",
      "." + SETTINGS_MODAL_CLASS + " input[type=number]{width:78px;padding:4px 6px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 22%));border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 6%));color:var(--dsw-alias-label-primary);font:13px/18px var(--dsw-font-family-sans,system-ui,sans-serif)}",
      "." + SETTINGS_MODAL_CLASS + " select{padding:4px 6px;border:1px solid var(--dsw-alias-border-secondary,rgb(127 127 127 / 22%));border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgb(127 127 127 / 6%));color:var(--dsw-alias-label-primary);font:13px/18px var(--dsw-font-family-sans,system-ui,sans-serif)}",
      "." + SETTINGS_MODAL_CLASS + "-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}",
      "." + SETTINGS_MODAL_CLASS + "-actions button{appearance:none;border:0;border-radius:6px;padding:5px 12px;background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 12%));color:var(--dsw-alias-label-primary);font:12px/18px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer}",
      "." + SETTINGS_MODAL_CLASS + "-actions button:not(." + SETTINGS_MODAL_CLASS + "-primary):hover{background:var(--dsw-alias-interactive-bg-active,rgb(76 110 245 / 12%))}",
      "." + SETTINGS_MODAL_CLASS + "-actions ." + SETTINGS_MODAL_CLASS + "-primary{background:var(--dsw-alias-button-primary-fill,#4c6ef5);color:var(--dsw-alias-label-primary-foreground,#fff)}",
      "." + SETTINGS_MODAL_CLASS + "-actions ." + SETTINGS_MODAL_CLASS + "-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-button-primary-fill,#4c6ef5))}",
      // 高亮宿主不参与布局，让里面的 <pre> 直接吃到卡片样式
      "." + HOST_CLASS + "{display:contents}",
      // 藏掉纯文本回退，只留着色结果；原节点仍在，复制读的还是它
      "[" + DONE_ATTR + '="done"] > ' + CONTENT + " > pre:not(.md-plus-pre){display:none}",
      // ── 表格 ────────────────────────────────────────────────────────
      // 抓手用结构选择器而不是 DSH 的哈希类名：外层是「唯一子元素是 table 的 div」。
      // 前面挂 [class*="_markdown_"] 有两个作用——只认 markdown 渲染出来的表格，
      // 同时把特异性顶到 (0,1,4)，压过 DSH 自己的 .tableScroll th (0,1,1)。
      TABLE + "{position:relative;margin-block:16px;" + TABLE_VARS + "}",
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
      // 长表往下滚时表头留在视口顶部；底色不透明才不会透出下面的行
      TABLE + " > table thead th{position:sticky;top:0;z-index:1}",
      // 复制按钮放在表尾右侧：不压住表头文字，表格折叠时也能随展开一起出现
      TABLE + " > table > caption." + TABLE_TOOLS_CLASS + "{caption-side:top;text-align:right;padding:0 0 6px}",
      TABLE + " > table > caption." + TABLE_TOOLS_CLASS + " button{appearance:none;border:1px solid var(--md-plus-tbl-line);border-radius:5px;padding:2px 8px;margin-left:4px;background:transparent;color:var(--dsw-alias-label-secondary);font:11px/16px var(--dsw-font-family-sans,system-ui,sans-serif);cursor:pointer}",
      TABLE + " > table > caption." + TABLE_TOOLS_CLASS + " button:hover{color:var(--dsw-alias-label-primary);background:var(--md-plus-tbl-hover)}",
      // 宽表（≥4 列）不收着不行。宿主给这类表加了 .md-table-wide，并让它「出血」：
      // 包裹层撑到面板宽，再用 padding-left 把表推到正文栏左侧。那个 padding 会吃掉
      // 可用宽度，结果是表格比正文宽出一截、右边还被裁掉，而滚动条只在鼠标悬停时
      // 才出现——文字表落进这个区间就很难读。这里按回正文栏宽，超出改为表内横滚。
      // 特异性 (0,2,2)，压得住宿主的 .Pg4CGa_body .md-table-wide (0,2,0)。
      TABLE + ".md-table-wide{width:100%;max-width:100%;margin-inline:0;padding-inline:0;overflow-x:auto}",
      // 塞得下就撑满正文栏，塞不下保持自然宽度让外面滚，不把列挤成一列一个字
      TABLE + ".md-table-wide > table{width:100%;max-width:none;min-width:max-content}",
      // 宿主原本是「悬停才出滚动条」，所以悬停时会把预留的滚动条高度收掉；
      // 现在滚动条常驻，再收掉就会跳 5px，固定住。
      TABLE + ".md-table-wide:hover{padding-bottom:var(--dsh-scrollbar-width,5px)}"
    ].join("\n");
    var scripts = /* @__PURE__ */ new Map();
    var pending = /* @__PURE__ */ new Set();
    var timer = null;
    var rescanQueued = false;
    var injected = /* @__PURE__ */ new Set();
    var diagramSeq = 0;
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
        script.addEventListener("load", () => resolve(window[globalName] ?? null), { once: true });
        script.addEventListener("error", () => resolve(null), { once: true });
        document.head.appendChild(script);
      });
      scripts.set(url, promise);
      return promise;
    }
    function readLang(block) {
      var banner = block.querySelector(BANNER);
      var info = banner?.firstElementChild;
      return (info?.textContent ?? "").trim().toLowerCase();
    }
    function sniffDiagramType(code) {
      var text = code;
      if (text.startsWith("---")) {
        var blank = text.indexOf("\n");
        var close = blank < 0 ? -1 : text.indexOf("\n---", blank);
        text = close < 0 ? "" : text.slice(close + 4);
      }
      var body = text.split("\n").filter((line) => !line.trimStart().startsWith("%%")).join("\n");
      return MMD_TYPE.exec(body)?.[1] ?? null;
    }
    function diagramKind(block) {
      if (MMD_LANGS.has(readLang(block))) return "diagram";
      var pre = block.querySelector(CONTENT + " pre");
      if (pre === null) return null;
      return sniffDiagramType(pre.textContent ?? "") === null ? null : "diagram";
    }
    function isOurs(node) {
      var element = node?.nodeType === 1 ? node : node?.parentElement;
      return element?.closest?.(
        "." + HOST_CLASS + ", ." + BTN_CLASS + ", ." + MMD_CLASS + ", ." + FOLD_BTN_CLASS + ", ." + TABLE_TOOLS_CLASS + ", ." + IMG_MODAL_CLASS + ", ." + SETTINGS_BTN_CLASS + ", ." + SETTINGS_MODAL_CLASS
      ) != null;
    }
    function schedule(block) {
      if (block !== void 0) pending.add(block);
      else rescanQueued = true;
      if (timer !== null) return;
      timer = window.setTimeout(flush, DEBOUNCE_MS);
    }
    function flush() {
      timer = null;
      if (rescanQueued) {
        rescanQueued = false;
        for (const block of document.querySelectorAll(BLOCK)) pending.add(block);
      }
      var batch = Array.from(pending);
      pending.clear();
      for (const block of batch) {
        decorate(block);
        void enhance(block);
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
      for (const block of document.querySelectorAll("[" + MMD_ATTR + '="diagram"]')) {
        block.removeAttribute(KEY_ATTR);
        pending.add(block);
      }
      schedule();
    }
    var PLAIN_BUTTONS = [
      {
        cls: TOOL_CLASS,
        titleKey: "wrapTitle",
        ariaKey: "wrapAria",
        run: (block) => {
          if (block.getAttribute(WRAP_ATTR) === "on") block.removeAttribute(WRAP_ATTR);
          else block.setAttribute(WRAP_ATTR, "on");
        }
      }
    ];
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
      }
    ];
    function findNativeWrap(buttons) {
      if (buttons === void 0) return null;
      for (const button of buttons) {
        var label = (button.getAttribute("aria-label") ?? "") + " " + (button.title ?? "") + " " + (button.textContent ?? "");
        if (/换行|wrap/i.test(label)) return button;
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
      var specs = readLang(block) !== "" && diagramKind(block) !== null ? MMD_BUTTONS : findNativeWrap(nativeButtons) !== null ? [] : PLAIN_BUTTONS;
      for (const existing of action.querySelectorAll("." + BTN_CLASS)) {
        if (specs.some((spec) => existing.classList.contains(spec.cls))) continue;
        existing.remove();
        injected.delete(existing);
      }
      for (const spec of specs) {
        if (action.querySelector("." + spec.cls) !== null) continue;
        var created = document.createElement("button");
        created.type = "button";
        created.className = BTN_CLASS + " " + spec.cls;
        created.title = t(spec.titleKey);
        created.setAttribute("aria-label", t(spec.ariaKey));
        if (spec.cls === THEME_CLASS) {
          var label = themeLabel(getMermaidTheme());
          created.title = label;
          created.setAttribute("aria-label", label);
        }
        created.addEventListener("click", () => spec.run(block));
        action.insertBefore(created, copy);
        injected.add(created);
      }
    }
    function releaseTakenOver(block, content) {
      var host = content.querySelector("." + HOST_CLASS);
      if (host === null) return false;
      if (content.querySelector("pre.shiki:not(.md-plus-pre)") === null) return false;
      host.remove();
      block.removeAttribute(KEY_ATTR);
      block.removeAttribute(DONE_ATTR);
      return true;
    }
    async function enhance(block) {
      if (!block.isConnected) return;
      if (block.closest("[data-streaming]") !== null) return;
      var content = block.querySelector(CONTENT);
      if (content === null) return;
      if (releaseTakenOver(block, content)) return;
      var pre = content.querySelector("pre");
      if (pre === null || pre.classList.contains("shiki")) return;
      var lang = readLang(block);
      if (lang === "") return;
      if (diagramKind(block) !== null) {
        await renderDiagram(block, content, pre);
        return;
      }
      if (DSH_LANGS.has(lang)) return;
      var api = await loadScript(HL_URL, HL_GLOBAL);
      if (api === null || !api.supports(lang)) return;
      if (!pre.isConnected) return;
      var code = pre.textContent ?? "";
      if (code.trim() === "") return;
      var key = lang + "\0" + code;
      if (block.getAttribute(KEY_ATTR) === key) return;
      var html;
      try {
        html = await api.highlight(code, lang);
      } catch {
        return;
      }
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
      block.setAttribute(KEY_ATTR, key);
      block.setAttribute(DONE_ATTR, "done");
      scheduleFold(content, foldLimit("code"));
    }
    function getMermaidTheme() {
      try {
        var saved = window.localStorage.getItem(THEME_KEY);
        if (saved !== null && THEME_ORDER.indexOf(saved) !== -1) return saved;
      } catch {
      }
      return "blue";
    }
    function themeLabel(name) {
      return t("themePrefix") + (THEME_LABELS[detectLang()][name] ?? name);
    }
    function refreshThemeButtons() {
      var label = themeLabel(getMermaidTheme());
      for (const button of document.querySelectorAll("." + THEME_CLASS)) {
        button.title = label;
        button.setAttribute("aria-label", label);
      }
    }
    function cycleMermaidTheme(block) {
      var current = getMermaidTheme();
      var index = THEME_ORDER.indexOf(current);
      var next = THEME_ORDER[(index + 1) % THEME_ORDER.length];
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
      if (block.getAttribute(KEY_ATTR) === key) return;
      var api = await loadScript(MMD_URL, MMD_GLOBAL);
      if (api === null) return;
      if (!pre.isConnected) return;
      var svg;
      try {
        var dark = document.body.hasAttribute("data-ds-dark-theme");
        svg = await api.render("dsh-md-plus-mmd-" + ++diagramSeq, code, dark, getMermaidTheme());
      } catch (error) {
        failDiagram(block, content, pre, key, error);
        return;
      }
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
      block.setAttribute(KEY_ATTR, key);
      var view = block.getAttribute(MMD_ATTR);
      if (view !== "code" && view !== "diagram") block.setAttribute(MMD_ATTR, readSettings().diagramView);
      zooms.delete(block);
      paint(block);
      scheduleFold(viewport, foldLimit("diagram"));
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
    function bindViewport(block, viewport, resetView) {
      var drag = null;
      viewport.addEventListener(
        "wheel",
        (event) => {
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
      target.removeAttribute(FOLD_ATTR);
      target.classList.remove(FOLD_CLASS);
      target.style.removeProperty("--md-plus-fold-max-height");
      target.querySelector("." + FOLD_BTN_CLASS)?.remove();
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
        if (!target.isConnected || target.getAttribute(FOLD_ATTR) !== null) return;
        if (target.scrollHeight <= limit) {
          target.setAttribute(FOLD_ATTR, "none");
          return;
        }
        target.setAttribute(FOLD_ATTR, "on");
        target.classList.add(FOLD_CLASS);
        target.style.setProperty("--md-plus-fold-max-height", limit + "px");
        var button = document.createElement("button");
        button.type = "button";
        button.className = FOLD_BTN_CLASS;
        button.textContent = t("foldOpen");
        button.setAttribute("aria-expanded", "false");
        button.addEventListener("click", () => {
          var folded = target.getAttribute(FOLD_ATTR) === "on";
          target.setAttribute(FOLD_ATTR, folded ? "off" : "on");
          button.textContent = folded ? t("foldClose") : t("foldOpen");
          button.setAttribute("aria-expanded", folded ? "true" : "false");
        });
        target.appendChild(button);
      });
    }
    function scanFolds() {
      for (const block of document.querySelectorAll(BLOCK)) {
        if (block.closest("[data-streaming]") !== null) continue;
        if (diagramKind(block) !== null) continue;
        scheduleFold(block.querySelector(CONTENT), foldLimit("code"));
      }
      for (const table of document.querySelectorAll(TABLE)) {
        if (table.closest("[data-streaming]") !== null) continue;
        decorateTable(table);
        scheduleFold(table, foldLimit("table"));
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
    function tableToMarkdown(rows) {
      if (rows.length === 0) return "";
      var width = Math.max(...rows.map((row) => row.length));
      var line = (row) => "| " + row.concat(Array(width - row.length).fill("")).map((value) => value.replace(/\|/g, "\\|")).join(" | ") + " |";
      var output = [line(rows[0]), "| " + Array(width).fill("---").join(" | ") + " |"];
      for (var index = 1; index < rows.length; index += 1) output.push(line(rows[index]));
      return output.join("\n");
    }
    async function copyText(text) {
      if (window.navigator.clipboard !== void 0 && typeof window.navigator.clipboard.writeText === "function") {
        await window.navigator.clipboard.writeText(text);
        return true;
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
    function flashButton(button, text) {
      var original = button.getAttribute("data-md-plus-label") ?? button.textContent;
      button.setAttribute("data-md-plus-label", original);
      button.textContent = text;
      window.setTimeout(() => {
        button.textContent = original;
      }, 1200);
    }
    function decorateTable(table) {
      var dataTable = table.querySelector("table");
      if (dataTable === null) return;
      var first = dataTable.firstElementChild;
      if (first !== null && first.classList.contains(TABLE_TOOLS_CLASS)) return;
      table.setAttribute(TABLE_DONE_ATTR, "1");
      var tools = document.createElement("caption");
      tools.className = TABLE_TOOLS_CLASS;
      for (const [kind, label, titleKey, convert] of [
        ["csv", t("tableCsv"), "copyCsvTitle", tableToCsv],
        ["md", t("tableMd"), "copyMdTitle", tableToMarkdown]
      ]) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.title = t(titleKey);
        button.setAttribute("aria-label", t(titleKey));
        button.addEventListener("click", async () => {
          var ok = false;
          try {
            ok = await copyText(convert(tableRows(dataTable)));
          } catch {
            ok = false;
          }
          flashButton(button, ok ? t("copied") : t("copyFailed"));
        });
        tools.appendChild(button);
      }
      dataTable.insertBefore(tools, dataTable.firstChild);
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
      var closed = false;
      function closeViewer() {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
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
      document.body.appendChild(overlay);
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
      for (const node of document.querySelectorAll("[" + FOLD_ATTR + "]")) resetFold(node);
      for (const viewport of document.querySelectorAll("." + MMD_CLASS + "-viewport")) {
        resetFold(viewport);
        scheduleFold(viewport, foldLimit("diagram"));
      }
      scanFolds();
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
      panel.appendChild(settingRow(t("settingsFontSize"), fontInput));
      var fontHint = document.createElement("p");
      fontHint.className = SETTINGS_MODAL_CLASS + "-hint";
      fontHint.textContent = t("settingsFontSizeHint");
      panel.appendChild(fontHint);
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
      var foldHint = document.createElement("p");
      foldHint.className = SETTINGS_MODAL_CLASS + "-hint";
      foldHint.textContent = t("settingsFold") + " \xB7 " + t("settingsFoldHint");
      panel.appendChild(foldHint);
      var foldCode = numberInput(current.foldCode, 0, 4e3);
      var foldTable = numberInput(current.foldTable, 0, 4e3);
      var foldDiagram = numberInput(current.foldDiagram, 0, 4e3);
      panel.appendChild(settingRow(t("settingsFoldCode"), foldCode, t("settingsFoldCodeHint")));
      panel.appendChild(settingRow(t("settingsFoldTable"), foldTable, t("settingsFoldTableHint")));
      panel.appendChild(settingRow(t("settingsFoldDiagram"), foldDiagram, t("settingsFoldDiagramHint")));
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
      panel.appendChild(actions);
      overlay.appendChild(panel);
      var previousFocus = document.activeElement;
      var closed = false;
      function closeSettings() {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        if (previousFocus !== null && typeof previousFocus.focus === "function") previousFocus.focus();
      }
      function onKey(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeSettings();
        }
      }
      function readNumber(input, fallback) {
        var value = Number(input.value);
        return Number.isFinite(value) && value >= 0 ? Math.min(4e3, Math.round(value)) : fallback;
      }
      resetButton.addEventListener("click", () => {
        themeSelect.value = "blue";
        fontInput.value = "";
        viewSelect.value = DEFAULT_SETTINGS.diagramView;
        foldCode.value = "";
        foldTable.value = "";
        foldDiagram.value = "";
      });
      saveButton.addEventListener("click", () => {
        saveSettings({
          codeFontSize: readNumber(fontInput, 0),
          diagramView: viewSelect.value === "code" ? "code" : "diagram",
          foldCode: readNumber(foldCode, DEFAULT_SETTINGS.foldCode),
          foldTable: readNumber(foldTable, DEFAULT_SETTINGS.foldTable),
          foldDiagram: readNumber(foldDiagram, DEFAULT_SETTINGS.foldDiagram)
        });
        try {
          window.localStorage.setItem(THEME_KEY, themeSelect.value);
        } catch {
        }
        applyCodeFontSize();
        refreshThemeButtons();
        redrawDiagrams();
        rescanFolds();
        closeSettings();
      });
      closeButton.addEventListener("click", closeSettings);
      overlay.addEventListener("pointerdown", (event) => {
        if (event.target === overlay) closeSettings();
      });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(overlay);
      saveButton.focus();
    }
    function ensureSettingsButton() {
      if (document.querySelector("." + SETTINGS_BTN_CLASS) !== null) return;
      if (document.querySelector('[class*="_markdown_"], .md-code-block') === null) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = SETTINGS_BTN_CLASS;
      button.title = t("settingsOpen");
      button.setAttribute("aria-label", t("settingsOpen"));
      button.addEventListener("click", openSettings);
      document.body.appendChild(button);
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
    function downloadSvg(svg) {
      try {
        downloadBlob(new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" }), "mermaid-diagram.svg");
      } catch (error) {
        console.warn("[dsh-md-plus] SVG \u5BFC\u51FA\u5931\u8D25", error);
      }
    }
    function downloadPng(svg) {
      var size = svgSize(svg);
      if (size.width <= 0 || size.height <= 0) return;
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
          }, "image/png");
        } catch (error) {
          console.warn("[dsh-md-plus] PNG \u5BFC\u51FA\u5931\u8D25", error);
        } finally {
          if (objectUrl !== "") URL.revokeObjectURL(objectUrl);
        }
      };
      image.onerror = function() {
        if (objectUrl !== "") URL.revokeObjectURL(objectUrl);
        console.warn("[dsh-md-plus] PNG \u5BFC\u51FA\u5931\u8D25\uFF1ASVG \u65E0\u6CD5\u8F7D\u5165");
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
      var previousOverflow = document.documentElement.style.overflow;
      var closed = false;
      var reset = () => fitToView(overlay);
      function closeViewer() {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        document.documentElement.style.overflow = previousOverflow;
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
      svgButton.addEventListener("click", () => downloadSvg(svg));
      pngButton.addEventListener("click", () => downloadPng(svg));
      zoomOut.addEventListener("click", () => zoomBy(overlay, 1 / ZOOM_STEP));
      zoomIn.addEventListener("click", () => zoomBy(overlay, ZOOM_STEP));
      closeButton.addEventListener("click", closeViewer);
      document.addEventListener("keydown", onKey, true);
      zooms.set(overlay, { scale: 1, x: 0, y: 0, min: ZOOM_MIN_MODAL });
      bindViewport(overlay, viewport, reset);
      document.documentElement.style.overflow = "hidden";
      document.body.appendChild(overlay);
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
      block.setAttribute(KEY_ATTR, key);
      block.setAttribute(MMD_ATTR, "failed");
      console.warn("[dsh-md-plus] mermaid \u6E32\u67D3\u5931\u8D25", error);
    }
    function apply0(ctx) {
      if (typeof document === "undefined") return;
      ctx.effect(() => {
        injectStyle();
        applyCodeFontSize();
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
          observer.disconnect();
          document.removeEventListener("click", onDocumentClick, true);
          for (const node of injected) node.remove();
          injected.clear();
          for (const node of document.querySelectorAll("[" + FOLD_ATTR + "]")) resetFold(node);
          for (const node of document.querySelectorAll("." + TABLE_TOOLS_CLASS)) node.remove();
          for (const table of document.querySelectorAll("[" + TABLE_DONE_ATTR + "]")) {
            table.removeAttribute(TABLE_DONE_ATTR);
          }
          for (const node of document.querySelectorAll(
            "." + MMD_CLASS + ", ." + MMD_CLASS + "-error, ." + MODAL_CLASS + ", ." + IMG_MODAL_CLASS + ", ." + SETTINGS_BTN_CLASS + ", ." + SETTINGS_MODAL_CLASS
          )) {
            node.remove();
          }
          document.documentElement.style.overflow = "";
          document.documentElement.style.removeProperty("--md-plus-code-font-size");
          document.querySelector("style[" + STYLE_ATTR + "]")?.remove();
          for (const script of document.querySelectorAll("script[" + RUNTIME_ATTR + "]")) {
            script.remove();
          }
          scripts.clear();
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
