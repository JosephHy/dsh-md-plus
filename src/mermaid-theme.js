// dsh-md-plus 的 mermaid 主题。
// 默认蓝色配色从参考设计图上取样（节点底 #e5f2ff、文字与连线 #339cff、圆角 ~11px、行距 41px）。
// mermaid 的 token 名见 https://mermaid.js.org/config/theming.html

/** 几何参数所有配色共用。 */
const GEOMETRY = {
  fontSize: "16px",
  // 参考图里箭头是直的，节点之间留 41px
  flowchart: { curve: "basis", nodeSpacing: 40, rankSpacing: 41, padding: 18, useMaxWidth: true },
};

const BLUE_LIGHT = {
  background: "transparent",
  primaryColor: "#e5f2ff",
  primaryTextColor: "#339cff",
  primaryBorderColor: "#e5f2ff",
  secondaryColor: "#e5f2ff",
  tertiaryColor: "#e5f2ff",
  lineColor: "#339cff",
  edgeLabelBackground: "#ffffff",
  clusterBkg: "#f2f8ff",
  clusterBorder: "#cde7ff",
  titleColor: "#339cff",
  nodeTextColor: "#339cff",
};

const BLUE_DARK = {
  background: "transparent",
  primaryColor: "#16283d",
  primaryTextColor: "#79bdff",
  primaryBorderColor: "#16283d",
  secondaryColor: "#16283d",
  tertiaryColor: "#16283d",
  lineColor: "#5aa9f0",
  edgeLabelBackground: "#0f1115",
  clusterBkg: "#132133",
  clusterBorder: "#2b4a6b",
  titleColor: "#79bdff",
  nodeTextColor: "#79bdff",
};

/** 中性灰：适合文档、截图和打印，不抢正文颜色。 */
const NEUTRAL_LIGHT = {
  background: "transparent",
  primaryColor: "#f2f2f2",
  primaryTextColor: "#222222",
  primaryBorderColor: "#c9c9c9",
  secondaryColor: "#f2f2f2",
  tertiaryColor: "#f2f2f2",
  lineColor: "#666666",
  edgeLabelBackground: "#ffffff",
  clusterBkg: "#fafafa",
  clusterBorder: "#dddddd",
  titleColor: "#222222",
  nodeTextColor: "#222222",
};

const NEUTRAL_DARK = {
  background: "transparent",
  primaryColor: "#2a2a2a",
  primaryTextColor: "#eeeeee",
  primaryBorderColor: "#555555",
  secondaryColor: "#2a2a2a",
  tertiaryColor: "#2a2a2a",
  lineColor: "#aaaaaa",
  edgeLabelBackground: "#111111",
  clusterBkg: "#1f1f1f",
  clusterBorder: "#3a3a3a",
  titleColor: "#eeeeee",
  nodeTextColor: "#eeeeee",
};

/** 森林绿：适合流程、审批和偏“状态/健康”的图。 */
const FOREST_LIGHT = {
  background: "transparent",
  primaryColor: "#e8f5e9",
  primaryTextColor: "#1b5e20",
  primaryBorderColor: "#a5d6a7",
  secondaryColor: "#e8f5e9",
  tertiaryColor: "#e8f5e9",
  lineColor: "#43a047",
  edgeLabelBackground: "#ffffff",
  clusterBkg: "#f1f8e9",
  clusterBorder: "#c8e6c9",
  titleColor: "#1b5e20",
  nodeTextColor: "#1b5e20",
};

const FOREST_DARK = {
  background: "transparent",
  primaryColor: "#1b3320",
  primaryTextColor: "#a5d6a7",
  primaryBorderColor: "#2e7d32",
  secondaryColor: "#1b3320",
  tertiaryColor: "#1b3320",
  lineColor: "#66bb6a",
  edgeLabelBackground: "#0f1115",
  clusterBkg: "#142418",
  clusterBorder: "#2e4a34",
  titleColor: "#a5d6a7",
  nodeTextColor: "#a5d6a7",
};

/** 高对比：黑白为主，适合投影或无障碍阅读。 */
const CONTRAST_LIGHT = {
  background: "transparent",
  primaryColor: "#ffffff",
  primaryTextColor: "#000000",
  primaryBorderColor: "#000000",
  secondaryColor: "#ffffff",
  tertiaryColor: "#ffffff",
  lineColor: "#000000",
  edgeLabelBackground: "#ffffff",
  clusterBkg: "#ffffff",
  clusterBorder: "#000000",
  titleColor: "#000000",
  nodeTextColor: "#000000",
};

const CONTRAST_DARK = {
  background: "transparent",
  primaryColor: "#0b0b0b",
  primaryTextColor: "#ffffff",
  primaryBorderColor: "#ffffff",
  secondaryColor: "#0b0b0b",
  tertiaryColor: "#0b0b0b",
  lineColor: "#ffffff",
  edgeLabelBackground: "#0b0b0b",
  clusterBkg: "#0b0b0b",
  clusterBorder: "#ffffff",
  titleColor: "#ffffff",
  nodeTextColor: "#ffffff",
};

const PRESETS = {
  blue: { light: BLUE_LIGHT, dark: BLUE_DARK },
  neutral: { light: NEUTRAL_LIGHT, dark: NEUTRAL_DARK },
  forest: { light: FOREST_LIGHT, dark: FOREST_DARK },
  contrast: { light: CONTRAST_LIGHT, dark: CONTRAST_DARK },
};

/** 客户端可用的配色名；顺序就是工具栏循环顺序。 */
export const THEME_PRESETS = Object.keys(PRESETS);

/**
 * 组装 mermaid.initialize 的配置。
 * @param dark - 是否深色主题。
 * @param fontFamily - 页面正文字体栈，从 body 的计算样式读来，跟 DSH 设置保持一致。
 * @param preset - 配色预设，未知值回退到 blue。
 */
export function buildConfig(dark, fontFamily, preset = "blue") {
  const chosen = PRESETS[preset] ?? PRESETS.blue;
  const color = dark ? chosen.dark : chosen.light;
  return {
    startOnLoad: false,
    // 图源是模型写的，按不可信内容处理
    securityLevel: "strict",
    theme: "base",
    fontFamily,
    themeVariables: { ...color, ...GEOMETRY },
    flowchart: GEOMETRY.flowchart,
    // token 覆盖不到的地方在这里补：字重、圆角、线宽
    themeCSS: [
      ".nodeLabel,.edgeLabel,.label{font-weight:600}",
      ".flowchart-link{stroke-width:1.6px}",
      `.marker,.arrowheadPath{fill:${color.lineColor};stroke:${color.lineColor}}`,
    ].join(""),
  };
}

/** 节点圆角（SVG 用户单位）；mermaid 不认识这个 token，渲染后由客户端补。 */
export const NODE_RADIUS = 11;
