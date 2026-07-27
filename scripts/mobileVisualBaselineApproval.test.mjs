import assert from "node:assert/strict";
import test from "node:test";
import { parseBaselineApprovalArgs } from "./lib/mobileVisualBaselineApproval.mjs";

test("시각 기준선 갱신은 명시적 승인과 사유를 모두 요구한다", () => {
  assert.throws(() => parseBaselineApprovalArgs(["--reason", "맵 개선"]), /--approve/);
  assert.throws(() => parseBaselineApprovalArgs(["--approve"]), /--reason/);
  assert.deepEqual(
    parseBaselineApprovalArgs(["--", "--approve", "--reason", "맵과 캐릭터 품질 개선"]),
    { approved: true, reason: "맵과 캐릭터 품질 개선" }
  );
});

test("알 수 없는 옵션으로 기준선을 갱신하지 않는다", () => {
  assert.throws(() => parseBaselineApprovalArgs(["--approve", "--reason", "변경", "--force"]), /알 수 없는 옵션/);
});
