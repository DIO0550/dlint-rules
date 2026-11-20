import type { Context, ESTree, Rule } from "@oxlint/plugins";

/**
 * doc を求める関数。項目（`@param` / `@returns` / `@throws`）を見る対象になる。
 */
type DocumentedFunction =
  | ESTree.Function
  | ESTree.ArrowFunctionExpression;

/**
 * doc を求める宣言 1 つ。
 *
 * `anchor` は doc コメントを探す起点。`export` 付きの宣言は `export` の前に doc が来るため、
 * 宣言そのものではなく文を指す。
 */
type DocTarget = Readonly<{
  name: string;
  anchor: ESTree.Node;
  fn: DocumentedFunction | null;
}>;

/**
 * ルールの設定。
 */
type RequireDocCommentOptions = Readonly<{
  /** `false` にすると doc の有無だけを見て、`@param` / `@returns` / `@throws` の欠けを報告しない。 */
  checkTags: boolean;
}>;

const DefaultOptions: RequireDocCommentOptions = { checkTags: true };

/**
 * `as const` / `satisfies T` を外した中身を返す。
 *
 * @param expression 変数の初期化式
 * @returns 型の注記を外した式
 */
const unwrapTypeAssertion = (expression: ESTree.Expression): ESTree.Expression =>
  expression.type === "TSAsExpression" || expression.type === "TSSatisfiesExpression"
    ? unwrapTypeAssertion(expression.expression)
    : expression;

/**
 * コンパニオンオブジェクト（`const Foo = { ... }`）の直下にあるメソッドを列挙する。
 *
 * 入れ子のオブジェクトのメソッドは見ない。doc を求めるのはロジックの入口になる直下だけにし、
 * 対応表の中の関数などで偽陽性を出さないため。
 *
 * @param owner オブジェクトを束ねる変数名
 * @param object オブジェクトリテラル
 * @returns メソッドごとの対象。名前は `Owner.method` の綴り
 */
const companionMethods = (owner: string, object: ESTree.ObjectExpression): DocTarget[] =>
  object.properties.flatMap((property) => {
    if (property.type !== "Property" || property.key.type !== "Identifier") {
      return [];
    }
    const value = property.value;
    const isFunction =
      value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression";
    return isFunction ? [{ name: `${owner}.${property.key.name}`, anchor: property, fn: value }] : [];
  });

/**
 * 変数宣言から対象を集める。`export` された定数そのものと、`const` のコンパニオンオブジェクトの
 * メソッドが対象になる。
 *
 * @param declaration 変数宣言
 * @param anchor doc を探す起点（`export` 付きなら `export` 文）
 * @param exported `export` されているか
 * @returns 対象の一覧
 */
const variableTargets = (
  declaration: ESTree.VariableDeclaration,
  anchor: ESTree.Node,
  exported: boolean,
): DocTarget[] => {
  if (declaration.kind !== "const") {
    return [];
  }
  return declaration.declarations.flatMap((declarator) => {
    if (declarator.id.type !== "Identifier") {
      return [];
    }
    const name = declarator.id.name;
    const self: DocTarget[] = exported ? [{ name, anchor, fn: null }] : [];
    const init = declarator.init === null ? null : unwrapTypeAssertion(declarator.init);
    const methods = init?.type === "ObjectExpression" ? companionMethods(name, init) : [];
    return [...self, ...methods];
  });
};

/**
 * ファイル直下の 1 文から対象を集める。
 *
 * @param statement ファイル直下の文
 * @returns 対象の一覧。対象を含まない文なら空
 */
const statementTargets = (statement: ESTree.Program["body"][number]): DocTarget[] => {
  const exported = statement.type === "ExportNamedDeclaration";
  const declaration = exported ? statement.declaration : statement;
  if (declaration === null) {
    return [];
  }
  switch (declaration.type) {
    case "FunctionDeclaration":
    case "TSDeclareFunction":
      return declaration.id === null
        ? []
        : [{ name: declaration.id.name, anchor: statement, fn: declaration }];
    case "VariableDeclaration":
      return variableTargets(declaration, statement, exported);
    case "TSTypeAliasDeclaration":
    case "TSInterfaceDeclaration":
      return exported ? [{ name: declaration.id.name, anchor: statement, fn: null }] : [];
    default:
      return [];
  }
};

/**
 * 対象の直前にある、独立した行のコメントを返す。
 *
 * 前の文の行末に付いたコメント（`const a = 1; // メモ`）は、次の宣言の doc として読まない。
 *
 * @param context ルールのコンテキスト
 * @param node doc を探す起点
 * @returns 直前のコメント。無ければ `null`
 */
const docCommentOf = (context: Context, node: ESTree.Node): ESTree.Comment | null => {
  const comment = context.sourceCode.getCommentsBefore(node).at(-1);
  if (comment === undefined) {
    return null;
  }
  const text = context.sourceCode.text;
  const lineStart = text.lastIndexOf("\n", comment.start - 1) + 1;
  return text.slice(lineStart, comment.start).trim() === "" ? comment : null;
};

/**
 * 値を返す戻り値の型注釈か。`void` と `Promise<void>` は値を返さないものとして扱う。
 *
 * @param fn 関数
 * @returns 戻り値の型注釈があり、`void` / `Promise<void>` 以外なら `true`
 */
const returnsValue = (fn: DocumentedFunction): boolean => {
  const annotation = fn.returnType?.typeAnnotation;
  if (annotation === undefined) {
    return false;
  }
  if (annotation.type === "TSVoidKeyword") {
    return false;
  }
  const isPromiseOfVoid =
    annotation.type === "TSTypeReference" &&
    annotation.typeName.type === "Identifier" &&
    annotation.typeName.name === "Promise" &&
    annotation.typeArguments?.params.length === 1 &&
    annotation.typeArguments.params[0]?.type === "TSVoidKeyword";
  return !isPromiseOfVoid;
};

/**
 * 名前の付いた引数を持つか。分割代入だけの引数は名前が無く `@param` を書けないため数えない。
 *
 * @param fn 関数
 * @returns 名前付きの引数（既定値付き・残余引数を含む）が 1 つでもあれば `true`
 */
const hasNamedParameter = (fn: DocumentedFunction): boolean =>
  fn.params.some((param) => {
    const pattern =
      param.type === "RestElement"
        ? param.argument
        : param.type === "AssignmentPattern"
          ? param.left
          : param;
    return pattern.type === "Identifier" && pattern.name !== "this";
  });

/**
 * 木の中に `throw` 文があるか。入れ子の関数の中も数える（コールバックから投げても外へ出るため）。
 *
 * @param node 探す起点
 * @returns `throw` 文があれば `true`
 */
const containsThrow = (node: unknown): boolean => {
  if (Array.isArray(node)) {
    return node.some(containsThrow);
  }
  if (typeof node !== "object" || node === null || !("type" in node)) {
    return false;
  }
  if (node.type === "ThrowStatement") {
    return true;
  }
  return Object.entries(node).some(([key, child]) => key !== "parent" && containsThrow(child));
};

/**
 * doc に欠けている項目を返す。
 *
 * @param fn 関数
 * @param doc 関数の直前にあるブロックコメントの中身
 * @returns 欠けている項目（`@param` / `@returns` / `@throws`）
 */
const missingTags = (fn: DocumentedFunction, doc: string): string[] => {
  const required = [
    { tag: "@param", needed: hasNamedParameter(fn) },
    { tag: "@returns", needed: returnsValue(fn) },
    { tag: "@throws", needed: containsThrow(fn.body) },
  ];
  return required
    .filter(({ tag, needed }) => needed && !new RegExp(`${tag}\\b`).test(doc))
    .map(({ tag }) => tag);
};

/**
 * 設定を既定値と合わせて読む。
 *
 * @param context ルールのコンテキスト
 * @returns 読んだ設定
 */
const optionsOf = (context: Context): RequireDocCommentOptions => {
  const raw = context.options[0];
  const isObject = typeof raw === "object" && raw !== null && !Array.isArray(raw);
  const checkTags = isObject ? raw["checkTags"] : undefined;
  return typeof checkTags === "boolean" ? { checkTags } : DefaultOptions;
};

/**
 * ファイル直下の宣言とコンパニオンオブジェクト直下のメソッドに doc コメントを求めるルール。
 *
 * 同じファイルに同名の宣言があってそちらに doc があれば、doc の無い側は報告しない
 * （型とコンパニオンオブジェクトが 1 つの doc を共有する形を弾かないため）。
 */
export const requireDocComment: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "ファイル直下の宣言とコンパニオンオブジェクトのメソッドに doc コメントと @param / @returns / @throws を求める",
    },
    schema: [
      {
        type: "object",
        properties: { checkTags: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: {
      missingDoc: "`{{name}}` に doc コメントがありません。その関数・型・定数が何かを書いてください。",
      missingTags: "`{{name}}` の doc に {{tags}} がありません。",
    },
  },
  create(context) {
    const options = optionsOf(context);
    return {
      Program(program) {
        const targets = program.body.flatMap(statementTargets);
        const withDoc = targets.map((target) => ({
          target,
          doc: docCommentOf(context, target.anchor),
        }));
        const documented = new Set(
          withDoc.filter(({ doc }) => doc !== null).map(({ target }) => target.name),
        );

        for (const { target, doc } of withDoc) {
          if (doc === null) {
            if (!documented.has(target.name)) {
              context.report({ node: target.anchor, messageId: "missingDoc", data: { name: target.name } });
            }
            continue;
          }
          // 行コメントは 1 行の説明として doc に数えるが、項目は書けないので見ない。
          const tagsChecked = options.checkTags && doc.type === "Block";
          const fn = tagsChecked ? target.fn : null;
          const missing = fn === null ? [] : missingTags(fn, doc.value);
          if (missing.length > 0) {
            context.report({
              node: target.anchor,
              messageId: "missingTags",
              data: { name: target.name, tags: missing.join(" / ") },
            });
          }
        }
      },
    };
  },
};
