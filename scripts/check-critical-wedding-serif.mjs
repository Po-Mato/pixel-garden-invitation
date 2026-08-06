import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditCriticalWeddingSerif, readCriticalWeddingSerifAuditInputs } from "./lib/criticalWeddingSerifAudit.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputs = await readCriticalWeddingSerifAuditInputs(rootDir);
const result = auditCriticalWeddingSerif(inputs);
if (result.issues.length > 0) throw new Error(`Critical wedding serif audit failed:\n${result.issues.join("\n")}`);
console.log(`웨딩 세리프 글리프 감사 통과: 제목 ${inputs.requiredCodePoints.length}자 · 코퍼스 ${result.expected.corpusCodePointCount}자`);
