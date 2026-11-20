import type { Plugin } from "@oxlint/plugins";
import { requireDocComment } from "./rules/require-doc-comment/index.js";

/**
 * oxlint の `jsPlugins` から読み込むプラグイン。ルールは `dlint/<ルール名>` で有効にする。
 */
const plugin: Plugin = {
  meta: { name: "dlint" },
  rules: {
    "require-doc-comment": requireDocComment,
  },
};

export default plugin;
