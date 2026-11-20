import { RuleTester } from "oxlint/plugins-dev";
import { requireDocComment } from "../index.js";

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("require-doc-comment", requireDocComment, {
  valid: [
    {
      name: "分割代入だけを引数に取る関数には @param を求めない",
      code: [
        "/**",
        " * 描く",
        " * @returns 描いた結果",
        " */",
        "export function draw({ width }: { width: number }): number {",
        "  return width;",
        "}",
      ].join("\n"),
    },
    {
      name: "this の型注釈は引数として数えず @param を求めない",
      code: [
        "/**",
        " * 幅を返す",
        " * @returns 幅",
        " */",
        "export function widthOf(this: { width: number }): number {",
        "  return this.width;",
        "}",
      ].join("\n"),
    },
    {
      name: "void / Promise<void> を返す関数には @returns を求めない",
      code: [
        "/**",
        " * 保存する",
        " * @param path 保存先",
        " */",
        "export function save(path: string): void {}",
        "/**",
        " * 非同期に保存する",
        " * @param path 保存先",
        " */",
        "export async function saveAsync(path: string): Promise<void> {}",
      ].join("\n"),
    },
    {
      name: "戻り値の型注釈が無い関数には @returns を求めない",
      code: ["/**", " * 足す", " * @param x 元の値", " */", "export function add(x: number) {", "  return x + 1;", "}"].join(
        "\n",
      ),
    },
    {
      name: "export した定数には関数であっても項目を求めない",
      code: ["/** 足す */", "export const add = (x: number): number => x + 1;"].join("\n"),
    },
    {
      name: "checkTags を false にすると、項目の欠けた doc を報告しない",
      code: ["/** 足す */", "export function add(x: number): number {", "  return x + 1;", "}"].join("\n"),
      options: [{ checkTags: false }],
    },
  ],
  invalid: [
    {
      name: "メソッドの doc に @param / @returns が無いと報告する",
      code: [
        "/** 値 */",
        "export const Foo = {",
        "  /** 足す */",
        "  bar(x: number): number {",
        "    return x;",
        "  },",
        "};",
      ].join("\n"),
      errors: [{ messageId: "missingTags", data: { name: "Foo.bar", tags: "@param / @returns" }, line: 4 }],
    },
    {
      name: "本体に throw があるのに doc に @throws が無いと報告する",
      code: [
        "/**",
        " * 取り出す",
        " * @param x 元の値",
        " */",
        "export function unwrap(x: number): void {",
        "  if (x < 0) {",
        '    throw new Error("negative");',
        "  }",
        "}",
      ].join("\n"),
      errors: [{ messageId: "missingTags", data: { name: "unwrap", tags: "@throws" }, line: 5 }],
    },
    {
      name: "既定値付き・残余引数も名前付きの引数として @param を求める",
      code: [
        "/**",
        " * 足す",
        " * @returns 合計",
        " */",
        "export function sum(first = 0, ...rest: number[]): number {",
        "  return rest.reduce((a, b) => a + b, first);",
        "}",
      ].join("\n"),
      errors: [{ messageId: "missingTags", data: { name: "sum", tags: "@param" }, line: 5 }],
    },
  ],
});
