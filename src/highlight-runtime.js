// dsh-md-plus 高亮运行时：打包成 lib/highlight-runtime.js，由宿主半经同源路由按需下发。
// 只做一件事——把 DSH 不认识的语言交给自带语法表的 Shiki，用同一套 --shiki-* 变量出图。
//
// 关键：highlighter 以空语法表创建，用到哪门语言才 loadLanguage 哪一门。
// 一次性注册全部语法要 ~3.4s；按需加载后首次着色只要 ~26ms。
import { createHighlighterCore, createCssVariablesTheme } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { LANGUAGE_MODULES } from "./languages.js";

// 与 DSH 内部同名的 css-variables 主题：token 颜色全部走 --shiki-*，天然跟随明暗主题。
const THEME = createCssVariablesTheme({
  name: "css-variables",
  variablePrefix: "--shiki-",
  fontStyle: true,
});

/** 别名 / 语法名 → 模块名。 */
const MODULE_OF = new Map();
/** 模块名 → 交给 shiki codeToHtml 的语法名。 */
const GRAMMAR_OF = new Map();

for (const [id, registrations] of Object.entries(LANGUAGE_MODULES)) {
  // 模块的主语法：优先取与模块同名的那条，否则取第一条
  const primary = registrations.find((r) => r.name.toLowerCase() === id) ?? registrations[0];
  GRAMMAR_OF.set(id, primary.name);
  MODULE_OF.set(id, id);
  MODULE_OF.set(primary.name.toLowerCase(), id);
  for (const alias of primary.aliases ?? []) MODULE_OF.set(String(alias).toLowerCase(), id);
}

function normalize(lang) {
  return String(lang ?? "").trim().toLowerCase();
}

let highlighterPromise = null;
const loaded = new Set();

function highlighter() {
  highlighterPromise ??= createHighlighterCore({
    themes: [THEME],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighterPromise;
}

async function grammarFor(id) {
  const instance = await highlighter();
  if (!loaded.has(id)) {
    await instance.loadLanguage(...LANGUAGE_MODULES[id]);
    loaded.add(id);
  }
  return instance;
}

window.__DSH_MD_PLUS_HL__ = {
  /** 这门语言有没有语法可用。 */
  supports(lang) {
    return MODULE_OF.has(normalize(lang));
  },
  /**
   * 高亮一段源码。
   * @param code - 原始源码文本。
   * @param lang - 围栏信息串里的语言。
   * @returns `pre.shiki.css-variables` 的 HTML；语言未知时返回 null。
   */
  async highlight(code, lang) {
    const id = MODULE_OF.get(normalize(lang));
    if (id === undefined) return null;
    const instance = await grammarFor(id);
    return instance.codeToHtml(code, { lang: GRAMMAR_OF.get(id), theme: THEME });
  },
};
