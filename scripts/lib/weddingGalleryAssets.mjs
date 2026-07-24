import { access, cp, mkdir, mkdtemp, readdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const derivativeWidths = Object.freeze([640, 1024]);
const derivativeFormats = Object.freeze([
  { extension: "webp", sharpFormat: "webp", label: "WebP" },
  { extension: "avif", sharpFormat: "heif", compression: "av1", label: "AVIF" }
]);
const sourceExtensions = Object.freeze(["png", "jpg", "jpeg", "webp"]);
const maximumRatioDifference = 0.01;

function defaultPaths(options) {
  const rootDir = options.rootDir ?? projectRoot;
  return {
    rootDir,
    manifestPath: options.manifestPath ?? path.join(rootDir, "shared/src/weddingGalleryAssets.json"),
    sourceRoot: options.sourceRoot ?? path.join(rootDir, "wedding-photo-sources/generated"),
    outputRoot: options.outputRoot ?? path.join(rootDir, "client/public/images/wedding-gallery")
  };
}

function isSafePhotoId(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function ratioDifference(actual, expected) {
  return Math.abs(actual / expected - 1);
}

function expectedOutputNames(manifest) {
  return manifest.flatMap((photo) => derivativeWidths.flatMap((width) => (
    derivativeFormats.map(({ extension }) => `${photo.id}-${width}.${extension}`)
  )));
}

function throwAuditErrors(errors) {
  if (errors.length > 0) {
    throw new Error(`웨딩 갤러리 자산 감사 실패:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

async function imageDimensionsAfterRotation(file) {
  const { info } = await sharp(file).rotate().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height };
}

async function findSourceFiles(sourceRoot, photoId) {
  let entries;
  try {
    entries = await readdir(sourceRoot, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`웨딩 갤러리 원본 디렉터리를 읽을 수 없습니다: ${message}`);
  }

  const allowedNames = new Set(sourceExtensions.map((extension) => `${photoId}-source.${extension}`));
  const candidates = entries.filter((entry) => entry.isFile() && entry.name.startsWith(`${photoId}-source.`));
  const matches = candidates
    .filter((entry) => allowedNames.has(entry.name))
    .map((entry) => path.join(sourceRoot, entry.name));

  if (candidates.length !== 1 || matches.length !== 1) {
    throw new Error(
      `웨딩 갤러리 원본은 ${photoId}마다 허용 확장자로 하나여야 합니다; ${candidates.length}개를 찾았습니다.`
    );
  }

  return matches[0];
}

async function readSourceDimensions(sourceRoot, photo) {
  const source = await findSourceFiles(sourceRoot, photo.id);
  try {
    return { source, dimensions: await imageDimensionsAfterRotation(source) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`웨딩 갤러리 원본을 읽을 수 없습니다: ${source}; ${message}`);
  }
}

export async function loadWeddingGalleryManifest(options = {}) {
  const { manifestPath } = defaultPaths(options);
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`웨딩 갤러리 매니페스트를 읽을 수 없습니다: ${message}`);
  }

  if (!Array.isArray(manifest) || manifest.length !== 10) {
    throw new Error("웨딩 갤러리 매니페스트는 정확히 10장이어야 합니다.");
  }

  const ids = new Set();
  for (const photo of manifest) {
    if (!photo || typeof photo !== "object") {
      throw new Error("웨딩 갤러리 매니페스트 항목 형식이 올바르지 않습니다.");
    }

    if (!isSafePhotoId(photo.id)) {
      throw new Error("웨딩 갤러리 사진 ID는 안전한 파일명 형식이어야 합니다.");
    }
    if (ids.has(photo.id)) {
      throw new Error(`웨딩 갤러리 사진 ID는 고유해야 합니다: ${photo.id}`);
    }
    if (typeof photo.alt !== "string" || photo.alt.trim().length === 0) {
      throw new Error(`웨딩 갤러리 사진의 대체 텍스트가 올바르지 않습니다: ${photo.id}`);
    }
    if (!isPositiveNumber(photo.width) || !isPositiveNumber(photo.height)) {
      throw new Error(`웨딩 갤러리 사진의 선언 크기가 올바르지 않습니다: ${photo.id}`);
    }
    if (photo.orientation !== "landscape" && photo.orientation !== "portrait") {
      throw new Error(`웨딩 갤러리 사진의 방향이 올바르지 않습니다: ${photo.id}`);
    }
    if ((photo.orientation === "landscape" && photo.width <= photo.height)
      || (photo.orientation === "portrait" && photo.height <= photo.width)) {
      throw new Error(`웨딩 갤러리 사진의 방향과 선언 크기가 일치하지 않습니다: ${photo.id}`);
    }
    if (!['hero', 'wide', 'half'].includes(photo.layout)) {
      throw new Error(`웨딩 갤러리 사진의 레이아웃이 올바르지 않습니다: ${photo.id}`);
    }
    ids.add(photo.id);
  }

  const outputNames = expectedOutputNames(manifest);
  if (new Set(outputNames).size !== outputNames.length) {
    throw new Error("웨딩 갤러리 출력 파일명은 고유해야 합니다.");
  }

  return manifest;
}

export async function auditWeddingGalleryAssets(options = {}) {
  const { manifestPath, outputRoot } = defaultPaths(options);
  const manifest = await loadWeddingGalleryManifest({ ...options, manifestPath });
  const errors = [];
  const expectedNames = expectedOutputNames(manifest);
  let outputEntries = [];

  try {
    outputEntries = await readdir(outputRoot, { withFileTypes: true });
  } catch {
    errors.push(`출력 디렉터리 누락: ${outputRoot}`);
  }

  const outputNames = outputEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  if (outputEntries.length !== expectedNames.length) {
    errors.push(`출력 디렉터리 항목은 정확히 ${expectedNames.length}개여야 합니다; ${outputEntries.length}개를 찾았습니다.`);
  }

  const expectedNameSet = new Set(expectedNames);
  for (const outputName of outputNames) {
    if (!expectedNameSet.has(outputName)) errors.push(`예상하지 않은 출력 파일: ${outputName}`);
  }
  for (const entry of outputEntries) {
    if (!entry.isFile()) errors.push(`출력 디렉터리에는 파일만 있어야 합니다: ${entry.name}`);
  }

  for (const photo of manifest) {
    const declaredRatio = photo.width / photo.height;

    for (const width of derivativeWidths) {
      for (const format of derivativeFormats) {
        const fileName = `${photo.id}-${width}.${format.extension}`;
        const output = path.join(outputRoot, fileName);
        try {
          await access(output);
        } catch {
          errors.push(`출력 파일 누락: ${fileName}`);
          continue;
        }

        try {
          const metadata = await sharp(output).metadata();
          if (metadata.format !== format.sharpFormat) {
            errors.push(`출력 파일은 ${format.label} 형식이어야 합니다: ${fileName}`);
          }
          if (format.compression && metadata.compression !== format.compression) {
            errors.push(`출력 파일은 ${format.label} ${format.compression.toUpperCase()} 압축이어야 합니다: ${fileName}`);
          }
          if (metadata.width !== width) {
            errors.push(`출력 파일 폭은 ${width}px이어야 합니다: ${fileName}`);
          }
          if (!metadata.width || !metadata.height) {
            errors.push(`출력 파일 크기를 읽을 수 없습니다: ${fileName}`);
            continue;
          }
          const outputRatio = metadata.width / metadata.height;
          if (ratioDifference(outputRatio, declaredRatio) > maximumRatioDifference) {
            errors.push(`출력 파일 비율이 선언 비율과 1% 이내로 일치해야 합니다: ${fileName}`);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`출력 파일 메타데이터를 읽을 수 없습니다: ${fileName}; ${message}`);
        }
      }
    }
  }

  throwAuditErrors(errors);
  return { files: expectedNames.map((name) => path.join(outputRoot, name)), manifest };
}

export async function buildWeddingGalleryAssets(options = {}) {
  const { rootDir, manifestPath, sourceRoot, outputRoot } = defaultPaths(options);
  const fileSystem = {
    rename: options.fileSystem?.rename ?? rename,
    cp: options.fileSystem?.cp ?? cp,
    rm: options.fileSystem?.rm ?? rm
  };
  const manifest = await loadWeddingGalleryManifest({ ...options, manifestPath });
  const sources = await Promise.all(manifest.map(async (photo) => {
    const source = await readSourceDimensions(sourceRoot, photo);
    const declaredRatio = photo.width / photo.height;
    const sourceRatio = source.dimensions.width / source.dimensions.height;
    if (ratioDifference(sourceRatio, declaredRatio) > maximumRatioDifference) {
      throw new Error(`웨딩 갤러리 원본 비율이 선언 비율과 1% 이내로 일치해야 합니다: ${photo.id}`);
    }
    return { photo, source: source.source };
  }));

  await mkdir(path.dirname(outputRoot), { recursive: true });
  const temporaryRoot = await mkdtemp(path.join(path.dirname(outputRoot), ".wedding-gallery-"));
  const stagedOutputRoot = path.join(temporaryRoot, "gallery");

  try {
    await mkdir(stagedOutputRoot, { recursive: true });
    await Promise.all(sources.flatMap(({ photo, source }) => derivativeWidths.flatMap((width) => [
      sharp(source)
        .rotate()
        .resize({ width, fit: "inside", withoutEnlargement: false })
        .webp({ quality: 82, effort: 6 })
        .toFile(path.join(stagedOutputRoot, `${photo.id}-${width}.webp`)),
      sharp(source)
        .rotate()
        .resize({ width, fit: "inside", withoutEnlargement: false })
        .avif({ quality: 58, effort: 5 })
        .toFile(path.join(stagedOutputRoot, `${photo.id}-${width}.avif`))
    ])));

    await auditWeddingGalleryAssets({ rootDir, manifestPath, sourceRoot, outputRoot: stagedOutputRoot });

    const backupRoot = `${outputRoot}.previous-${process.pid}-${Date.now()}`;
    let movedExistingOutput = false;
    let cleanupWarning;
    try {
      try {
        await fileSystem.rename(outputRoot, backupRoot);
        movedExistingOutput = true;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      await fileSystem.rename(stagedOutputRoot, outputRoot);
    } catch (publishError) {
      if (!movedExistingOutput) throw publishError;

      try {
        await fileSystem.rename(backupRoot, outputRoot);
      } catch (restoreError) {
        try {
          await fileSystem.cp(backupRoot, outputRoot, { recursive: true });
        } catch (copyError) {
          throw new AggregateError(
            [publishError, restoreError, copyError],
            `웨딩 갤러리 publish와 복구에 실패했습니다. backup 경로: ${backupRoot}`
          );
        }
      }
      throw publishError;
    }
    if (movedExistingOutput) {
      try {
        await fileSystem.rm(backupRoot, { recursive: true, force: true });
      } catch (error) {
        cleanupWarning = error;
      }
    }

    return {
      files: expectedOutputNames(manifest).map((name) => path.join(outputRoot, name)),
      manifest,
      cleanupWarning
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
