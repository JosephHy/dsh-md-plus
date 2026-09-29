// dsh-md-plus 补的高亮语言（DSH 自带 26 种之外的部分）。
// 想加语言：在对应分组里补一个 id，再在文件末尾的 LANGUAGE_MODULES 里挂上。
// id 取自 @shikijs/langs 的模块名；每个模块的默认导出是一个 LanguageRegistration[]，
// 里面通常还含它依赖的嵌入语法（如 vue 带 html/css），所以整份交给 loadLanguage。

// 移动与客户端
import langDart from "@shikijs/langs/dart";
import langGdscript from "@shikijs/langs/gdscript";
import langGdshader from "@shikijs/langs/gdshader";
import langTscn from "@shikijs/langs/tscn";
import langTres from "@shikijs/langs/tres";

// 脚本与终端
import langPowershell from "@shikijs/langs/powershell";
import langPs1 from "@shikijs/langs/ps1";
import langPwsh from "@shikijs/langs/pwsh";
import langBat from "@shikijs/langs/bat";
import langBatch from "@shikijs/langs/batch";
import langCmd from "@shikijs/langs/cmd";
import langFish from "@shikijs/langs/fish";
import langAwk from "@shikijs/langs/awk";
import langTcl from "@shikijs/langs/tcl";
import langViml from "@shikijs/langs/viml";
import langVimscript from "@shikijs/langs/vimscript";
import langNushell from "@shikijs/langs/nushell";
import langNu from "@shikijs/langs/nu";
import langApplescript from "@shikijs/langs/applescript";
import langAhk from "@shikijs/langs/ahk";
import langGnuplot from "@shikijs/langs/gnuplot";
import langJust from "@shikijs/langs/just";
import langMakefile from "@shikijs/langs/makefile";
import langMake from "@shikijs/langs/make";
import langCmake from "@shikijs/langs/cmake";
import langDockerfile from "@shikijs/langs/dockerfile";
import langDocker from "@shikijs/langs/docker";
import langNginx from "@shikijs/langs/nginx";
import langApache from "@shikijs/langs/apache";
import langSshConfig from "@shikijs/langs/ssh-config";
import langSystemd from "@shikijs/langs/systemd";
import langProperties from "@shikijs/langs/properties";
import langDotenv from "@shikijs/langs/dotenv";
import langCsv from "@shikijs/langs/csv";
import langTsv from "@shikijs/langs/tsv";
import langLog from "@shikijs/langs/log";
import langGitCommit from "@shikijs/langs/git-commit";
import langGitRebase from "@shikijs/langs/git-rebase";
import langDiff from "@shikijs/langs/diff";
import langHttp from "@shikijs/langs/http";
import langHurl from "@shikijs/langs/hurl";
import langCodeowners from "@shikijs/langs/codeowners";
import langReg from "@shikijs/langs/reg";
import langRegex from "@shikijs/langs/regex";

// JVM 与函数式
import langScala from "@shikijs/langs/scala";
import langClojure from "@shikijs/langs/clojure";
import langClj from "@shikijs/langs/clj";
import langElixir from "@shikijs/langs/elixir";
import langErlang from "@shikijs/langs/erlang";
import langErl from "@shikijs/langs/erl";
import langHaskell from "@shikijs/langs/haskell";
import langHs from "@shikijs/langs/hs";
import langFsharp from "@shikijs/langs/fsharp";
import langFs from "@shikijs/langs/fs";
import langOcaml from "@shikijs/langs/ocaml";
import langGroovy from "@shikijs/langs/groovy";
import langJulia from "@shikijs/langs/julia";
import langJl from "@shikijs/langs/jl";
import langR from "@shikijs/langs/r";
import langRacket from "@shikijs/langs/racket";
import langScheme from "@shikijs/langs/scheme";
import langCommonLisp from "@shikijs/langs/common-lisp";
import langEmacsLisp from "@shikijs/langs/emacs-lisp";
import langPurescript from "@shikijs/langs/purescript";
import langElm from "@shikijs/langs/elm";
import langGleam from "@shikijs/langs/gleam";
import langHaxe from "@shikijs/langs/haxe";
import langCrystal from "@shikijs/langs/crystal";
import langAda from "@shikijs/langs/ada";
import langCobol from "@shikijs/langs/cobol";
import langPascal from "@shikijs/langs/pascal";
import langFortranFreeForm from "@shikijs/langs/fortran-free-form";
import langD from "@shikijs/langs/d";
import langNim from "@shikijs/langs/nim";
import langZig from "@shikijs/langs/zig";
import langV from "@shikijs/langs/v";
import langVala from "@shikijs/langs/vala";
import langOdin from "@shikijs/langs/odin";
import langMojo from "@shikijs/langs/mojo";
import langLean4 from "@shikijs/langs/lean4";
import langProlog from "@shikijs/langs/prolog";
import langRaku from "@shikijs/langs/raku";
import langPerl from "@shikijs/langs/perl";
import langVb from "@shikijs/langs/vb";
import langVerilog from "@shikijs/langs/verilog";
import langVhdl from "@shikijs/langs/vhdl";
import langSystemVerilog from "@shikijs/langs/system-verilog";
import langAsm from "@shikijs/langs/asm";
import langWasm from "@shikijs/langs/wasm";
import langGlsl from "@shikijs/langs/glsl";
import langHlsl from "@shikijs/langs/hlsl";
import langWgsl from "@shikijs/langs/wgsl";
import langShaderlab from "@shikijs/langs/shaderlab";
import langLlvm from "@shikijs/langs/llvm";
import langMips from "@shikijs/langs/mips";
import langRiscv from "@shikijs/langs/riscv";

// Web 前端
import langVue from "@shikijs/langs/vue";
import langVueHtml from "@shikijs/langs/vue-html";
import langSvelte from "@shikijs/langs/svelte";
import langAstro from "@shikijs/langs/astro";
import langPug from "@shikijs/langs/pug";
import langJade from "@shikijs/langs/jade";
import langHaml from "@shikijs/langs/haml";
import langHandlebars from "@shikijs/langs/handlebars";
import langHbs from "@shikijs/langs/hbs";
import langJinja from "@shikijs/langs/jinja";
import langJinjaHtml from "@shikijs/langs/jinja-html";
import langLiquid from "@shikijs/langs/liquid";
import langTwig from "@shikijs/langs/twig";
import langErb from "@shikijs/langs/erb";
import langRazor from "@shikijs/langs/razor";
import langBlade from "@shikijs/langs/blade";
import langPostcss from "@shikijs/langs/postcss";
import langSass from "@shikijs/langs/sass";
import langStylus from "@shikijs/langs/stylus";
import langMarko from "@shikijs/langs/marko";
import langCoffeescript from "@shikijs/langs/coffeescript";
import langCoffee from "@shikijs/langs/coffee";
import langActionscript from "@shikijs/langs/actionscript";
import langAngularHtml from "@shikijs/langs/angular-html";
import langAngularTs from "@shikijs/langs/angular-ts";

// 配置与基础设施
import langHjson from "@shikijs/langs/hjson";
import langJson5 from "@shikijs/langs/json5";
import langJsonnet from "@shikijs/langs/jsonnet";
import langJsonl from "@shikijs/langs/jsonl";
import langKdl from "@shikijs/langs/kdl";
import langNix from "@shikijs/langs/nix";
import langTerraform from "@shikijs/langs/terraform";
import langTf from "@shikijs/langs/tf";
import langHcl from "@shikijs/langs/hcl";
import langTfvars from "@shikijs/langs/tfvars";
import langBicep from "@shikijs/langs/bicep";
import langPrisma from "@shikijs/langs/prisma";
import langGraphql from "@shikijs/langs/graphql";
import langGql from "@shikijs/langs/gql";
import langProtobuf from "@shikijs/langs/protobuf";
import langProto from "@shikijs/langs/proto";
import langCypher from "@shikijs/langs/cypher";
import langCql from "@shikijs/langs/cql";
import langSparql from "@shikijs/langs/sparql";
import langTurtle from "@shikijs/langs/turtle";
import langSolidity from "@shikijs/langs/solidity";
import langVyper from "@shikijs/langs/vyper";
import langMove from "@shikijs/langs/move";
import langCairo from "@shikijs/langs/cairo";
import langCue from "@shikijs/langs/cue";
import langDax from "@shikijs/langs/dax";
import langPowerquery from "@shikijs/langs/powerquery";
import langKql from "@shikijs/langs/kql";
import langKusto from "@shikijs/langs/kusto";
import langSpl from "@shikijs/langs/spl";
import langPlsql from "@shikijs/langs/plsql";
import langSas from "@shikijs/langs/sas";
import langStata from "@shikijs/langs/stata";
import langMatlab from "@shikijs/langs/matlab";
import langWolfram from "@shikijs/langs/wolfram";
import langTypst from "@shikijs/langs/typst";
import langLatex from "@shikijs/langs/latex";
import langTex from "@shikijs/langs/tex";
import langBibtex from "@shikijs/langs/bibtex";
import langAsciidoc from "@shikijs/langs/asciidoc";
import langAdoc from "@shikijs/langs/adoc";
import langRst from "@shikijs/langs/rst";
import langMediawiki from "@shikijs/langs/mediawiki";
import langWikitext from "@shikijs/langs/wikitext";
import langOrg from "@shikijs/langs/org";
import langGherkin from "@shikijs/langs/gherkin";
import langSmalltalk from "@shikijs/langs/smalltalk";
import langPuppet from "@shikijs/langs/puppet";
import langNsis from "@shikijs/langs/nsis";
import langOpenscad from "@shikijs/langs/openscad";

/** 模块名 → 语法注册数组。按需加载的粒度就是这里的每一项。 */
export const LANGUAGE_MODULES = {
  // 移动与客户端
  "dart": langDart,
  "gdscript": langGdscript,
  "gdshader": langGdshader,
  "tscn": langTscn,
  "tres": langTres,
  // 脚本与终端
  "powershell": langPowershell,
  "ps1": langPs1,
  "pwsh": langPwsh,
  "bat": langBat,
  "batch": langBatch,
  "cmd": langCmd,
  "fish": langFish,
  "awk": langAwk,
  "tcl": langTcl,
  "viml": langViml,
  "vimscript": langVimscript,
  "nushell": langNushell,
  "nu": langNu,
  "applescript": langApplescript,
  "ahk": langAhk,
  "gnuplot": langGnuplot,
  "just": langJust,
  "makefile": langMakefile,
  "make": langMake,
  "cmake": langCmake,
  "dockerfile": langDockerfile,
  "docker": langDocker,
  "nginx": langNginx,
  "apache": langApache,
  "ssh-config": langSshConfig,
  "systemd": langSystemd,
  "properties": langProperties,
  "dotenv": langDotenv,
  "csv": langCsv,
  "tsv": langTsv,
  "log": langLog,
  "git-commit": langGitCommit,
  "git-rebase": langGitRebase,
  "diff": langDiff,
  "http": langHttp,
  "hurl": langHurl,
  "codeowners": langCodeowners,
  "reg": langReg,
  "regex": langRegex,
  // JVM 与函数式
  "scala": langScala,
  "clojure": langClojure,
  "clj": langClj,
  "elixir": langElixir,
  "erlang": langErlang,
  "erl": langErl,
  "haskell": langHaskell,
  "hs": langHs,
  "fsharp": langFsharp,
  "fs": langFs,
  "ocaml": langOcaml,
  "groovy": langGroovy,
  "julia": langJulia,
  "jl": langJl,
  "r": langR,
  "racket": langRacket,
  "scheme": langScheme,
  "common-lisp": langCommonLisp,
  "emacs-lisp": langEmacsLisp,
  "purescript": langPurescript,
  "elm": langElm,
  "gleam": langGleam,
  "haxe": langHaxe,
  "crystal": langCrystal,
  "ada": langAda,
  "cobol": langCobol,
  "pascal": langPascal,
  "fortran-free-form": langFortranFreeForm,
  "d": langD,
  "nim": langNim,
  "zig": langZig,
  "v": langV,
  "vala": langVala,
  "odin": langOdin,
  "mojo": langMojo,
  "lean4": langLean4,
  "prolog": langProlog,
  "raku": langRaku,
  "perl": langPerl,
  "vb": langVb,
  "verilog": langVerilog,
  "vhdl": langVhdl,
  "system-verilog": langSystemVerilog,
  "asm": langAsm,
  "wasm": langWasm,
  "glsl": langGlsl,
  "hlsl": langHlsl,
  "wgsl": langWgsl,
  "shaderlab": langShaderlab,
  "llvm": langLlvm,
  "mips": langMips,
  "riscv": langRiscv,
  // Web 前端
  "vue": langVue,
  "vue-html": langVueHtml,
  "svelte": langSvelte,
  "astro": langAstro,
  "pug": langPug,
  "jade": langJade,
  "haml": langHaml,
  "handlebars": langHandlebars,
  "hbs": langHbs,
  "jinja": langJinja,
  "jinja-html": langJinjaHtml,
  "liquid": langLiquid,
  "twig": langTwig,
  "erb": langErb,
  "razor": langRazor,
  "blade": langBlade,
  "postcss": langPostcss,
  "sass": langSass,
  "stylus": langStylus,
  "marko": langMarko,
  "coffeescript": langCoffeescript,
  "coffee": langCoffee,
  "actionscript": langActionscript,
  "angular-html": langAngularHtml,
  "angular-ts": langAngularTs,
  // 配置与基础设施
  "hjson": langHjson,
  "json5": langJson5,
  "jsonnet": langJsonnet,
  "jsonl": langJsonl,
  "kdl": langKdl,
  "nix": langNix,
  "terraform": langTerraform,
  "tf": langTf,
  "hcl": langHcl,
  "tfvars": langTfvars,
  "bicep": langBicep,
  "prisma": langPrisma,
  "graphql": langGraphql,
  "gql": langGql,
  "protobuf": langProtobuf,
  "proto": langProto,
  "cypher": langCypher,
  "cql": langCql,
  "sparql": langSparql,
  "turtle": langTurtle,
  "solidity": langSolidity,
  "vyper": langVyper,
  "move": langMove,
  "cairo": langCairo,
  "cue": langCue,
  "dax": langDax,
  "powerquery": langPowerquery,
  "kql": langKql,
  "kusto": langKusto,
  "spl": langSpl,
  "plsql": langPlsql,
  "sas": langSas,
  "stata": langStata,
  "matlab": langMatlab,
  "wolfram": langWolfram,
  "typst": langTypst,
  "latex": langLatex,
  "tex": langTex,
  "bibtex": langBibtex,
  "asciidoc": langAsciidoc,
  "adoc": langAdoc,
  "rst": langRst,
  "mediawiki": langMediawiki,
  "wikitext": langWikitext,
  "org": langOrg,
  "gherkin": langGherkin,
  "smalltalk": langSmalltalk,
  "puppet": langPuppet,
  "nsis": langNsis,
  "openscad": langOpenscad,
};
