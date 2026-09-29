// dsh-md-plus 的 mermaid 主题。
// 配色是从参考设计图上取样量出来的（节点底 #e5f2ff、文字与连线 #339cff、圆角 ~11px、行距 41px）。
// mermaid 的 token 名见 https://mermaid.js.org/config/theming.html

/** 两套配色只差颜色，几何参数共用。 */
const GEOMETRY = {
  fontSize: "16px",
  // 参考图里箭头是直的，节点之间留 41px
  flowchart: { curve: "basis", nodeSpacing: 40, rankSpacing: 41, padding: 18, useMaxWidth: true },
};

const LIGHT = {
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

const DARK = {
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

/**
 * 组装 mermaid.initialize 的配置。
 * @param dark - 是否深色主题。
 * @param fontFamily - 页面正文字体栈，从 body 的计算样式读来，跟 DSH 设置保持一致。
 */
export function buildConfig(dark, fontFamily) {
  const color = dark ? DARK : LIGHT;
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
