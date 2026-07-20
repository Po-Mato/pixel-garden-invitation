import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWeddingGalleryAssets } from "./lib/weddingGalleryAssets.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await buildWeddingGalleryAssets({ rootDir });

console.log(`웨딩 갤러리 이미지 생성 완료: ${result.files.length}개 파일`);
