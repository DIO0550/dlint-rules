import { RuleTester } from "oxlint/plugins-dev";
import { it } from "vitest";

// RuleTester は既定でルール名・valid / invalid の 2 段の describe を作る。テストをフラットに
// 並べる規約に合わせ、describe は中身を呼ぶだけにして it をファイル直下へ並べる。
RuleTester.describe = (_name, fn) => fn();
RuleTester.it = it;
