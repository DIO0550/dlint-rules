import { execFileSync } from "node:child_process";

/**
 * CLI テストの前に dist を作る。oxlint が読み込むのは配布物と同じビルド済みの JS のため。
 */
export default function setup(): void {
  execFileSync("pnpm", ["run", "build"], { stdio: "inherit" });
}
