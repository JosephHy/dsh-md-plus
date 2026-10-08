// dsh-md-plus 浏览器半。
//
// 三件事：
//   1) 样式 —— 把 DSH 的代码块重做成参考图那种「整块一个卡片 + 图标化头部」，
//      并消掉没有语言时头部那一大片空白。纯 CSS 打在 .md-code-block 上，
//      所以所有语言（包括 DSH 自己高亮的）都吃到同一套样式。
//   2) 高亮 —— DSH 只认死 26 种语言，其余走 pre.plain 纯文本回退，看上去就是
//      一堆没颜色的源码。这里把那些块捡出来重新上色，结果插在原 <pre> 后面
//      并把它藏掉——原节点不动，所以 DSH 的复制按钮仍然照常工作。
//   3) 图形 —— mermaid 围栏自己渲染成 SVG（取代 dsh-mermaid）。判断依据是
//      头部显示的语言名，所以 graph / flowchart 两种写法都能画——dsh-mermaid
//      当年漏了 graph，正是它画不出来的原因。
window.__ModuleLoader__.load({
  id: "dsh-md-plus",
  factory: (require) => {
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
    // 插件自己插的头部按钮都带这个标记类，便于成组增删
    var BTN_CLASS = "md-plus-btn";
    var ZOOM_IN_CLASS = "md-plus-zoom-in";
    var ZOOM_OUT_CLASS = "md-plus-zoom-out";
    var ZOOM_ATTR = "data-md-plus-zoom";
    var ZOOM_STEP = 1.25;
    var ZOOM_MAX = 6;
    var DONE_ATTR = "data-md-plus";
    var KEY_ATTR = "data-md-plus-key";
    var WRAP_ATTR = "data-md-plus-wrap";
    var MMD_ATTR = "data-md-plus-mmd";
    var STYLE_ATTR = "data-md-plus-style";
    var RUNTIME_ATTR = "data-md-plus-runtime";
    var DEBOUNCE_MS = 160;

    // DSH 自带高亮的语言（它内部 LANG_ALIASES 的镜像）。这些一律不碰：
    // 它的懒加载语法有「先出纯文本、后换高亮」的窗口，抢过来会撞成两份。
    var DSH_LANGS = new Set([
      "typescript", "ts", "tsx", "javascript", "js", "jsx",
      "shellscript", "bash", "sh", "shell", "zsh",
      "json", "jsonc",
      "py", "python", "rb", "ruby", "go", "rs", "rust",
      "java", "c", "cpp", "cs", "csharp", "kotlin", "swift", "php",
      "yaml", "yml", "toml", "ini",
      "md", "markdown", "mdx",
      "html", "css", "scss", "less", "sql", "xml", "lua",
    ]);

    // mermaid 系围栏由本插件自己画。
    var MMD_LANGS = new Set(["mermaid", "mermaidjs", "mmd"]);

    // DSH 0.2.0-rc.2 的代码块头部是 CodeToolbar，语言标签走
    // `supportsHighlighting(lang) ? lang : labels.codeLabel`，mermaid 不在它的表里，
    // 所以标签显示的是占位文案（中文「代码块」），readLang() 读不到围栏语言。
    // 兜底：认不出标签时看正文——mermaid 的类型声明必须单独占一行。
    // 这张表只给图表识别用，不能回流进 readLang()：后者是分流依据，
    // 凭正文改判会让「不认的语言」再也不去补高亮。
    // usecase-beta / agentflow-beta 是 mermaid 12.x 才有的图种，引擎不到 12 就画不出来。
    var MMD_TYPE = /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|xychart-beta|sankey-beta|block-beta|packet-beta|architecture-beta|usecase-beta|agentflow-beta|C4Context|requirementDiagram|kanban|radar|treemap|venn|ishikawa|wardley|cynefin|treeView|zenuml)\b/im;

    /** 把 SVG 包成 CSS mask 能用的 data URI；形状走 alpha 通道，颜色交给 currentColor。 */
    function icon(paths) {
      var svg =
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' " +
        "stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>" +
        paths +
        "</svg>";
      return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }

    var ICON_CODE = icon(
      "<path d='M8.5 7 3.5 12l5 5'/><path d='M15.5 7l5 5-5 5'/><path d='M13.6 5.2 10.4 18.8'/>",
    );
    var ICON_COPY = icon(
      "<rect x='9' y='9' width='12' height='12' rx='2.5'/>" +
        "<path d='M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6'/>",
    );
    var ICON_NOWRAP = icon(
      "<path d='M3 12h12.5'/><path d='M12.5 8.5 16.5 12l-4 3.5'/><path d='M20 6v12'/>",
    );
    var ICON_DIAGRAM = icon(
      "<rect x='3' y='3' width='8' height='5.5' rx='1.8'/>" +
        "<rect x='13' y='15.5' width='8' height='5.5' rx='1.8'/>" +
        "<path d='M7 8.5v5a2.5 2.5 0 0 0 2.5 2.5H13'/><path d='M10.5 13.5 13 16l-2.5 2.5'/>",
    );
    var ICON_ZOOM_IN = icon(
      "<circle cx='10.5' cy='10.5' r='7'/><path d='M20.5 20.5 15.6 15.6'/>" +
        "<path d='M7.5 10.5h6'/><path d='M10.5 7.5v6'/>",
    );
    var ICON_ZOOM_OUT = icon(
      "<circle cx='10.5' cy='10.5' r='7'/><path d='M20.5 20.5 15.6 15.6'/><path d='M7.5 10.5h6'/>",
    );

    // 表格抓手：结构选择器 + markdown 容器作用域，见 CSS 里的说明
    var TABLE = '[class*="_markdown_"] div:has(> table)';
    // 参考图取样：表头 #f7f7f7 / 文字 #181818 / 分隔线 #ebebeb
    var TABLE_VARS =
      "--md-plus-tbl-radius:8px;--md-plus-tbl-radius-inner:7px;" +
      "--md-plus-tbl-line:#ebebeb;--md-plus-tbl-head:#f7f7f7;--md-plus-tbl-head-fg:#181818;--md-plus-tbl-hover:#fafafa";
    var TABLE_VARS_DARK =
      "--md-plus-tbl-line:#2f2f2f;--md-plus-tbl-head:#1f1f1f;--md-plus-tbl-head-fg:#f9fafb;--md-plus-tbl-hover:#1f1f1f";

    var CSS = [
      // ── 卡片：整块一个底色，顶栏不再是独立色带 ──────────────────────
      ".md-code-block{--md-plus-mmd-min-height:200px;--md-plus-icon:" + ICON_CODE + ";--md-plus-icon-copy:" + ICON_COPY + ";--md-plus-icon-nowrap:" + ICON_NOWRAP + ";--md-plus-icon-diagram:" + ICON_DIAGRAM + ";--md-plus-icon-zoom-in:" + ICON_ZOOM_IN + ";--md-plus-icon-zoom-out:" + ICON_ZOOM_OUT + "}",
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

      // ── 间距：头部与首行代码之间补 6px ──────────────────────────────
      // pre 的行高本身就在首行文字上方留了约半行空白；补 6px 后实测间距约 17px
      // （原来给 0 时只有 11px，贴着看太挤）
      ".md-code-block pre{padding:6px 16px 16px}",

      // ── 头部按钮：文字换成图标 ──────────────────────────────────────
      ".md-code-block " + BANNER + " button{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:6px;font-size:0;cursor:pointer;background:transparent;color:var(--dsw-alias-label-tertiary);transition:background-color .12s ease,color .12s ease}",
      // font-size:0 只藏住「复制 / 已复制」的字面，可访问名仍在
      ".md-code-block " + BANNER + " button::before{content:'';width:15px;height:15px;background:currentColor;-webkit-mask:var(--md-plus-icon-copy) center/contain no-repeat;mask:var(--md-plus-icon-copy) center/contain no-repeat}",
      ".md-code-block " + BANNER + " button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,rgb(127 127 127 / 12%))}",
      ".md-code-block " + BANNER + " button:focus-visible{outline:2px solid var(--dsw-alias-button-primary-fill,#4c6ef5);outline-offset:1px}",

      // ── 普通块：不换行切换 ──────────────────────────────────────────
      ".md-code-block " + BANNER + " ." + TOOL_CLASS + "::before{-webkit-mask:var(--md-plus-icon-nowrap) center/contain no-repeat;mask:var(--md-plus-icon-nowrap) center/contain no-repeat}",
      '[' + WRAP_ATTR + '="on"] .' + TOOL_CLASS + "{color:var(--dsw-alias-button-primary-fill,#4c6ef5);background:var(--dsw-alias-interactive-bg-active,rgb(76 110 245 / 12%))}",
      '[' + WRAP_ATTR + '="on"] pre{white-space:pre;word-break:normal;overflow-x:auto}',

      // ── mermaid 块：图形 / 代码 切换 + 缩放 ────────────────────────
      ".md-code-block " + BANNER + " ." + TOGGLE_CLASS + "::before{-webkit-mask:var(--md-plus-icon-diagram) center/contain no-repeat;mask:var(--md-plus-icon-diagram) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + ZOOM_IN_CLASS + "::before{-webkit-mask:var(--md-plus-icon-zoom-in) center/contain no-repeat;mask:var(--md-plus-icon-zoom-in) center/contain no-repeat}",
      ".md-code-block " + BANNER + " ." + ZOOM_OUT_CLASS + "::before{-webkit-mask:var(--md-plus-icon-zoom-out) center/contain no-repeat;mask:var(--md-plus-icon-zoom-out) center/contain no-repeat}",
      '[' + MMD_ATTR + '="diagram"] .' + TOGGLE_CLASS + "{color:var(--dsw-alias-button-primary-fill,#4c6ef5);background:var(--dsw-alias-interactive-bg-active,rgb(76 110 245 / 12%))}",
      // 已经到最小 / 最大时，对应那颗按钮变淡且不可点
      '[' + ZOOM_ATTR + '="min"] .' + ZOOM_OUT_CLASS + ",[" + ZOOM_ATTR + '="max"] .' + ZOOM_IN_CLASS + "{opacity:.3;pointer-events:none}",
      // 只有画成功时才藏源码；code / failed 两态都让源码露出来
      '[' + MMD_ATTR + '="diagram"] > ' + CONTENT + " > pre{display:none}",
      '[' + MMD_ATTR + '="code"] > ' + CONTENT + " > ." + MMD_CLASS + "{display:none}",

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

      // 高亮宿主不参与布局，让里面的 <pre> 直接吃到卡片样式
      "." + HOST_CLASS + "{display:contents}",
      // 藏掉纯文本回退，只留着色结果；原节点仍在，复制读的还是它
      '[' + DONE_ATTR + '="done"] > ' + CONTENT + " > pre:not(.md-plus-pre){display:none}",

      // ── 表格 ────────────────────────────────────────────────────────
      // 抓手用结构选择器而不是 DSH 的哈希类名：外层是「唯一子元素是 table 的 div」。
      // 前面挂 [class*="_markdown_"] 有两个作用——只认 markdown 渲染出来的表格，
      // 同时把特异性顶到 (0,1,4)，压过 DSH 自己的 .tableScroll th (0,1,1)。
      TABLE + "{margin-block:16px;" + TABLE_VARS + "}",
      "body[data-ds-dark-theme] " + TABLE + "{" + TABLE_VARS_DARK + "}",
      // 整张表一个 1px 边框 + 小圆角。
      // 注意必须是 separate：collapse 模式下 Chrome 会忽略单元格的圆角，
      // 表头的灰底会在四角戳出直角。border-spacing 归零所以不会有缝。
      TABLE + " > table{border:1px solid var(--md-plus-tbl-line);border-collapse:separate;border-spacing:0;border-radius:var(--md-plus-tbl-radius);overflow:hidden}",
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
      TABLE + ".md-table-wide:hover{padding-bottom:var(--dsh-scrollbar-width,5px)}",
    ].join("\n");

    var scripts = new Map();
    var pending = new Set();
    var timer = null;
    var rescanQueued = false;
    var injected = new Set();
    var diagramSeq = 0;

    function injectStyle() {
      if (document.querySelector("style[" + STYLE_ATTR + "]") !== null) return;
      var tag = document.createElement("style");
      tag.setAttribute(STYLE_ATTR, "1");
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    /** 按需把运行时脚本挂上页面；同一个 URL 只挂一次。 */
    function loadScript(url, globalName) {
      if (window[globalName] !== undefined) return Promise.resolve(window[globalName]);
      var cached = scripts.get(url);
      if (cached !== undefined) return cached;
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

    /** 围栏信息串里的语言；banner 的第一个元素就是它。 */
    function readLang(block) {
      var banner = block.querySelector(BANNER);
      var info = banner?.firstElementChild;
      return (info?.textContent ?? "").trim().toLowerCase();
    }

    /** 正文里的图类型；没有就是 null。先剥掉 %% 注释行与 --- frontmatter 块。 */
    function sniffDiagramType(code) {
      var text = code;
      if (text.startsWith("---")) {
        var blank = text.indexOf("\n");
        var close = blank < 0 ? -1 : text.indexOf("\n---", blank);
        text = close < 0 ? "" : text.slice(close + 4);
      }
      var body = text
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("%%"))
        .join("\n");
      return MMD_TYPE.exec(body)?.[1] ?? null;
    }

    /**
     * 这块是不是 mermaid 图形。围栏名认得最可靠；标签被宿主换成占位文案时，
     * 退回正文嗅探（见 MMD_TYPE 那段注释）。
     */
    function diagramKind(block) {
      if (MMD_LANGS.has(readLang(block))) return "diagram";
      var pre = block.querySelector(CONTENT + " pre");
      if (pre === null) return null;
      return sniffDiagramType(pre.textContent ?? "") === null ? null : "diagram";
    }

    /** 这块 DOM 是不是插件自己插的（用来忽略自己触发的变更）。 */
    function isOurs(node) {
      var element = node?.nodeType === 1 ? node : node?.parentElement;
      return (
        element?.closest?.("." + HOST_CLASS + ", ." + BTN_CLASS + ", ." + MMD_CLASS) != null
      );
    }

    function schedule(block) {
      if (block !== undefined) pending.add(block);
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
    }

    function onMutations(records) {
      for (const record of records) {
        // 主题换了：SVG 里的颜色是烘死的，只能整批重画
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

    /** 插件往头部插的按钮：普通块只有「不换行」，mermaid 块多两颗缩放。 */
    var PLAIN_BUTTONS = [
      {
        cls: TOOL_CLASS,
        title: "不换行（横向滚动）",
        aria: "切换代码换行",
        run: (block) => {
          if (block.getAttribute(WRAP_ATTR) === "on") block.removeAttribute(WRAP_ATTR);
          else block.setAttribute(WRAP_ATTR, "on");
        },
      },
    ];
    var MMD_BUTTONS = [
      { cls: ZOOM_OUT_CLASS, title: "缩小", aria: "缩小流程图", run: (block) => zoomBy(block, 1 / ZOOM_STEP) },
      { cls: ZOOM_IN_CLASS, title: "放大", aria: "放大流程图", run: (block) => zoomBy(block, ZOOM_STEP) },
      {
        cls: TOGGLE_CLASS,
        title: "切换图形 / 代码",
        aria: "切换图形与代码",
        run: (block) => {
          var next = block.getAttribute(MMD_ATTR) === "code" ? "diagram" : "code";
          block.setAttribute(MMD_ATTR, next);
        },
      },
    ];

    /** 头部按钮按块的语言整组对齐：该有的补上，不该在的摘掉。 */
    function decorate(block) {
      if (!block.isConnected) return;
      var banner = block.querySelector(BANNER);
      var copy = banner?.querySelector("button:not(." + BTN_CLASS + ")");
      var action = copy?.parentElement;
      if (action === null || action === undefined) return;

      var specs = readLang(block) !== "" && diagramKind(block) !== null ? MMD_BUTTONS : PLAIN_BUTTONS;
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
        created.title = spec.title;
        created.setAttribute("aria-label", spec.aria);
        created.addEventListener("click", () => spec.run(block));
        action.insertBefore(created, copy);
        injected.add(created);
      }
    }

    async function enhance(block) {
      if (!block.isConnected) return;
      // 流式输出期间源码每帧都在变，等它定稿再处理（data-streaming 消失时会重新扫描）
      if (block.closest("[data-streaming]") !== null) return;
      var content = block.querySelector(CONTENT);
      if (content === null) return;

      var pre = content.querySelector("pre");
      // pre.shiki = DSH 自己已经上过色了
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
      // 已经处理过同一份内容就不再动它
      var key = lang + "\u0000" + code;
      if (block.getAttribute(KEY_ATTR) === key) return;

      var html;
      try {
        html = await api.highlight(code, lang);
      } catch {
        return;
      }
      if (typeof html !== "string" || html === "") return;
      // 异步期间源码可能被流式改写，那就等下一次
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
      pre.after(host);
      block.setAttribute(KEY_ATTR, key);
      block.setAttribute(DONE_ATTR, "done");
    }

    async function renderDiagram(block, content, pre) {
      var code = (pre.textContent ?? "").trim();
      if (code === "") return;
      var key = "mmd\u0000" + code;
      if (block.getAttribute(KEY_ATTR) === key) return;

      var api = await loadScript(MMD_URL, MMD_GLOBAL);
      if (api === null) return;
      if (!pre.isConnected) return;

      var svg;
      try {
        var dark = document.body.hasAttribute("data-ds-dark-theme");
        svg = await api.render("dsh-md-plus-mmd-" + ++diagramSeq, code, dark);
      } catch (error) {
        failDiagram(block, content, pre, key, error);
        return;
      }
      if (typeof svg !== "string" || svg === "") return;
      // 引擎陈旧时错误卡片会被当成渲染成功返回，别把它当图插进卡片
      if (svg.includes('aria-roledescription="error"')) {
        failDiagram(block, content, pre, key, new Error("mermaid 返回的是错误卡片"));
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
      host.innerHTML =
        '<div class="' +
        MMD_CLASS +
        '-viewport"><div class="' +
        MMD_CLASS +
        '-stage">' +
        svg +
        "</div></div>";
      var viewport = host.firstElementChild;
      if (viewport !== null) bindViewport(block, viewport);
      pre.before(host);
      content.querySelector("." + MMD_CLASS + "-error")?.remove();
      block.setAttribute(KEY_ATTR, key);
      // 用户已经切到「代码」看源码时，重画完不要把他弹回图形
      if (block.getAttribute(MMD_ATTR) !== "code") block.setAttribute(MMD_ATTR, "diagram");
      // 图换了，缩放归位
      zooms.delete(block);
      paint(block);
    }

    // ── 缩放 / 平移 ───────────────────────────────────────────────────
    // 状态挂在块上（不是 DOM 上），重画时跟着一起重置。
    var zooms = new WeakMap();

    function zoomState(block) {
      var state = zooms.get(block);
      if (state === undefined) {
        state = { scale: 1, x: 0, y: 0 };
        zooms.set(block, state);
      }
      return state;
    }

    function stageOf(block) {
      var stage = block.querySelector("." + MMD_CLASS + "-stage");
      return stage?.parentElement == null ? null : stage;
    }

    /** 把当前缩放写进 DOM。 */
    function paint(block) {
      var stage = stageOf(block);
      if (stage === null) return;
      var state = zoomState(block);
      stage.style.transform =
        "translate(" + state.x + "px," + state.y + "px) scale(" + state.scale + ")";
      stage.parentElement.setAttribute("data-zoomed", state.scale > 1.001 ? "on" : "off");
      block.setAttribute(
        ZOOM_ATTR,
        state.scale <= 1.001 ? "min" : state.scale >= ZOOM_MAX ? "max" : "mid",
      );
    }

    /** 放大后把内容夹在视口里，别让它被拖飞；缩回 1 倍自动归位。 */
    function clampPan(block, state) {
      var stage = stageOf(block);
      if (stage === null) return;
      var box = stage.parentElement.getBoundingClientRect();
      var width = stage.offsetWidth * state.scale;
      var height = stage.offsetHeight * state.scale;
      state.x =
        width <= box.width ? (box.width - width) / 2 : Math.min(0, Math.max(box.width - width, state.x));
      state.y =
        height <= box.height
          ? (box.height - height) / 2
          : Math.min(0, Math.max(box.height - height, state.y));
    }

    /**
     * 缩放一步。
     * @param block - 所属代码块。
     * @param factor - 倍率，>1 放大。
     * @param clientX/clientY - 锚点；给了就以光标为中心缩放，否则用视口中心。
     */
    function zoomBy(block, factor, clientX, clientY) {
      var stage = stageOf(block);
      if (stage === null) return;
      var state = zoomState(block);
      var next = Math.min(ZOOM_MAX, Math.max(1, state.scale * factor));
      if (Math.abs(next - state.scale) < 0.001) return;
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

    /** 滚轮缩放 + 放大后拖拽；双击回到 100%。 */
    function bindViewport(block, viewport) {
      var drag = null;

      viewport.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
          zoomBy(block, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY);
        },
        { passive: false },
      );

      viewport.addEventListener("pointerdown", (event) => {
        // 只有放大之后才接管拖拽，否则会挡掉选中文字
        if (event.button !== 0 || zoomState(block).scale <= 1.001) return;
        event.preventDefault();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch {
          /* 环境不支持就算了 */
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
          /* 同上 */
        }
        viewport.removeAttribute("data-dragging");
      };
      viewport.addEventListener("pointerup", stopDrag);
      viewport.addEventListener("pointercancel", stopDrag);

      viewport.addEventListener("dblclick", () => {
        zooms.delete(block);
        paint(block);
      });
    }

    /** 画不出来就退回源码，并在卡片里挂一行原因——总比默默消失强。 */
    function failDiagram(block, content, pre, key, error) {
      content.querySelector("." + MMD_CLASS)?.remove();
      var note = content.querySelector("." + MMD_CLASS + "-error") ?? document.createElement("p");
      note.className = MMD_CLASS + "-error";
      // 解析错误是多行报告，只留第一行，免得把卡片撑成一屏
      var reason = (error?.message ?? String(error)).split("\n")[0] ?? "";
      note.textContent = "mermaid 渲染失败：" + reason;
      content.appendChild(note);
      block.setAttribute(KEY_ATTR, key);
      block.setAttribute(MMD_ATTR, "failed");
      console.warn("[dsh-md-plus] mermaid 渲染失败", error);
    }

    function apply0(ctx) {
      if (typeof document === "undefined") return;
      ctx.effect(() => {
        injectStyle();
        var root = document.body ?? document.documentElement;
        var observer = new MutationObserver(onMutations);
        observer.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["data-streaming", "data-ds-dark-theme"],
        });
        schedule();
        return () => {
          observer.disconnect();
          for (const node of injected) node.remove();
          injected.clear();
          for (const node of document.querySelectorAll(
            "." + MMD_CLASS + ", ." + MMD_CLASS + "-error",
          )) {
            node.remove();
          }
          document.querySelector("style[" + STYLE_ATTR + "]")?.remove();
          for (const script of document.querySelectorAll("script[" + RUNTIME_ATTR + "]")) {
            script.remove();
          }
          scripts.clear();
          // 不清运行时全局的话，插件重载后 loadScript() 会直接复用旧引擎
          delete window[HL_GLOBAL];
          delete window[MMD_GLOBAL];
        };
      }, "dsh-md-plus: code block styling, highlighting and diagrams");
    }

    exports.apply = apply0;
    exports.inject = [];
    return module.exports;
  },
});
