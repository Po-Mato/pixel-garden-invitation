import { createHash } from "node:crypto";

function unescapeJsonPointerSegment(segment) {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}

function valueAtJsonPointer(value, pointer) {
  const segments = pointer.split("/").slice(1).map(unescapeJsonPointerSegment);
  let current = value;
  for (const segment of segments) {
    if (current?.[segment] === undefined) throw new Error(`롤백할 전경 JSON 경로가 없습니다: ${pointer}`);
    current = current[segment];
  }
  return current;
}

export function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function verifyForegroundContractChecksum(expected, actual) {
  if (!expected) throw new Error("--write에는 미리보기의 --expect-checksum 값이 필요합니다");
  if (!/^[a-f0-9]{64}$/i.test(expected)) throw new Error("--expect-checksum은 SHA-256 형식이어야 합니다");
  if (expected.toLowerCase() !== actual.toLowerCase()) {
    throw new Error(`전경 계약 체크섬 불일치: expected ${expected}, actual ${actual}`);
  }
  return true;
}

export function buildForegroundPlacementRollbackJsonPatch(contract, forwardOperations) {
  return [...forwardOperations].reverse().map((operation) => {
    if (operation.op === "add") return { op: "remove", path: operation.path };
    if (operation.op === "replace") {
      return {
        op: "replace",
        path: operation.path,
        value: structuredClone(valueAtJsonPointer(contract, operation.path))
      };
    }
    throw new Error(`롤백할 수 없는 전경 JSON patch 연산: ${operation.op}`);
  });
}
