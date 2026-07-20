import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  auditWeddingGalleryAssets,
  buildWeddingGalleryAssets,
  loadWeddingGalleryManifest
} from "./lib/weddingGalleryAssets.mjs";

const photos = [
  { id: "01-cover", alt: "표지", width: 1536, height: 1024, orientation: "landscape", layout: "hero" },
  { id: "02-dress-bouquet", alt: "드레스", width: 1024, height: 1536, orientation: "portrait", layout: "half" },
  { id: "03-side-walk", alt: "산책", width: 1024, height: 1536, orientation: "portrait", layout: "half" },
  { id: "06-hands-rings", alt: "반지", width: 1536, height: 1024, orientation: "landscape", layout: "wide" },
  { id: "04-bench-silhouette", alt: "벤치", width: 1024, height: 1536, orientation: "portrait", layout: "half" },
  { id: "05-veil-flowers", alt: "베일", width: 1024, height: 1536, orientation: "portrait", layout: "half" },
  { id: "08-under-tree", alt: "나무", width: 1536, height: 1024, orientation: "landscape", layout: "wide" },
  { id: "07-bouquet-still", alt: "부케", width: 1024, height: 1536, orientation: "portrait", layout: "half" },
  { id: "10-sunlit-finale", alt: "마무리", width: 1024, height: 1536, orientation: "portrait", layout: "half" },
  { id: "09-garden-aisle", alt: "통로", width: 1536, height: 1024, orientation: "landscape", layout: "wide" }
];

async function writeSource(file, photo) {
  await sharp({
    create: {
      width: photo.width,
      height: photo.height,
      channels: 3,
      background: "#7cb56c"
    }
  }).png().toFile(file);
}

async function withFixture(callback) {
  const rootDir = await mkdtemp(join(tmpdir(), "wedding-gallery-assets-"));
  const manifestPath = join(rootDir, "shared/src/weddingGalleryAssets.json");
  const sourceRoot = join(rootDir, "wedding-photo-sources/generated");
  const outputRoot = join(rootDir, "client/public/images/wedding-gallery");

  try {
    await mkdir(sourceRoot, { recursive: true });
    await mkdir(join(rootDir, "shared/src"), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(photos, null, 2)}\n`);
    await Promise.all(photos.map((photo) => writeSource(join(sourceRoot, `${photo.id}-source.png`), photo)));

    return await callback({ rootDir, manifestPath, sourceRoot, outputRoot });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function ratio(metadata) {
  return metadata.width / metadata.height;
}

test("640과 1024 폭의 WebP 파생 이미지를 정확히 생성한다", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceRoot, outputRoot }) => {
    await buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot });

    const files = (await readdir(outputRoot)).sort();
    assert.equal(files.length, 20);
    assert.equal(new Set(files).size, 20);

    for (const photo of photos) {
      for (const width of [640, 1024]) {
        const metadata = await sharp(join(outputRoot, `${photo.id}-${width}.webp`)).metadata();
        assert.equal(metadata.format, "webp");
        assert.equal(metadata.width, width);
        assert.ok(Math.abs(ratio(metadata) / (photo.width / photo.height) - 1) <= 0.01);
      }
    }
  });
});

test("누락되었거나 중복된 원본 파일을 거부한다", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceRoot, outputRoot }) => {
    await unlink(join(sourceRoot, "01-cover-source.png"));
    await assert.rejects(
      () => buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot }),
      /원본/
    );

    await writeSource(join(sourceRoot, "01-cover-source.png"), photos[0]);
    await sharp({
      create: { width: photos[0].width, height: photos[0].height, channels: 3, background: "#7cb56c" }
    }).jpeg().toFile(join(sourceRoot, "01-cover-source.jpg"));
    await assert.rejects(
      () => buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot }),
      /원본/
    );

    await unlink(join(sourceRoot, "01-cover-source.jpg"));
    await writeFile(join(sourceRoot, "01-cover-source.gif"), "invalid source extension");
    await assert.rejects(
      () => buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot }),
      /원본/
    );
  });
});

test("감사는 누락, WebP 형식 오류, 비율 오류를 거부한다", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceRoot, outputRoot }) => {
    await buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot });
    await unlink(join(outputRoot, "01-cover-640.webp"));
    await assert.rejects(
      () => auditWeddingGalleryAssets({ rootDir, manifestPath, outputRoot }),
      /누락/
    );

    await buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot });
    await sharp({
      create: { width: 640, height: 427, channels: 3, background: "#7cb56c" }
    }).png().toFile(join(outputRoot, "01-cover-640.webp"));
    await assert.rejects(
      () => auditWeddingGalleryAssets({ rootDir, manifestPath, outputRoot }),
      /WebP/
    );

    await buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot });
    await sharp({
      create: { width: 640, height: 640, channels: 3, background: "#7cb56c" }
    }).webp().toFile(join(outputRoot, "01-cover-640.webp"));
    await assert.rejects(
      () => auditWeddingGalleryAssets({ rootDir, manifestPath, outputRoot }),
      /비율/
    );
  });
});

test("감사는 출력 디렉터리의 추가 항목을 거부한다", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceRoot, outputRoot }) => {
    await buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot });
    await mkdir(join(outputRoot, "stale"));

    await assert.rejects(
      () => auditWeddingGalleryAssets({ rootDir, manifestPath, outputRoot }),
      /정확히/
    );
  });
});

test("중복 ID 매니페스트를 거부하고 실패한 빌드는 기존 출력을 유지한다", async () => {
  await withFixture(async ({ rootDir, manifestPath, sourceRoot, outputRoot }) => {
    const duplicateManifest = [...photos.slice(0, -1), { ...photos[0] }];
    await writeFile(manifestPath, `${JSON.stringify(duplicateManifest, null, 2)}\n`);
    await assert.rejects(
      () => loadWeddingGalleryManifest({ rootDir, manifestPath }),
      /고유/
    );

    await writeFile(manifestPath, `${JSON.stringify(photos, null, 2)}\n`);
    await buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot });
    await unlink(join(sourceRoot, "01-cover-source.png"));
    await assert.rejects(
      () => buildWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot }),
      /원본/
    );
    assert.equal((await readdir(outputRoot)).length, 20);
  });
});
