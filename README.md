# dlint-rules

[oxlint](https://oxc.rs/docs/guide/usage/linter) の JS プラグインとして読み込む独自 lint ルール集。

design-composer の `.claude/hooks/lib/` にある Python 検出器（正規表現・行単位の判定）を、AST で判定する lint ルールへ置き換えていくための置き場。ルールはリポジトリ固有のパスを持たず、**どのファイルに効かせるかは利用側の `.oxlintrc.json`（`overrides` / `ignorePatterns`）で決める**。

## 使い方

```jsonc
// .oxlintrc.json
{
  "jsPlugins": ["dlint-rules"],
  "rules": {
    "dlint/require-doc-comment": "error"
  },
  "overrides": [
    {
      // テスト・ストーリーには doc を求めない
      "files": ["**/__tests__/**", "**/__stories__/**", "**/*.stories.*"],
      "rules": { "dlint/require-doc-comment": "off" }
    }
  ]
}
```

oxlint 1.94.0 で動作を確認している（`peerDependencies`）。JS プラグインは oxlint 側でまだ実験的な機能のため、oxlint を上げるときはこのリポジトリのテストを先に通す。

## ルール

| ルール | 内容 | 移植元 |
| --- | --- | --- |
| `dlint/require-doc-comment` | ファイル直下の宣言とコンパニオンオブジェクト直下のメソッドに doc コメントを求め、関数の doc に `@param` / `@returns` / `@throws` の欠けがあれば報告する | `missing-doc-comments.py` |

### `dlint/require-doc-comment`

**doc を求める対象**

- ファイル直下の関数宣言（`export` の有無を問わない）
- `export` した `const` / `type` / `interface`
- `const` で宣言したオブジェクトリテラル（`as const` / `satisfies` 付きを含む）の**直下**にある、関数を値に持つプロパティ（`bar() {}` / `bar: () => ...`）。名前は `Owner.bar` で報告する

入れ子のオブジェクトのメソッドは見ない（意図した取りこぼし）。同じファイルに同名の宣言があってそちらに doc があれば、doc の無い側は報告しない（型とコンパニオンオブジェクトが 1 つの doc を共有する形のため）。前の文の行末に付いたコメントは doc として読まない。

**項目を求める対象**（ファイル直下の関数宣言とコンパニオンのメソッドの、ブロックコメントの doc）

| 項目 | 求める条件 |
| --- | --- |
| `@param` | 名前の付いた引数がある（分割代入だけの引数と `this` は数えない） |
| `@returns` | 戻り値の型注釈があり、`void` / `Promise<void>` でない |
| `@throws` | 本体に `throw` がある（入れ子のコールバックの中も数える） |

**設定**

| 名前 | 既定 | 内容 |
| --- | --- | --- |
| `checkTags` | `true` | `false` で doc の有無だけを見る |

```jsonc
"dlint/require-doc-comment": ["error", { "checkTags": false }]
```

## 開発

```bash
pnpm install
```

```bash
pnpm run test:run   # ルールの単体テスト（RuleTester）と、実物の oxlint から読み込む結合テスト
```

```bash
pnpm run typecheck
```

```bash
pnpm run lint
```

- ルールは `src/rules/<ルール名>/index.ts` に置き、`src/index.ts` のプラグインへ登録する
- テストは `src/rules/<ルール名>/__tests__/<ルール名>.<カテゴリ>.test.ts`。`RuleTester` の describe は平らにしてあり（`src/__tests__/rule-tester-setup.ts`）、各ケースの `name` がそのままテスト名になるので仕様の文で書く
- 結合テスト（`src/__tests__/plugin.cli.test.ts`）は `dist/` を読むため、テストの前に `pnpm run build` が走る
