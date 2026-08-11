import path from "node:path";
import { migrateVisualBaselineProvenance } from "./lib/visualBaselineProvenanceMigration.mjs";

const approved = process.argv.includes("--approve");
const reasonIndex = process.argv.indexOf("--reason");
const reason = reasonIndex >= 0 ? process.argv[reasonIndex + 1]?.trim() : "";
if (!approved) throw new Error("기준선 출처 재승인에는 --approve가 필요합니다.");
if (!reason) throw new Error("기준선 출처 재승인 사유를 --reason으로 입력해야 합니다.");

const result = await migrateVisualBaselineProvenance({ rootDir: process.cwd(), reason });
console.log(`신뢰된 기준선 출처 재승인 완료: ${result.updates.map(({ id }) => id).join(", ")}`);
console.log(`메타데이터: ${result.updates.map(({ metadataPath }) => path.relative(process.cwd(), metadataPath)).join(", ")}`);
