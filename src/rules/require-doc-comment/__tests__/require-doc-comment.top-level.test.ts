import { RuleTester } from "oxlint/plugins-dev";
import { requireDocComment } from "../index.js";

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("require-doc-comment", requireDocComment, {
  valid: [
    {
      name: "型とコンパニオンオブジェクトが同名なら、片方の doc を共有する",
      code: [
        "/** 大きさ */",
        "export type Size = { width: number };",
        "export const Size = {",
        "  /**",
        "   * 幅を返す",
        "   * @param size 大きさ",
        "   * @returns 幅",
        "   */",
        "  widthOf(size: Size): number {",
        "    return size.width;",
        "  },",
        "};",
      ].join("\n"),
    },
    {
      name: "行コメントも doc として数える",
      code: ["// 既定の幅", "export const DefaultWidth = 10;"].join("\n"),
    },
    {
      name: "export していない定数・型には doc を求めない",
      code: ["const width = 10;", "type Width = number;", "let height = 20;"].join("\n"),
    },
  ],
  invalid: [
    {
      name: "ファイル直下の関数に doc が無いと報告する",
      code: ["export function bar(x: number): number {", "  return x;", "}"].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "bar" }, line: 1 }],
    },
    {
      name: "export していないファイル直下の関数にも doc を求める",
      code: ["function bar(x: number): number {", "  return x;", "}"].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "bar" }, line: 1 }],
    },
    {
      name: "export した定数・型・interface に doc が無いと報告する",
      code: [
        "export const Width = 10;",
        "export type Height = number;",
        "export interface Box { width: number }",
      ].join("\n"),
      errors: [
        { messageId: "missingDoc", data: { name: "Width" }, line: 1 },
        { messageId: "missingDoc", data: { name: "Height" }, line: 2 },
        { messageId: "missingDoc", data: { name: "Box" }, line: 3 },
      ],
    },
    {
      name: "コンパニオンを閉じた後ろのファイル直下の関数に doc が無いと報告する",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  /**",
        "   * 足す",
        "   * @param x 元の値",
        "   * @returns 足した値",
        "   */",
        "  bar(x: number): number {",
        "    return x;",
        "  },",
        "};",
        "",
        "export function later(x: number): number {",
        "  return x;",
        "}",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "later" }, line: 13 }],
    },
    {
      name: "前の文の行末に付いたコメントは、次の宣言の doc として読まない",
      code: ["/** 幅 */", "export const Width = 10; // px", "export const Height = 20;"].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Height" }, line: 3 }],
    },
  ],
});
