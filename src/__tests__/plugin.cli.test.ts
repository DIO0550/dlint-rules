import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const RepoRoot = resolve(import.meta.dirname, "../..");
const OxlintBin = join(RepoRoot, "node_modules/.bin/oxlint");
const PluginEntry = join(RepoRoot, "dist/index.js");

const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * 一時ディレクトリにプラグインを読む設定とファイルを置き、oxlint を JSON 出力で走らせる。
 *
 * @param files 置くファイル（パス → 中身）
 * @returns 報告された診断の `code` と `filename`
 */
const lintWithPlugin = (files: Record<string, string>): { code: string; filename: string }[] => {
  const dir = mkdtempSync(join(tmpdir(), "dlint-cli-"));
  workDirs.push(dir);
  const config = {
    jsPlugins: [PluginEntry],
    rules: { "dlint/require-doc-comment": "error" },
  };
  writeFileSync(join(dir, ".oxlintrc.json"), JSON.stringify(config));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  const result = spawnSync(OxlintBin, ["-f", "json", "src"], { cwd: dir, encoding: "utf-8" });
  const report: { diagnostics: { code: string; filename: string }[] } = JSON.parse(result.stdout);
  return report.diagnostics.map(({ code, filename }) => ({ code, filename }));
};

test("oxlint の jsPlugins から読み込むと dlint/require-doc-comment として報告される", () => {
  const diagnostics = lintWithPlugin({
    "src/undocumented.ts": "export function bar(x: number): number {\n  return x;\n}\n",
    "src/documented.ts": "/** 幅 */\nexport const Width = 1;\n",
  });

  expect(diagnostics).toEqual([{ code: "dlint(require-doc-comment)", filename: "src/undocumented.ts" }]);
});
