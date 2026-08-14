import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditCriticalWeddingDisplay, readCriticalWeddingDisplayAuditInputs } from "./lib/criticalWeddingDisplayAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputs = await readCriticalWeddingDisplayAuditInputs(rootDir);
const result = auditCriticalWeddingDisplay(inputs);
if (result.issues.length > 0) throw new Error(`Critical wedding display font audit failed:\n${result.issues.join("\n")}`);
console.log(`웨딩 디스플레이 글꼴 감사 통과: 제목 ${inputs.requiredCodePoints.length}자 · 코퍼스 ${result.expected.corpusCodePointCount}자`);
