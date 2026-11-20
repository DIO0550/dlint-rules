import { RuleTester } from "oxlint/plugins-dev";
import { requireDocComment } from "../index.js";

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("require-doc-comment", requireDocComment, {
  valid: [
    {
      name: "メソッドに @param / @returns の揃った doc があれば報告しない",
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
      ].join("\n"),
    },
    {
      name: "type の型リテラルにある関数型のメンバはメソッドとして読まない",
      code: ["/** 型 */", "export type Foo = {", "  ref: (kind: string) => string;", "};"].join("\n"),
    },
    {
      name: "対応表の値が関数でなければメソッドとして読まない",
      code: ["/** 表 */", "export const Foo = {", '  colors: "Color",', "};"].join("\n"),
    },
    {
      name: "値が括弧で始まるだけのプロパティはメソッドとして読まない",
      code: ["/** 値 */", "export const Foo = {", "  width: (1 + 2) * 3,", "};"].join("\n"),
    },
    {
      name: "入れ子のオブジェクトのメソッドは doc が無くても報告しない（意図した取りこぼし）",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  /** 入れ子 */",
        "  refs: {",
        "    bar(x: number): number {",
        "      return x;",
        "    },",
        "  },",
        "};",
      ].join("\n"),
    },
  ],
  invalid: [
    {
      name: "コンパニオンオブジェクトのメソッドに doc が無いと報告する",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  bar(x: number): number {",
        "    return x;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.bar" }, line: 3 }],
    },
    {
      name: "シグネチャを改行したメソッドに doc が無いと報告する",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  bar(",
        "    x: number,",
        "  ): number {",
        "    return x;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.bar" }, line: 3 }],
    },
    {
      name: "関数プロパティ（name: (x) => {）に doc が無いと報告する",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  bar: (x: number): number => {",
        "    return x;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.bar" }, line: 3 }],
    },
    {
      name: "式本体の関数プロパティ（name: (x) => Math.abs(x)）に doc が無いと報告する",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  bar: (x: number): number => Math.abs(x),",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.bar" }, line: 3 }],
    },
    {
      name: "型注釈の付いたコンパニオン（const Foo: Bar = {）のメソッドに doc が無いと報告する",
      code: [
        "/** 型 */",
        "export type Bar = { bar(x: number): number };",
        "/** 値 */",
        "export const Foo: Bar = {",
        "  bar(x: number): number {",
        "    return x;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.bar" }, line: 5 }],
    },
    {
      name: "as const / satisfies を付けたコンパニオンのメソッドに doc が無いと報告する",
      code: [
        "/** 型 */",
        "type Bar = { bar(x: number): number };",
        "/** 値 */",
        "export const Foo = {",
        "  bar(x: number): number {",
        "    return x;",
        "  },",
        "} as const satisfies Bar;",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.bar" }, line: 5 }],
    },
    {
      name: "export していないコンパニオンのメソッドに doc が無いと報告する",
      code: [
        "/** 値 */",
        "const Foo = {",
        "  bar(x: number): number {",
        "    return x;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.bar" }, line: 3 }],
    },
    {
      name: "文字列の中に { があっても、その後ろのメソッドを報告する",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  /**",
        "   * 括弧を足す",
        "   * @param x 元の文字列",
        "   * @returns 足した文字列",
        "   */",
        "  a(x: string): string {",
        '    return x + "{";',
        "  },",
        "  b(x: number): number {",
        "    return x;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingDoc", data: { name: "Foo.b" }, line: 11 }],
    },
  ],
});
