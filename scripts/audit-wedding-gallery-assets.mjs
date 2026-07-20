import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditWeddingGalleryAssets } from "./lib/weddingGalleryAssets.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await auditWeddingGalleryAssets({ rootDir });

console.log(`웨딩 갤러리 이미지 감사 통과: ${result.files.length}개 파일`);
